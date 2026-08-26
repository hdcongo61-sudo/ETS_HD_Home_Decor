/**
 * Tests des bons de commande et réceptions (Phases 6.3-6.4) — `node:test`.
 *
 * Prérequis :
 *   RUN_TENANT_TESTS=1 + TEST_MONGO_URI (base de test dédiée).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (process.env.RUN_TENANT_TESTS !== '1') {
  test('garde-fou RUN_TENANT_TESTS', () => {
    assert.fail('RUN_TENANT_TESTS=1 et TEST_MONGO_URI sont requis.');
  });
} else {
  const mongoose = require('mongoose');
  const Tenant = require('../models/tenantModel');
  const Location = require('../models/locationModel');
  const Product = require('../models/productModel');
  const ProductVariant = require('../models/productVariantModel');
  const InventoryBalance = require('../models/inventoryBalanceModel');
  const StockMovement = require('../models/stockMovementModel');
  const User = require('../models/userModel');
  const Supplier = require('../models/supplierModel');
  const SupplierProduct = require('../models/supplierProductModel');
  const PurchaseOrder = require('../models/purchaseOrderModel');
  const NumberSequence = require('../models/numberSequenceModel');
  const { ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const purchaseService = require('../services/purchaseService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, supplier, product, requester, approver;

  const balanceNow = async () => {
    const row = await InventoryBalance.findOne({ tenantId: tenant._id, productId: product._id, locationId: location._id }).lean();
    return row ? row.onHand : 0;
  };

  const makeOrder = () => purchaseService.createOrder({
    tenantId: tenant._id, locationId: location._id, supplierId: supplier._id,
    lines: [{ product: product._id, quantity: 2, unitCost: 1000, taxRate: 10 }],
    userId: requester._id,
  });

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `PO ${SUFFIX}`, ownerName: 'T', ownerEmail: `po-${SUFFIX}@t.io`,
      code: `PO${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LPO${SUFFIX}`.slice(0, 10), type: 'store',
    });
    supplier = await Supplier.create({ tenantId: tenant._id, name: `Fournisseur ${SUFFIX}` });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit PO ${SUFFIX}`, description: 'Test commande',
      category: 'Meubles', price: 2000, costPrice: 1000, stock: 0,
    });
    await ensureDefaultVariantAndBalance(tenant._id, location._id, product._id, null);
    requester = await User.create({
      tenantId: tenant._id, name: 'Demandeur', email: `po-req-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
    approver = await User.create({
      tenantId: tenant._id, name: 'Approbateur', email: `po-app-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
  });

  test.after(async () => {
    await PurchaseOrder.deleteMany({ tenantId: tenant._id });
    await SupplierProduct.deleteMany({ tenantId: tenant._id });
    await Supplier.deleteMany({ tenantId: tenant._id });
    await NumberSequence.deleteMany({ tenantId: tenant._id });
    await User.deleteMany({ tenantId: tenant._id });
    await StockMovement.deleteMany({ tenantId: tenant._id });
    await InventoryBalance.deleteMany({ tenantId: tenant._id });
    await ProductVariant.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('création : numérotation atomique, totaux backend', async () => {
    const order = await makeOrder();
    const year = new Date().getFullYear();
    assert.ok(order.code.startsWith(`PO-${year}-`), `code=${order.code}`);
    assert.strictEqual(order.status, 'draft');
    assert.strictEqual(order.totalAmount, 2200, 'total = 2 × 1000 × 1,1 (taxe 10%)');
    assert.strictEqual(order.lines[0].description, `Produit PO ${SUFFIX}`, 'instantané de description');

    const second = await makeOrder();
    assert.notStrictEqual(second.code, order.code, 'numéro suivant différent');
  });

  test('machine à états : soumission, approbation avec séparation', async () => {
    const order = await makeOrder();
    await assert.rejects(
      purchaseService.receiveOrder({
        tenantId: tenant._id, orderId: order._id,
        receivedLines: [{ productId: product._id, quantity: 1 }],
      }),
      (err) => err.statusCode === 409
    );

    const submitted = await purchaseService.submitOrder({
      tenantId: tenant._id, orderId: order._id, userId: requester._id,
    });
    assert.strictEqual(submitted.status, 'submitted');

    await assert.rejects(
      purchaseService.approveOrder({
        tenantId: tenant._id, orderId: order._id, userId: requester._id,
      }),
      (err) => err.statusCode === 409
    );
    const approved = await purchaseService.approveOrder({
      tenantId: tenant._id, orderId: order._id, userId: approver._id,
    });
    assert.strictEqual(approved.status, 'approved');
    assert.strictEqual(String(approved.approvedBy), String(approver._id));
  });

  test('réception partielle puis complète, écarts rejetés explicites', async () => {
    const order = await makeOrder();
    await purchaseService.submitOrder({ tenantId: tenant._id, orderId: order._id });
    await purchaseService.approveOrder({
      tenantId: tenant._id, orderId: order._id, userId: approver._id,
    });

    const partial = await purchaseService.receiveOrder({
      tenantId: tenant._id, orderId: order._id,
      receivedLines: [{ productId: product._id, quantity: 1 }],
    });
    assert.strictEqual(partial.status, 'partially_received');
    assert.strictEqual(await balanceNow(), 1);
    assert.strictEqual((await Product.findById(product._id).lean()).stock, 1);

    const movement = await StockMovement.findOne({
      tenantId: tenant._id, referenceType: 'purchaseOrder', referenceId: order._id,
    }).lean();
    assert.ok(movement, 'mouvement purchase_receipt référencé');
    assert.strictEqual(movement.quantityDelta, 1);

    // Réception du reste : 1 reçu + 0 rejeté → received.
    const done = await purchaseService.receiveOrder({
      tenantId: tenant._id, orderId: order._id,
      receivedLines: [{ productId: product._id, quantity: 1, rejectedQuantity: 0 }],
    });
    assert.strictEqual(done.status, 'received');
    assert.strictEqual(await balanceNow(), 2);

    await assert.rejects(
      purchaseService.receiveOrder({
        tenantId: tenant._id, orderId: order._id,
        receivedLines: [{ productId: product._id, quantity: 1 }],
      }),
      (err) => err.statusCode === 409
    );

    const closed = await purchaseService.closeOrder({ tenantId: tenant._id, orderId: order._id });
    assert.strictEqual(closed.status, 'closed');
  });

  test('idempotence de réception : un retry ne double pas l\'entrée', async () => {
    const order = await makeOrder();
    await purchaseService.submitOrder({ tenantId: tenant._id, orderId: order._id });
    await purchaseService.approveOrder({
      tenantId: tenant._id, orderId: order._id, userId: approver._id,
    });

    const receipt = { productId: product._id, quantity: 1 };
    const first = await purchaseService.receiveOrder({
      tenantId: tenant._id, orderId: order._id,
      receivedLines: [receipt], idempotencyKey: `recv:${SUFFIX}`,
    });
    assert.strictEqual(first.alreadyApplied, undefined);
    const before = await balanceNow();

    const replay = await purchaseService.receiveOrder({
      tenantId: tenant._id, orderId: order._id,
      receivedLines: [receipt], idempotencyKey: `recv:${SUFFIX}`,
    });
    assert.strictEqual(replay.alreadyApplied, true);
    assert.strictEqual(await balanceNow(), before, 'aucun double comptage');

    const movements = await StockMovement.countDocuments({
      tenantId: tenant._id, idempotencyKey: `recv:${SUFFIX}:0`,
    });
    assert.strictEqual(movements, 1);
    const reloaded = await PurchaseOrder.findById(order._id).lean();
    assert.strictEqual(reloaded.lines[0].receivedQuantity, 1);
  });

  test('rejet et annulation avant réception', async () => {
    const rejected = await makeOrder();
    await assert.rejects(
      purchaseService.rejectOrder({ tenantId: tenant._id, orderId: rejected._id, reason: 'Trop cher' }),
      (err) => err.statusCode === 409,
      'un brouillon ne se rejette pas (soumettre d\'abord)'
    );
    await purchaseService.submitOrder({ tenantId: tenant._id, orderId: rejected._id });
    const afterReject = await purchaseService.rejectOrder({
      tenantId: tenant._id, orderId: rejected._id, reason: 'Trop cher',
    });
    assert.strictEqual(afterReject.status, 'rejected');
    assert.strictEqual(afterReject.rejectionReason, 'Trop cher');

    const cancelled = await makeOrder();
    const afterCancel = await purchaseService.cancelOrder({ tenantId: tenant._id, orderId: cancelled._id });
    assert.strictEqual(afterCancel.status, 'cancelled');
  });
}
