/**
 * Tests du InventoryService (Phase 4.2a) — suite `node:test`.
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
  const { issueStock, receiveStock, getBalance } = require('../services/inventoryService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, product;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({ name: `Inv ${SUFFIX}`, ownerName: 'T', ownerEmail: `inv-${SUFFIX}@t.io`, code: `INV${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial' });
    location = await Location.create({ tenantId: tenant._id, name: 'Boutique principale', code: `L${SUFFIX}`.slice(0, 10), type: 'store' });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit Inv ${SUFFIX}`, description: 'Test service inventaire',
      category: 'Meubles', price: 10000, costPrice: 5000, stock: 10,
    });
  });

  test.after(async () => {
    await StockMovement.deleteMany({ tenantId: tenant._id });
    await InventoryBalance.deleteMany({ tenantId: tenant._id });
    await ProductVariant.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('balance initialisée depuis Product.stock', async () => {
    const balance = await getBalance({ tenantId: tenant._id, locationId: location._id, productId: product._id });
    assert.strictEqual(balance.onHand, 10);
    assert.strictEqual(balance.available, 10);
  });

  test('issueStock décrémente balance + produit + mouvement', async () => {
    const result = await issueStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 4, unitCost: 5000, type: 'sale', referenceType: 'sale', referenceId: new mongoose.Types.ObjectId(),
    });
    assert.strictEqual(result.insufficient, false);
    assert.strictEqual(result.balance.onHand, 6);
    assert.strictEqual(result.movement.quantityDelta, -4);
    const prod = await Product.findById(product._id).lean();
    assert.strictEqual(prod.stock, 6);
  });

  test('issueStock insuffisant ne modifie rien', async () => {
    const before = await getBalance({ tenantId: tenant._id, locationId: location._id, productId: product._id });
    const result = await issueStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id, quantity: 100,
    });
    assert.strictEqual(result.insufficient, true);
    const after = await getBalance({ tenantId: tenant._id, locationId: location._id, productId: product._id });
    assert.strictEqual(after.onHand, before.onHand);
    const prod = await Product.findById(product._id).lean();
    assert.strictEqual(prod.stock, 6);
  });

  test('idempotence par clé : le rejeu ne décrémente pas deux fois', async () => {
    const key = `issue-test:${SUFFIX}`;
    const first = await issueStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 2, idempotencyKey: key,
    });
    assert.strictEqual(first.alreadyApplied, false);
    const replay = await issueStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 2, idempotencyKey: key,
    });
    assert.strictEqual(replay.alreadyApplied, true);
    const balance = await getBalance({ tenantId: tenant._id, locationId: location._id, productId: product._id });
    assert.strictEqual(balance.onHand, 4);
    const movements = await StockMovement.countDocuments({ tenantId: tenant._id, idempotencyKey: key });
    assert.strictEqual(movements, 1);
  });

  test('receiveStock incrémente balance + produit', async () => {
    const result = await receiveStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 5, type: 'purchase_receipt',
    });
    assert.strictEqual(result.balance.onHand, 9);
    const prod = await Product.findById(product._id).lean();
    assert.strictEqual(prod.stock, 9);
  });
}
