/**
 * Tests du coût moyen pondéré (Phase 5.6) — suite `node:test`.
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
  const { receiveStock, issueStock, ensureDefaultVariantAndBalance } = require('../services/inventoryService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, product;

  const currentCost = async () => (await Product.findById(product._id).lean()).costPrice;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Cost ${SUFFIX}`, ownerName: 'T', ownerEmail: `cost-${SUFFIX}@t.io`,
      code: `CST${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LCT${SUFFIX}`.slice(0, 10), type: 'store',
    });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit Cost ${SUFFIX}`, description: 'Test coût moyen',
      category: 'Meubles', price: 3000, costPrice: 100, stock: 10,
    });
    await ensureDefaultVariantAndBalance(tenant._id, location._id, product._id, null);
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

  test('réception avec coût : moyenne pondérée mise à jour sur le produit', async () => {
    const result = await receiveStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 5, unitCost: 200, type: 'purchase_receipt',
    });
    // (10×100 + 5×200) / 15 = 133.33
    assert.strictEqual(await currentCost(), 133.33);
    assert.strictEqual(result.movement.unitCost, 200);
    assert.strictEqual(result.movement.costImpact, 1000);
    const stock = (await Product.findById(product._id).lean()).stock;
    assert.strictEqual(stock, 15);
  });

  test('sortie sans coût fourni : COGS au coût moyen courant', async () => {
    const result = await issueStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 5, type: 'sale',
    });
    assert.strictEqual(result.movement.unitCost, 133.33, 'instantané du coût moyen');
    assert.strictEqual(result.movement.costImpact, -666.65, '-5 × 133.33');
    assert.strictEqual(await currentCost(), 133.33, 'une sortie ne change pas le coût');
    const stock = (await Product.findById(product._id).lean()).stock;
    assert.strictEqual(stock, 10);
  });

  test('entrée sans coût (retour) : coût courant conservé', async () => {
    const result = await receiveStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 2, type: 'sale_return',
    });
    assert.strictEqual(result.movement.unitCost, 133.33, 'coût courant utilisé');
    assert.strictEqual(await currentCost(), 133.33);
  });
}
