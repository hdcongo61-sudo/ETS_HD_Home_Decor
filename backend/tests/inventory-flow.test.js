/**
 * Tests des flux d'inventaire v2 (Phases 4.3-4.4) — suite `node:test`.
 *
 * Couvre : transferts (machine à états, idempotence, réception partielle,
 * conservation inter-boutiques) et inventaires physiques (instantané + écart).
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
  const StockTransfer = require('../models/stockTransferModel');
  const StockCount = require('../models/stockCountModel');
  const { receiveStock, ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const transferService = require('../services/transferService');
  const stockCountService = require('../services/stockCountService');

  const SUFFIX = Date.now().toString(36);
  let tenant, locationA, locationB, product;

  const sumBalances = async () => {
    const rows = await InventoryBalance.aggregate([
      { $match: { tenantId: tenant._id, productId: product._id } },
      { $group: { _id: null, total: { $sum: '$onHand' } } },
    ]);
    return rows.length ? rows[0].total : 0;
  };
  const balanceAt = async (locationId) => {
    const row = await InventoryBalance.findOne({ tenantId: tenant._id, productId: product._id, locationId }).lean();
    return row ? row.onHand : 0;
  };

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Flux ${SUFFIX}`, ownerName: 'T', ownerEmail: `flux-${SUFFIX}@t.io`,
      code: `FLX${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    locationA = await Location.create({
      tenantId: tenant._id, name: 'Boutique A', code: `FLA${SUFFIX}`.slice(0, 10), type: 'store',
    });
    locationB = await Location.create({
      tenantId: tenant._id, name: 'Boutique B', code: `FLB${SUFFIX}`.slice(0, 10), type: 'store',
    });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit Flux ${SUFFIX}`, description: 'Test flux inventaire',
      category: 'Meubles', price: 10000, costPrice: 5000, stock: 10,
    });
    // Solde d'ouverture sur la boutique A (comme le backfill) : la balance
    // est initialisée paresseusement depuis Product.stock.
    await ensureDefaultVariantAndBalance(tenant._id, locationA._id, product._id, null);
  });

  test.after(async () => {
    await StockCount.deleteMany({ tenantId: tenant._id });
    await StockTransfer.deleteMany({ tenantId: tenant._id });
    await StockMovement.deleteMany({ tenantId: tenant._id });
    await InventoryBalance.deleteMany({ tenantId: tenant._id });
    await ProductVariant.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('création de transfert : validations', async () => {
    const base = {
      tenantId: tenant._id, sourceLocationId: locationA._id, destinationLocationId: locationB._id,
      lines: [{ product: product._id, quantity: 1 }],
    };
    await assert.rejects(
      transferService.createTransfer({ ...base, destinationLocationId: locationA._id }),
      (err) => err.statusCode === 409
    );
    await assert.rejects(
      transferService.createTransfer({ ...base, lines: [] }),
      (err) => err.statusCode === 409
    );
    await assert.rejects(
      transferService.createTransfer({ ...base, sourceLocationId: new mongoose.Types.ObjectId() }),
      (err) => err.statusCode === 409
    );
  });

  test('expédition : sortie de la source, mouvement transfer_out', async () => {
    const transfer = await transferService.createTransfer({
      tenantId: tenant._id, sourceLocationId: locationA._id, destinationLocationId: locationB._id,
      lines: [{ product: product._id, quantity: 4, unitCost: 5000 }],
    });
    assert.strictEqual(transfer.status, 'draft');

    const shipped = await transferService.shipTransfer({ tenantId: tenant._id, transferId: transfer._id });
    assert.strictEqual(shipped.status, 'shipped');
    assert.strictEqual(shipped.lines[0].shippedQuantity, 4);
    assert.strictEqual(await balanceAt(locationA._id), 6);
    assert.strictEqual((await Product.findById(product._id).lean()).stock, 6);

    const movement = await StockMovement.findOne({
      tenantId: tenant._id, referenceType: 'stockTransfer', referenceId: transfer._id, type: 'transfer_out',
    }).lean();
    assert.ok(movement, 'mouvement transfer_out référencé');
    assert.strictEqual(movement.quantityDelta, -4);
  });

  test('réception : entrée à destination et conservation du total', async () => {
    const transfer = await StockTransfer.findOne({ tenantId: tenant._id, status: 'shipped' });
    const received = await transferService.receiveTransfer({ tenantId: tenant._id, transferId: transfer._id });

    assert.strictEqual(received.status, 'received');
    assert.strictEqual(received.lines[0].receivedQuantity, 4);
    assert.strictEqual(await balanceAt(locationB._id), 4);
    // Conservation : Σ balances inter-boutiques == avant (10) == Product.stock.
    assert.strictEqual(await sumBalances(), 10);
    assert.strictEqual((await Product.findById(product._id).lean()).stock, 10);

    // Un transfert reçu ne peut pas être re-reçu ni re-expédié.
    await assert.rejects(
      transferService.receiveTransfer({ tenantId: tenant._id, transferId: transfer._id }),
      (err) => err.statusCode === 409
    );
    await assert.rejects(
      transferService.shipTransfer({ tenantId: tenant._id, transferId: transfer._id }),
      (err) => err.statusCode === 409
    );
  });

  test('idempotence : une expédition ne peut pas être rejouée', async () => {
    const transfer = await transferService.createTransfer({
      tenantId: tenant._id, sourceLocationId: locationA._id, destinationLocationId: locationB._id,
      lines: [{ product: product._id, quantity: 2 }],
    });
    await transferService.shipTransfer({ tenantId: tenant._id, transferId: transfer._id });
    await assert.rejects(
      transferService.shipTransfer({ tenantId: tenant._id, transferId: transfer._id }),
      (err) => err.statusCode === 409
    );
    const outMovements = await StockMovement.countDocuments({
      tenantId: tenant._id, referenceId: transfer._id, type: 'transfer_out',
    });
    assert.strictEqual(outMovements, 1, 'une seule sortie enregistrée');
  });

  test('réception partielle puis complète (écart explicite)', async () => {
    // Réapprovisionnement A pour couvrir le transfert.
    await receiveStock({
      tenantId: tenant._id, locationId: locationA._id, productId: product._id,
      quantity: 10, type: 'purchase_receipt',
    });
    const transfer = await transferService.createTransfer({
      tenantId: tenant._id, sourceLocationId: locationA._id, destinationLocationId: locationB._id,
      lines: [{ product: product._id, quantity: 5 }],
    });
    await transferService.shipTransfer({ tenantId: tenant._id, transferId: transfer._id });

    const partial = await transferService.receiveTransfer({
      tenantId: tenant._id, transferId: transfer._id,
      receivedQuantities: { [String(product._id)]: 2 },
    });
    assert.strictEqual(partial.status, 'shipped', 'réception partielle → toujours shipped');
    assert.strictEqual(partial.lines[0].receivedQuantity, 2);
    assert.strictEqual(await balanceAt(locationB._id), 6);

    const done = await transferService.receiveTransfer({ tenantId: tenant._id, transferId: transfer._id });
    assert.strictEqual(done.status, 'received');
    assert.strictEqual(done.lines[0].receivedQuantity, 5);
    assert.strictEqual(await balanceAt(locationB._id), 9);

    // Écart inter-boutiques conservé.
    const productStock = (await Product.findById(product._id).lean()).stock;
    assert.strictEqual(await sumBalances(), productStock);
  });

  test('annulation avant expédition', async () => {
    const transfer = await transferService.createTransfer({
      tenantId: tenant._id, sourceLocationId: locationA._id, destinationLocationId: locationB._id,
      lines: [{ product: product._id, quantity: 3 }],
    });
    const cancelled = await transferService.cancelTransfer({ tenantId: tenant._id, transferId: transfer._id });
    assert.strictEqual(cancelled.status, 'cancelled');
    await assert.rejects(
      transferService.shipTransfer({ tenantId: tenant._id, transferId: transfer._id }),
      (err) => err.statusCode === 409
    );
  });

  test('inventaire physique : instantané puis publication de l\'écart', async () => {
    const counterId = new mongoose.Types.ObjectId();
    const approverId = new mongoose.Types.ObjectId();
    const count = await stockCountService.createCount({
      tenantId: tenant._id, locationId: locationA._id,
      productIds: [String(product._id)], reason: 'Inventaire trimestriel', userId: counterId,
    });
    assert.strictEqual(count.status, 'open');
    assert.strictEqual(count.lines[0].expectedQuantity, await balanceAt(locationA._id));

    const before = await balanceAt(locationA._id);
    const posted = await stockCountService.postCount({
      tenantId: tenant._id, countId: count._id,
      countedQuantities: { [String(product._id)]: before + 3 }, approverId,
    });
    assert.strictEqual(posted.status, 'posted');
    assert.strictEqual(posted.approver.toString(), approverId.toString());
    assert.strictEqual(posted.lines[0].countedQuantity, before + 3);
    assert.strictEqual(await balanceAt(locationA._id), before + 3);

    const movement = await StockMovement.findOne({
      tenantId: tenant._id, referenceType: 'stockCount', referenceId: count._id, type: 'adjustment_in',
    }).lean();
    assert.ok(movement, 'mouvement d\'ajustement référencé');
    assert.strictEqual(movement.quantityDelta, 3);

    await assert.rejects(
      stockCountService.postCount({
        tenantId: tenant._id, countId: count._id,
        countedQuantities: { [String(product._id)]: before + 3 }, approverId,
      }),
      (err) => err.statusCode === 409
    );
  });
}
