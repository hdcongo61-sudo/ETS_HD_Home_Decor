/**
 * Tests des suggestions de réapprovisionnement (Phase 6.7) — `node:test`.
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
  const Client = require('../models/clientModel');
  const Sale = require('../models/saleModel');
  const Supplier = require('../models/supplierModel');
  const SupplierProduct = require('../models/supplierProductModel');
  const PurchaseOrder = require('../models/purchaseOrderModel');
  const NumberSequence = require('../models/numberSequenceModel');
  const { ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const purchaseService = require('../services/purchaseService');
  const replenishmentService = require('../services/replenishmentService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, supplier, productA, productB, requester, approver;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Rep ${SUFFIX}`, ownerName: 'T', ownerEmail: `rep-${SUFFIX}@t.io`,
      code: `REP${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LRE${SUFFIX}`.slice(0, 10), type: 'store',
    });
    supplier = await Supplier.create({ tenantId: tenant._id, name: `Fournisseur Rep ${SUFFIX}` });
    const makeProduct = async (name, stock, minStockLevel) => {
      const product = await Product.create({
        tenantId: tenant._id, name, description: 'Test réappro',
        category: 'Meubles', price: 2000, costPrice: 1000, stock, minStockLevel,
      });
      await ensureDefaultVariantAndBalance(tenant._id, location._id, product._id, null);
      return product;
    };
    // A : disponible 2, min 5 → suggestion. B : disponible 10, min 5 → rien.
    productA = await makeProduct(`Produit A ${SUFFIX}`, 2, 5);
    productB = await makeProduct(`Produit B ${SUFFIX}`, 10, 5);

    await SupplierProduct.create({
      tenantId: tenant._id, supplierId: supplier._id, productId: productA._id,
      variantId: null, supplierSku: 'A-SKU', lastCost: 900,
      minimumOrderQuantity: 4, leadTimeDays: 3, preferred: true, active: true,
    });

    requester = await User.create({
      tenantId: tenant._id, name: 'Demandeur', email: `rep-req-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
    approver = await User.create({
      tenantId: tenant._id, name: 'Approbateur', email: `rep-app-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });

    // Demande récente : 2 unités de A vendues.
    const client = await Client.create({ tenantId: tenant._id, name: 'Client', email: `rep-c-${SUFFIX}@t.io` });
    await Sale.create({
      tenantId: tenant._id, locationId: location._id, client: client._id,
      products: [{ product: productA._id, quantity: 2, priceAtSale: 2000 }],
      totalAmount: 4000, paymentMethod: 'cash', user: requester._id,
      saleDate: new Date(), status: 'completed',
    });
  });

  test.after(async () => {
    await PurchaseOrder.deleteMany({ tenantId: tenant._id });
    await Sale.deleteMany({ tenantId: tenant._id });
    await Client.deleteMany({ tenantId: tenant._id });
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

  test('suggestion : stock sous minimum, commande ouverte déduite, MOQ appliquée', async () => {
    // Commande ouverte approuvée de 2 unités de A (non reçues).
    const order = await purchaseService.createOrder({
      tenantId: tenant._id, locationId: location._id, supplierId: supplier._id,
      lines: [{ product: productA._id, quantity: 2, unitCost: 900 }],
      userId: requester._id,
    });
    await purchaseService.submitOrder({ tenantId: tenant._id, orderId: order._id });
    await purchaseService.approveOrder({ tenantId: tenant._id, orderId: order._id, userId: approver._id });

    const suggestions = await replenishmentService.getSuggestions({
      tenantId: tenant._id, locationId: location._id,
    });
    assert.strictEqual(suggestions.length, 1, 'seul A est sous son minimum');
    const row = suggestions[0];
    assert.strictEqual(String(row.productId), String(productA._id));
    assert.strictEqual(row.available, 2);
    assert.strictEqual(row.onOrder, 2, 'commande ouverte déduite');
    // brut = 5 - 2 - 2 = 1 → MOQ 4 → suggéré 4.
    assert.strictEqual(row.suggestedQuantity, 4);
    assert.strictEqual(row.recentSales, 2, 'ventes 30 jours');
    assert.strictEqual(row.lastCost, 900);
    assert.strictEqual(row.leadTimeDays, 3);
    assert.strictEqual(String(row.supplierId), String(supplier._id));
  });

  test('réception de la commande → la suggestion se réévalue (onOrder 0)', async () => {
    const order = await PurchaseOrder.findOne({ tenantId: tenant._id }).lean();
    await purchaseService.receiveOrder({
      tenantId: tenant._id, orderId: order._id,
      receivedLines: [{ productId: productA._id, quantity: 2 }],
    });

    const suggestions = await replenishmentService.getSuggestions({
      tenantId: tenant._id, locationId: location._id,
    });
    const row = suggestions.find((s) => String(s.productId) === String(productA._id));
    assert.ok(row, 'A toujours sous minimum (disponible 4 < 5)');
    assert.strictEqual(row.onOrder, 0);
    // brut = 5 - 4 - 0 = 1 → MOQ 4.
    assert.strictEqual(row.suggestedQuantity, 4);
  });
}
