/**
 * Tests de reverseMovement (Phase 4.6) — suite `node:test`.
 *
 * L'annulation est append-only : le mouvement d'origine reste intact, un
 * mouvement de sens contraire (référencé `reversal`) est ajouté.
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
  const {
    issueStock, receiveStock, getBalance, reverseMovement, ensureDefaultVariantAndBalance,
  } = require('../services/inventoryService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, product;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Rev ${SUFFIX}`, ownerName: 'T', ownerEmail: `rev-${SUFFIX}@t.io`,
      code: `REV${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LR${SUFFIX}`.slice(0, 10), type: 'store',
    });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit Rev ${SUFFIX}`, description: 'Test annulation mouvement',
      category: 'Meubles', price: 10000, costPrice: 5000, stock: 10,
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

  test('annulation d\'une sortie : stock et balance restaurés, mouvement intact', async () => {
    const issued = await issueStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 3, type: 'sale', referenceType: 'sale', referenceId: new mongoose.Types.ObjectId(),
    });
    assert.strictEqual(issued.balance.onHand, 7);

    const reversed = await reverseMovement({
      tenantId: tenant._id, movementId: issued.movement._id,
    });
    assert.strictEqual(reversed.alreadyApplied, false);

    const balance = await getBalance({ tenantId: tenant._id, locationId: location._id, productId: product._id });
    assert.strictEqual(balance.onHand, 10);
    assert.strictEqual((await Product.findById(product._id).lean()).stock, 10);

    // Le mouvement d'origine reste inchangé ; l'annulation le référence.
    const original = await StockMovement.findById(issued.movement._id).lean();
    assert.strictEqual(original.quantityDelta, -3);
    assert.strictEqual(reversed.movement.referenceType, 'reversal');
    assert.strictEqual(String(reversed.movement.referenceId), String(original._id));
    assert.strictEqual(reversed.movement.quantityDelta, 3);
    assert.strictEqual(reversed.movement.type, 'sale_return');
  });

  test('idempotence : la même annulation ne peut pas être rejouée', async () => {
    const issued = await issueStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 2, type: 'sale',
    });
    await reverseMovement({ tenantId: tenant._id, movementId: issued.movement._id });
    const replay = await reverseMovement({ tenantId: tenant._id, movementId: issued.movement._id });
    assert.strictEqual(replay.alreadyApplied, true);

    const reversals = await StockMovement.countDocuments({
      tenantId: tenant._id, referenceType: 'reversal', referenceId: issued.movement._id,
    });
    assert.strictEqual(reversals, 1);
  });

  test('annulation d\'une entrée : ajustement négatif', async () => {
    const received = await receiveStock({
      tenantId: tenant._id, locationId: location._id, productId: product._id,
      quantity: 5, type: 'purchase_receipt',
    });
    const before = await getBalance({ tenantId: tenant._id, locationId: location._id, productId: product._id });
    assert.strictEqual(before.onHand, 15);

    const reversed = await reverseMovement({
      tenantId: tenant._id, movementId: received.movement._id,
    });
    assert.strictEqual(reversed.movement.type, 'adjustment_out');
    assert.strictEqual(reversed.movement.quantityDelta, -5);
    const after = await getBalance({ tenantId: tenant._id, locationId: location._id, productId: product._id });
    assert.strictEqual(after.onHand, 10);
    assert.strictEqual((await Product.findById(product._id).lean()).stock, 10);
  });
}
