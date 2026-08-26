/**
 * Tests drapeaux de cutover + rapport de réconciliation (Phases 8.2 + 8.7).
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
  const Payment = require('../models/paymentModel');
  const Sale = require('../models/saleModel');
  const Client = require('../models/clientModel');
  const User = require('../models/userModel');
  const FeatureFlag = require('../models/featureFlagModel');
  const CutoverReport = require('../models/cutoverReportModel');
  const { ensureDefaultVariantAndBalance } = require('../services/inventoryService');
  const { recordPayment } = require('../services/paymentService');
  const featureFlagService = require('../services/featureFlagService');
  const reconciliationService = require('../services/reconciliationService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, product, sale;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Cut ${SUFFIX}`, ownerName: 'T', ownerEmail: `cut-${SUFFIX}@t.io`,
      code: `CUT${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LCU${SUFFIX}`.slice(0, 10), type: 'store',
    });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit Cut ${SUFFIX}`, description: 'Test cutover',
      category: 'Meubles', price: 2000, costPrice: 1000, stock: 4, sku: `CUT-${SUFFIX}`,
    });
    await ensureDefaultVariantAndBalance(tenant._id, location._id, product._id, null);
    const client = await Client.create({ tenantId: tenant._id, name: 'Client', email: `cut-c-${SUFFIX}@t.io` });
    const user = await User.create({
      tenantId: tenant._id, name: 'Vendeur', email: `cut-u-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
    sale = await Sale.create({
      tenantId: tenant._id, locationId: location._id, client: client._id,
      products: [{ product: product._id, quantity: 1, priceAtSale: 2000 }],
      totalAmount: 2000, paymentMethod: 'cash', user: user._id,
      saleDate: new Date(),
      payments: [{ amount: 1500, method: 'cash', paymentDate: new Date() }],
    });
    await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId: sale._id,
      amount: 1500, method: 'cash', idempotencyKey: `cut-pay:${SUFFIX}`,
    });
  });

  test.after(async () => {
    await CutoverReport.deleteMany({ tenantId: tenant._id });
    await FeatureFlag.deleteMany({ tenantId: tenant._id });
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

  test('drapeaux : défauts conservateurs, bascule et liste blanche', async () => {
    const initial = await featureFlagService.getFlags({ tenantId: tenant._id });
    assert.strictEqual(initial.flags['inventory.v2'], false, 'v2 désactivée par défaut');

    await featureFlagService.setFlag({ tenantId: tenant._id, key: 'inventory.v2', value: true });
    const updated = await featureFlagService.getFlags({ tenantId: tenant._id });
    assert.strictEqual(updated.flags['inventory.v2'], true);

    await assert.rejects(
      featureFlagService.setFlag({ tenantId: tenant._id, key: 'inconnu.v1', value: true }),
      (err) => err.statusCode === 404
    );
    await assert.rejects(
      featureFlagService.setFlag({ tenantId: tenant._id, key: 'sales.v2', value: 'oui' }),
      (err) => err.statusCode === 400
    );
  });

  test('rapport de réconciliation : stocks cohérents, finance et archives signées', async () => {
    const report = await reconciliationService.buildReport({ tenantId: tenant._id });
    assert.strictEqual(report.counts.products, 1);
    assert.strictEqual(report.counts.sales, 1);
    assert.strictEqual(report.stock.legacyUnits, 4, 'le hook de vente n\'a pas touché le stock');
    assert.strictEqual(report.stock.difference, 0, 'legacy == registre');
    assert.strictEqual(report.finance.invoiced, 2000);
    assert.strictEqual(report.finance.collected, 1500);
    assert.strictEqual(report.finance.outstanding, 500);
    assert.deepStrictEqual(report.orphans, { inventoryBalances: 0, stockMovements: 0, payments: 0 });
    assert.deepStrictEqual(report.exceptions, []);

    const archived = await reconciliationService.archiveReport({ tenantId: tenant._id });
    assert.ok(archived.archivedId);
    assert.ok(archived.checksum, 'checksum SHA-256 présent');

    const fetched = await reconciliationService.getReport({
      tenantId: tenant._id, reportId: archived.archivedId,
    });
    assert.strictEqual(fetched.checksumValid, true, 'intégrité du contenu vérifiée');

    const reports = await reconciliationService.listReports({ tenantId: tenant._id });
    assert.strictEqual(reports.length, 1);

    await assert.rejects(
      reconciliationService.getReport({
        tenantId: new mongoose.Types.ObjectId(), reportId: archived.archivedId,
      }),
      (err) => err.statusCode === 404
    );
  });

  test('dépréciation : en-têtes Deprecation/Sunset et registre publié', async () => {
    const { deprecate } = require('../middlewares/deprecation');
    const { DEPRECATIONS } = require('../config/deprecations');
    assert.ok(DEPRECATIONS.some((entry) => entry.path === '/api/products/import'), 'registre publié');

    const headers = {};
    let nextCalled = false;
    deprecate({
      since: '2026-01-01', sunset: '2026-12-31', replacement: '/api/v2/x',
    })({ method: 'POST', originalUrl: '/api/x' }, {
      set: (key, value) => { headers[key.toLowerCase()] = value; },
    }, () => { nextCalled = true; });

    assert.strictEqual(headers.deprecation, 'true');
    assert.strictEqual(headers['deprecation-since'], '2026-01-01');
    assert.strictEqual(headers.sunset, '2026-12-31');
    assert.ok(headers.link.includes('/api/v2/x'), 'lien successeur présent');
    assert.strictEqual(nextCalled, true);
  });
}
