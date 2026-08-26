/**
 * Tests expéditions entrantes + factures fournisseur (Phases 6.5-6.6).
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
  const InboundShipment = require('../models/inboundShipmentModel');
  const SupplierInvoice = require('../models/supplierInvoiceModel');
  const NumberSequence = require('../models/numberSequenceModel');
  const { ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const purchaseService = require('../services/purchaseService');
  const shipmentService = require('../services/shipmentService');
  const invoiceService = require('../services/supplierInvoiceService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, supplier, productA, productB, requester, approver, order;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `SC ${SUFFIX}`, ownerName: 'T', ownerEmail: `sc-${SUFFIX}@t.io`,
      code: `SC${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LSC${SUFFIX}`.slice(0, 10), type: 'store',
    });
    supplier = await Supplier.create({ tenantId: tenant._id, name: `Fournisseur SC ${SUFFIX}` });
    const makeProduct = async (name, cost) => {
      const product = await Product.create({
        tenantId: tenant._id, name, description: 'Test supply chain',
        category: 'Meubles', price: cost * 2, costPrice: cost, stock: 0,
      });
      await ensureDefaultVariantAndBalance(tenant._id, location._id, product._id, null);
      return product;
    };
    productA = await makeProduct(`Produit A ${SUFFIX}`, 1000);
    productB = await makeProduct(`Produit B ${SUFFIX}`, 250);
    requester = await User.create({
      tenantId: tenant._id, name: 'Demandeur', email: `sc-req-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
    approver = await User.create({
      tenantId: tenant._id, name: 'Approbateur', email: `sc-app-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });

    // Commande entièrement reçue : A 2×1000, B 4×250.
    order = await purchaseService.createOrder({
      tenantId: tenant._id, locationId: location._id, supplierId: supplier._id,
      lines: [
        { product: productA._id, quantity: 2, unitCost: 1000 },
        { product: productB._id, quantity: 4, unitCost: 250 },
      ],
      userId: requester._id,
    });
    await purchaseService.submitOrder({ tenantId: tenant._id, orderId: order._id });
    await purchaseService.approveOrder({ tenantId: tenant._id, orderId: order._id, userId: approver._id });
    await purchaseService.receiveOrder({
      tenantId: tenant._id, orderId: order._id,
      receivedLines: [
        { productId: productA._id, quantity: 2 },
        { productId: productB._id, quantity: 4 },
      ],
    });
  });

  test.after(async () => {
    await SupplierInvoice.deleteMany({ tenantId: tenant._id });
    await InboundShipment.deleteMany({ tenantId: tenant._id });
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

  test('expédition : cycle de vie et répartition des coûts logistiques', async () => {
    const shipment = await shipmentService.createShipment({
      tenantId: tenant._id, destinationLocationId: location._id,
      reference: `CNT-${SUFFIX}`.toUpperCase().slice(0, 12),
      supplierIds: [supplier._id], purchaseOrderIds: [order._id],
      freightCost: 300, customsCost: 0, insuranceCost: 0,
    });
    assert.strictEqual(shipment.status, 'planned');

    const inTransit = await shipmentService.markInTransit({
      tenantId: tenant._id, shipmentId: shipment._id,
    });
    assert.strictEqual(inTransit.status, 'in_transit');
    const received = await shipmentService.receiveShipment({
      tenantId: tenant._id, shipmentId: shipment._id,
    });
    assert.strictEqual(received.status, 'received');
    assert.ok(received.receivedAt, 'horodatage de réception');

    // Par valeur : A = 2×1000 = 2000, B = 4×250 = 1000 → A 200, B 100.
    const byValue = await shipmentService.getLandedCostAllocation({
      tenantId: tenant._id, shipmentId: shipment._id, method: 'value',
    });
    assert.strictEqual(byValue.landedTotal, 300);
    const rowA = byValue.allocations.find((r) => String(r.product) === String(productA._id));
    const rowB = byValue.allocations.find((r) => String(r.product) === String(productB._id));
    assert.strictEqual(rowA.landedCost, 200);
    assert.strictEqual(rowB.landedCost, 100);

    // Par quantité : 6 unités → A 2/6 → 100, B 4/6 → 200.
    const byQuantity = await shipmentService.getLandedCostAllocation({
      tenantId: tenant._id, shipmentId: shipment._id, method: 'quantity',
    });
    const qA = byQuantity.allocations.find((r) => String(r.product) === String(productA._id));
    const qB = byQuantity.allocations.find((r) => String(r.product) === String(productB._id));
    assert.strictEqual(qA.landedCost, 100);
    assert.strictEqual(qB.landedCost, 200);
  });

  test('facture : dérivation des réceptions, paiements et dette fournisseur', async () => {
    const invoice = await invoiceService.createInvoice({
      tenantId: tenant._id, supplierId: supplier._id,
      invoiceNumber: `FAC-${SUFFIX}`.toUpperCase().slice(0, 12),
      purchaseOrderIds: [order._id],
    });
    assert.strictEqual(invoice.status, 'draft');
    assert.strictEqual(invoice.lines.length, 2, 'lignes dérivées des réceptions');
    assert.strictEqual(invoice.subtotal, 3000, '2×1000 + 4×250');
    assert.strictEqual(invoice.totalAmount, 3000);

    const summaryBefore = await invoiceService.getPayableSummary({
      tenantId: tenant._id, supplierId: supplier._id,
    });
    assert.strictEqual(summaryBefore.length, 0, 'une facture draft n\'est pas exigible');

    const posted = await invoiceService.postInvoice({ tenantId: tenant._id, invoiceId: invoice._id });
    assert.strictEqual(posted.status, 'posted');

    const summaryPosted = await invoiceService.getPayableSummary({
      tenantId: tenant._id, supplierId: supplier._id,
    });
    assert.strictEqual(summaryPosted[0].due, 3000);

    const partial = await invoiceService.registerInvoicePayment({
      tenantId: tenant._id, invoiceId: invoice._id, amount: 1000, method: 'bank_transfer',
    });
    assert.strictEqual(partial.status, 'partially_paid');
    assert.strictEqual(partial.paidAmount, 1000);

    const full = await invoiceService.registerInvoicePayment({
      tenantId: tenant._id, invoiceId: invoice._id, amount: 2000, method: 'bank_transfer',
    });
    assert.strictEqual(full.status, 'paid');
    assert.strictEqual(full.paidAmount, 3000);

    await assert.rejects(
      invoiceService.registerInvoicePayment({
        tenantId: tenant._id, invoiceId: invoice._id, amount: 1,
      }),
      (err) => err.statusCode === 409
    );
  });

  test('écarts commande/réception ↔ facture détectés', async () => {
    const invoice = await invoiceService.createInvoice({
      tenantId: tenant._id, supplierId: supplier._id,
      invoiceNumber: `FACB-${SUFFIX}`.toUpperCase().slice(0, 12),
      purchaseOrderIds: [order._id],
      lines: [
        { product: productA._id, quantity: 3, unitCost: 1100 }, // reçu 2 @ 1000
      ],
    });
    const result = await invoiceService.detectDiscrepancies({
      tenantId: tenant._id, invoiceId: invoice._id,
    });
    assert.strictEqual(result.count, 2, 'quantité ET coût unitaire divergent');
    const kinds = result.discrepancies.map((d) => d.kind).sort();
    assert.deepStrictEqual(kinds, ['quantity', 'unit_cost']);
  });
}
