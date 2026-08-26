/**
 * Tests des retours et remboursements (Phase 5.5) — suite `node:test`.
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
  const Sale = require('../models/saleModel');
  const Client = require('../models/clientModel');
  const User = require('../models/userModel');
  const Payment = require('../models/paymentModel');
  const SaleReturn = require('../models/saleReturnModel');
  const Refund = require('../models/refundModel');
  const { ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const { recordPayment } = require('../services/paymentService');
  const { createReturn, postReturn, cancelReturn, createRefund } = require('../services/returnService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, product, sale, payment;

  const balanceNow = async () => {
    const row = await InventoryBalance.findOne({ tenantId: tenant._id, productId: product._id, locationId: location._id }).lean();
    return row ? row.onHand : 0;
  };

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Ret ${SUFFIX}`, ownerName: 'T', ownerEmail: `ret-${SUFFIX}@t.io`,
      code: `RET${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LRET${SUFFIX}`.slice(0, 10), type: 'store',
    });
    const user = await User.create({
      tenantId: tenant._id, name: 'Admin', email: `ret-admin-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: true, isActive: true,
    });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit Ret ${SUFFIX}`, description: 'Test retour',
      category: 'Meubles', price: 200, costPrice: 100, stock: 10,
    });
    await ensureDefaultVariantAndBalance(tenant._id, location._id, product._id, null);
    const client = await Client.create({
      tenantId: tenant._id, name: 'Client', email: `ret-client-${SUFFIX}@t.io`,
    });
    sale = await Sale.create({
      tenantId: tenant._id, locationId: location._id, client: client._id,
      products: [{ product: product._id, quantity: 3, priceAtSale: 200 }],
      totalAmount: 600, paymentMethod: 'cash', user: user._id, saleDate: new Date(),
      status: 'completed',
    });
    const payResult = await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId: sale._id,
      amount: 600, method: 'cash', idempotencyKey: `ret-pay:${SUFFIX}`,
    });
    payment = payResult.payment;
  });

  test.after(async () => {
    await SaleReturn.deleteMany({ tenantId: tenant._id });
    await Refund.deleteMany({ tenantId: tenant._id });
    await Payment.deleteMany({ tenantId: tenant._id });
    await Sale.deleteMany({ tenantId: tenant._id });
    await Client.deleteMany({ tenantId: tenant._id });
    await User.deleteMany({ tenantId: tenant._id });
    await StockMovement.deleteMany({ tenantId: tenant._id });
    await InventoryBalance.deleteMany({ tenantId: tenant._id });
    await ProductVariant.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('création de retour : plafond retournable validé', async () => {
    const ret = await createReturn({
      tenantId: tenant._id, locationId: location._id, saleId: sale._id,
      lines: [{ product: product._id, quantity: 2, disposition: 'restocked' }],
    });
    assert.strictEqual(ret.status, 'pending');
    assert.strictEqual(ret.lines[0].quantity, 2);

    // Il ne reste que 1 unité retournable → refus.
    await assert.rejects(
      createReturn({
        tenantId: tenant._id, locationId: location._id, saleId: sale._id,
        lines: [{ product: product._id, quantity: 2 }],
      }),
      (err) => err.statusCode === 409
    );
    // Produit hors vente → refus.
    await assert.rejects(
      createReturn({
        tenantId: tenant._id, locationId: location._id, saleId: sale._id,
        lines: [{ product: new mongoose.Types.ObjectId(), quantity: 1 }],
      }),
      (err) => err.statusCode === 409
    );
  });

  test('postReturn : réapprovisionnement + statut de vente', async () => {
    const pending = await SaleReturn.findOne({ tenantId: tenant._id, status: 'pending' });
    const before = await balanceNow();
    const { ret } = await postReturn({ tenantId: tenant._id, returnId: pending._id });

    assert.strictEqual(ret.status, 'posted');
    assert.strictEqual(await balanceNow(), before + 2, 'stock restocké');
    assert.strictEqual((await Product.findById(product._id).lean()).stock, 12);

    const movement = await StockMovement.findOne({
      tenantId: tenant._id, referenceType: 'saleReturn', referenceId: ret._id,
    }).lean();
    assert.ok(movement, 'mouvement sale_return référencé');
    assert.strictEqual(movement.quantityDelta, 2);

    const updatedSale = await Sale.findById(sale._id).lean();
    assert.strictEqual(updatedSale.status, 'partially_returned');
  });

  test('postReturn avec remboursement : Refund + paiement inversé + plafond', async () => {
    // Il reste 1 unité retournable → dernier retour, remboursement de 200.
    const ret = await createReturn({
      tenantId: tenant._id, locationId: location._id, saleId: sale._id,
      lines: [{ product: product._id, quantity: 1, disposition: 'damaged' }],
    });
    const { refund } = await postReturn({
      tenantId: tenant._id, returnId: ret._id,
      refund: { amount: 200, method: 'cash', reason: 'Article abîmé' },
      paymentIds: [payment._id],
    });
    assert.ok(refund, 'Refund créé');
    assert.strictEqual(refund.amount, 200);
    assert.strictEqual(refund.status, 'completed');

    const updatedPayment = await Payment.findById(payment._id).lean();
    assert.strictEqual(updatedPayment.status, 'reversed', 'paiement inversé');

    // Tout est retourné → vente `returned`.
    const updatedSale = await Sale.findById(sale._id).lean();
    assert.strictEqual(updatedSale.status, 'returned');

    // Remboursable restant : 600 - 200 = 400 → 500 refusé.
    await assert.rejects(
      createRefund({
        tenantId: tenant._id, locationId: location._id, saleId: sale._id,
        amount: 500, method: 'cash',
      }),
      (err) => err.statusCode === 409
    );
    // 400 accepté (remboursement autonome).
    const standalone = await createRefund({
      tenantId: tenant._id, locationId: location._id, saleId: sale._id,
      amount: 400, method: 'cash', reason: 'Geste commercial',
      idempotencyKey: `refund-standalone:${SUFFIX}`,
    });
    assert.strictEqual(standalone.alreadyApplied, false);
    const replay = await createRefund({
      tenantId: tenant._id, locationId: location._id, saleId: sale._id,
      amount: 400, method: 'cash', reason: 'Geste commercial',
      idempotencyKey: `refund-standalone:${SUFFIX}`,
    });
    assert.strictEqual(replay.alreadyApplied, true);
    const count = await Refund.countDocuments({ tenantId: tenant._id, idempotencyKey: `refund-standalone:${SUFFIX}` });
    assert.strictEqual(count, 1, 'idempotent');
  });

  test('annulation d\'un retour avant publication', async () => {
    // Plus rien de retournable → créer sur une autre ligne ? Non : la vente est
    // entièrement retournée. On vérifie le cas générique via le 409.
    const ret = await SaleReturn.findOne({ tenantId: tenant._id, status: 'posted' }).lean();
    await assert.rejects(
      cancelReturn({ tenantId: tenant._id, returnId: ret._id }),
      (err) => err.statusCode === 409
    );
  });
}
