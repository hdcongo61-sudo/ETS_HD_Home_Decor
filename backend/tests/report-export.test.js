/**
 * Tests reporting paginé + exports asynchrones (Phases 7.6-7.7) — `node:test`.
 *
 * Prérequis :
 *   RUN_TENANT_TESTS=1 + TEST_MONGO_URI (base de test dédiée).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs/promises');

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
  const ExportJob = require('../models/exportJobModel');
  const { ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const reportService = require('../services/reportService');
  const exportJobService = require('../services/exportJobService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, product;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `RepExp ${SUFFIX}`, ownerName: 'T', ownerEmail: `re-${SUFFIX}@t.io`,
      code: `REX${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LREX${SUFFIX}`.slice(0, 10), type: 'store',
    });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit RX ${SUFFIX}`, description: 'Test reporting',
      category: 'Meubles', price: 2000, costPrice: 100, stock: 5, minStockLevel: 2,
    });
    await ensureDefaultVariantAndBalance(tenant._id, location._id, product._id, null);
    const client = await Client.create({ tenantId: tenant._id, name: 'Client', email: `rx-c-${SUFFIX}@t.io` });
    const user = await User.create({
      tenantId: tenant._id, name: 'Vendeur', email: `rx-u-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    // Vente 1 (hier) : 2000 payée intégralement.
    await Sale.create({
      tenantId: tenant._id, locationId: location._id, client: client._id,
      products: [{ product: product._id, quantity: 1, priceAtSale: 2000 }],
      totalAmount: 2000, paymentMethod: 'cash', user: user._id,
      saleDate: yesterday, status: 'completed',
      payments: [{ amount: 2000, method: 'cash', paymentDate: yesterday }],
    });
    // Vente 2 (aujourd'hui) : 4000 dont 1000 payés.
    await Sale.create({
      tenantId: tenant._id, locationId: location._id, client: client._id,
      products: [{ product: product._id, quantity: 2, priceAtSale: 2000 }],
      totalAmount: 4000, paymentMethod: 'credit', user: user._id,
      saleDate: new Date(), status: 'partially_paid',
      payments: [{ amount: 1000, method: 'cash', paymentDate: new Date() }],
    });
    // Vente annulée : exclue des rapports (le hook pre-save recalcule le
    // statut depuis les paiements → on force `cancelled` après création).
    const cancelled = await Sale.create({
      tenantId: tenant._id, locationId: location._id, client: client._id,
      products: [{ product: product._id, quantity: 1, priceAtSale: 2000 }],
      totalAmount: 2000, paymentMethod: 'cash', user: user._id,
      saleDate: new Date(),
    });
    await Sale.updateOne({ _id: cancelled._id }, { $set: { status: 'cancelled' } });
  });

  test.after(async () => {
    await ExportJob.deleteMany({ tenantId: tenant._id });
    await Sale.deleteMany({ tenantId: tenant._id });
    await Client.deleteMany({ tenantId: tenant._id });
    await User.deleteMany({ tenantId: tenant._id });
    await StockMovement.deleteMany({ tenantId: tenant._id });
    await InventoryBalance.deleteMany({ tenantId: tenant._id });
    await ProductVariant.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await fs.rm(path.join(__dirname, '..', 'exports', String(tenant._id)), { recursive: true, force: true }).catch(() => {});
    await mongoose.disconnect();
  });

  test('rapport ventes par jour : totaux, encaissé, restant dû, annulées exclues', async () => {
    const report = await reportService.salesReport({
      tenantId: tenant._id, groupBy: 'day',
    });
    assert.strictEqual(report.periods.length, 2, 'deux jours distincts');
    assert.strictEqual(report.summary.orders, 2, 'la vente annulée est exclue');
    assert.strictEqual(report.summary.invoiced, 6000);
    assert.strictEqual(report.summary.collected, 3000);
    assert.strictEqual(report.summary.outstanding, 3000);

    await assert.rejects(
      reportService.salesReport({ tenantId: tenant._id, groupBy: 'hour' }),
      (err) => err.statusCode === 400
    );
  });

  test('rapport inventaire : valorisation au coût et filtre stock bas', async () => {
    const report = await reportService.inventoryReport({ tenantId: tenant._id });
    assert.strictEqual(report.summary.units, 5);
    assert.strictEqual(report.summary.value, 500, '5 × coût 100');
    assert.strictEqual(report.summary.lowStock, 0, 'disponible 5 ≥ min 2');
    const item = report.items.find((row) => String(row.productId) === String(product._id));
    assert.ok(item);
    assert.strictEqual(item.value, 500);

    const lowOnly = await reportService.inventoryReport({ tenantId: tenant._id, minStockOnly: true });
    assert.strictEqual(lowOnly.items.length, 0, 'aucun produit sous minimum');
  });

  test('export asynchrone : cycle de vie, jeton signé, expiration', async () => {
    const job = await exportJobService.createAndRun({
      tenantId: tenant._id, type: 'sales', filters: {},
    });
    assert.ok(['queued', 'running'].includes(job.status));

    // Attendre la complétion (tâche de fond).
    let completed = null;
    for (let i = 0; i < 100; i += 1) {
      completed = await ExportJob.findById(job._id).lean();
      if (completed.status === 'completed' || completed.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.strictEqual(completed.status, 'completed', completed.error || '');
    assert.strictEqual(completed.progress, 100);
    assert.strictEqual(completed.result.rows, 2, 'deux ventes exportées');

    // Mauvais jeton → 403.
    await assert.rejects(
      exportJobService.download({ tenantId: tenant._id, jobId: job._id, token: 'mauvais' }),
      (err) => err.statusCode === 403
    );
    // Bon jeton → contenu CSV.
    const download = await exportJobService.download({
      tenantId: tenant._id, jobId: job._id, token: completed.result.downloadToken,
    });
    assert.ok(download.content.startsWith('id,date,total'));
    assert.strictEqual(download.fileName, `sales-${job._id}.csv`);

    // Expiration → 410.
    await ExportJob.updateOne({ _id: job._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(
      exportJobService.download({
        tenantId: tenant._id, jobId: job._id, token: completed.result.downloadToken,
      }),
      (err) => err.statusCode === 410
    );

    // Isolation tenant : le job n'existe pas pour un autre tenant.
    const other = new mongoose.Types.ObjectId();
    await assert.rejects(
      exportJobService.getJob({ tenantId: other, jobId: job._id }),
      (err) => err.statusCode === 404
    );
  });
}
