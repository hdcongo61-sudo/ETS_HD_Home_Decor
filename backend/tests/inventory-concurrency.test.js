/**
 * Tests Phase 4.8 — concurrence, rollback transactionnel et permissions
 * inter-boutiques. Suite `node:test`.
 *
 * - deux ventes concurrentes sur la dernière unité : une seule réussit ;
 * - un rollback ne laisse ni mouvement ni solde partiel ;
 * - l'échec d'une ligne de transfert annule TOUTES les sorties ;
 * - les permissions à périmètre de boutique sont respectées.
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
  const User = require('../models/userModel');
  const Role = require('../models/roleModel');
  const Membership = require('../models/membershipModel');
  const { issueStock, ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const transferService = require('../services/transferService');
  const { authorize } = require('../services/authorization');

  const SUFFIX = Date.now().toString(36);
  let tenant, locationA, locationB;
  let productLast, productRollback, productTransfer;

  const balanceAt = async (locationId, productId) => {
    const row = await InventoryBalance.findOne({ tenantId: tenant._id, productId, locationId }).lean();
    return row ? row.onHand : 0;
  };

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Conc ${SUFFIX}`, ownerName: 'T', ownerEmail: `conc-${SUFFIX}@t.io`,
      code: `CNC${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    locationA = await Location.create({
      tenantId: tenant._id, name: 'Boutique A', code: `CNA${SUFFIX}`.slice(0, 10), type: 'store',
    });
    locationB = await Location.create({
      tenantId: tenant._id, name: 'Boutique B', code: `CNB${SUFFIX}`.slice(0, 10), type: 'store',
    });
    const makeProduct = async (name, stock) => {
      const product = await Product.create({
        tenantId: tenant._id, name, description: 'Test concurrence',
        category: 'Meubles', price: 1000, costPrice: 500, stock,
      });
      await ensureDefaultVariantAndBalance(tenant._id, locationA._id, product._id, null);
      return product;
    };
    productLast = await makeProduct(`Dernière unité ${SUFFIX}`, 1);
    productRollback = await makeProduct(`Rollback ${SUFFIX}`, 5);
    productTransfer = await makeProduct(`Transfert ${SUFFIX}`, 0);
  });

  test.after(async () => {
    await Membership.deleteMany({ tenantId: tenant._id });
    await Role.deleteMany({ tenantId: tenant._id });
    await User.deleteMany({ tenantId: tenant._id });
    await StockTransfer.deleteMany({ tenantId: tenant._id });
    await StockMovement.deleteMany({ tenantId: tenant._id });
    await InventoryBalance.deleteMany({ tenantId: tenant._id });
    await ProductVariant.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('deux ventes concurrentes sur la dernière unité : une seule réussit', async () => {
    const attempts = await Promise.allSettled([
      issueStock({
        tenantId: tenant._id, locationId: locationA._id, productId: productLast._id,
        quantity: 1, type: 'sale', idempotencyKey: `race-a:${SUFFIX}`,
      }),
      issueStock({
        tenantId: tenant._id, locationId: locationA._id, productId: productLast._id,
        quantity: 1, type: 'sale', idempotencyKey: `race-b:${SUFFIX}`,
      }),
    ]);

    const successes = attempts.filter(
      (attempt) => attempt.status === 'fulfilled' && attempt.value.insufficient === false
    );
    assert.strictEqual(successes.length, 1, 'exactement une sortie réussie');

    const othersRejected = attempts
      .filter((attempt) => attempt.status !== 'fulfilled')
      .length;
    const othersInsufficient = attempts
      .filter((attempt) => attempt.status === 'fulfilled' && attempt.value.insufficient === true)
      .length;
    assert.strictEqual(othersRejected + othersInsufficient, 1, 'l\'autre tentative a échoué proprement');

    assert.strictEqual(await balanceAt(locationA._id, productLast._id), 0);
    assert.strictEqual((await Product.findById(productLast._id).lean()).stock, 0);
    const movements = await StockMovement.countDocuments({
      tenantId: tenant._id, product: productLast._id, type: 'sale',
    });
    assert.strictEqual(movements, 1, 'un seul mouvement enregistré');
  });

  test('rollback transactionnel : aucune trace (ni mouvement ni solde partiel)', async () => {
    const before = await balanceAt(locationA._id, productRollback._id);
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await issueStock({
        tenantId: tenant._id, locationId: locationA._id, productId: productRollback._id,
        quantity: 2, type: 'sale', idempotencyKey: `rollback:${SUFFIX}`,
      }, session);
      // Simulation d'une défaillance aval : la transaction est annulée.
      await session.abortTransaction();
    } finally {
      session.endSession();
    }

    const after = await balanceAt(locationA._id, productRollback._id);
    assert.strictEqual(after, before, 'solde inchangé');
    assert.strictEqual((await Product.findById(productRollback._id).lean()).stock, before);
    const movements = await StockMovement.countDocuments({
      tenantId: tenant._id, idempotencyKey: `rollback:${SUFFIX}`,
    });
    assert.strictEqual(movements, 0, 'aucun mouvement résiduel');
  });

  test('transfert : une ligne en échec annule toutes les sorties', async () => {
    const transfer = await transferService.createTransfer({
      tenantId: tenant._id, sourceLocationId: locationA._id, destinationLocationId: locationB._id,
      lines: [
        { product: productRollback._id, quantity: 2 },
        { product: productTransfer._id, quantity: 1 }, // stock 0 → échec
      ],
    });

    const beforeRollback = await balanceAt(locationA._id, productRollback._id);
    await assert.rejects(
      transferService.shipTransfer({ tenantId: tenant._id, transferId: transfer._id }),
      (err) => err.statusCode === 409
    );

    // La première ligne a été restaurée (rollback complet).
    assert.strictEqual(await balanceAt(locationA._id, productRollback._id), beforeRollback);
    const outMovements = await StockMovement.countDocuments({
      tenantId: tenant._id, referenceId: transfer._id, type: 'transfer_out',
    });
    assert.strictEqual(outMovements, 0, 'aucune sortie résiduelle');

    const fresh = await StockTransfer.findById(transfer._id).lean();
    assert.strictEqual(fresh.status, 'draft', 'le transfert reste en draft');
  });

  test('permissions inter-boutiques : périmètre de la membership respecté', async () => {
    const staff = await User.create({
      tenantId: tenant._id, name: 'Vendeur scoped', email: `scoped-${SUFFIX}@t.io`,
      password: 'staff-pass', isAdmin: false, isActive: true,
    });
    const role = await Role.create({
      tenantId: tenant._id, key: `inv-${SUFFIX}`, name: 'Inventoriste',
      permissions: ['inventory.transfer'], isSystem: false,
    });
    await Membership.create({
      tenantId: tenant._id, userId: staff._id, status: 'active',
      roleIds: [role._id], allLocations: false, locationIds: [locationA._id],
    });

    const allowed = await authorize({
      tenantId: tenant._id, userId: staff._id,
      permission: 'inventory.transfer', locationId: locationA._id,
    });
    assert.strictEqual(allowed.allowed, true, 'autorisé dans sa boutique');

    const outOfScope = await authorize({
      tenantId: tenant._id, userId: staff._id,
      permission: 'inventory.transfer', locationId: locationB._id,
    });
    assert.strictEqual(outOfScope.allowed, false);
    assert.strictEqual(outOfScope.reason, 'location-out-of-scope');

    const forbidden = await authorize({
      tenantId: tenant._id, userId: staff._id, permission: 'inventory.adjust',
      locationId: locationA._id,
    });
    assert.strictEqual(forbidden.allowed, false);
    assert.strictEqual(forbidden.reason, 'forbidden');
  });
}
