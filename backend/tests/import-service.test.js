/**
 * Tests des imports produits (Phase 7.8) — `node:test`.
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
  const Product = require('../models/productModel');
  const ImportJob = require('../models/importJobModel');
  const importService = require('../services/importService');

  const SUFFIX = Date.now().toString(36);
  let tenant;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Imp ${SUFFIX}`, ownerName: 'T', ownerEmail: `imp-${SUFFIX}@t.io`,
      code: `IMP${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
  });

  test.after(async () => {
    await ImportJob.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('upload : validation par ligne avec erreurs explicites (aperçu)', async () => {
    const job = await importService.uploadProducts({
      tenantId: tenant._id,
      rows: [
        { name: 'Chaise', description: 'Chaise en bois', category: 'Meubles', price: 15000, sku: `IMP-A-${SUFFIX}` },
        { name: '', description: 'Sans nom', category: 'Meubles', price: 5000 },
        { name: 'Table', description: 'Table', category: 'Meubles', price: -10 },
      ],
    });
    assert.strictEqual(job.status, 'uploaded', 'des lignes invalides bloquent la validation');
    assert.strictEqual(job.stats.total, 3);
    assert.strictEqual(job.stats.valid, 1);
    assert.strictEqual(job.stats.invalid, 2);
    const invalidRows = job.rows.filter((row) => row.status === 'invalid');
    assert.strictEqual(invalidRows.length, 2);
    assert.ok(invalidRows[0].errors.some((error) => error.field === 'name'));

    await assert.rejects(
      importService.confirmImport({ tenantId: tenant._id, importId: job._id }),
      (err) => err.statusCode === 409,
      'un import avec erreurs ne se confirme pas'
    );
  });

  test('CSV : parsing en-tête + lignes, statut validé si aucune erreur', async () => {
    const csv = [
      'name,description,category,price,sku,stock',
      `Chaise ${SUFFIX},Chaise bois,Meubles,15000,IMP-CSV-${SUFFIX},5`,
      `Armoire ${SUFFIX},Armoire,Meubles,30000,,2`,
    ].join('\n');
    const job = await importService.uploadProducts({ tenantId: tenant._id, csv, fileName: 'produits.csv' });
    assert.strictEqual(job.status, 'validated');
    assert.strictEqual(job.stats.valid, 2);
    assert.strictEqual(job.rows[0].data.stock, '5');
  });

  test('run : création par lots, idempotence SKU, points de contrôle', async () => {
    const csv = [
      'name,description,category,price,sku,stock',
      `Bureau ${SUFFIX},Bureau,Meubles,20000,IMP-RUN-${SUFFIX},3`,
    ].join('\n');
    const job = await importService.uploadProducts({ tenantId: tenant._id, csv });
    await importService.confirmImport({ tenantId: tenant._id, importId: job._id });
    await importService.startImport({ tenantId: tenant._id, importId: job._id });

    let done = null;
    for (let i = 0; i < 100; i += 1) {
      done = await ImportJob.findById(job._id).lean();
      if (done.status === 'completed' || done.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.strictEqual(done.status, 'completed', done.error || '');
    assert.strictEqual(done.stats.created, 1);
    assert.strictEqual(done.checkpointProcessed, 1);

    const product = await Product.findOne({ tenantId: tenant._id, sku: `IMP-RUN-${SUFFIX}` }).lean();
    assert.ok(product, 'produit créé');
    assert.strictEqual(product.stock, 3);

    // Rejeu : le même import re-exécuté n'entraîne aucune création (idempotence SKU).
    const again = await importService.uploadProducts({ tenantId: tenant._id, csv });
    await importService.confirmImport({ tenantId: tenant._id, importId: again._id });
    await importService.startImport({ tenantId: tenant._id, importId: again._id });
    let doneAgain = null;
    for (let i = 0; i < 100; i += 1) {
      doneAgain = await ImportJob.findById(again._id).lean();
      if (doneAgain.status === 'completed' || doneAgain.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.strictEqual(doneAgain.stats.created, 0);
    assert.strictEqual(doneAgain.stats.skipped, 1);
    assert.strictEqual(await Product.countDocuments({ tenantId: tenant._id, sku: `IMP-RUN-${SUFFIX}` }), 1);
  });

  test('isolation tenant et limites', async () => {
    const job = await importService.uploadProducts({
      tenantId: tenant._id,
      rows: [{ name: 'X', description: 'X', category: 'C', price: 1 }],
    });
    await assert.rejects(
      importService.getImport({ tenantId: new mongoose.Types.ObjectId(), importId: job._id }),
      (err) => err.statusCode === 404
    );
    await assert.rejects(
      importService.uploadProducts({ tenantId: tenant._id, rows: [] }),
      (err) => err.statusCode === 400
    );
  });
}
