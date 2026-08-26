/**
 * Tests fournisseurs et références d'achat (Phases 6.1-6.2) — `node:test`.
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
  const Supplier = require('../models/supplierModel');
  const SupplierProduct = require('../models/supplierProductModel');
  const supplierService = require('../services/supplierService');

  const SUFFIX = Date.now().toString(36);
  let tenant, product;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Sup ${SUFFIX}`, ownerName: 'T', ownerEmail: `sup-${SUFFIX}@t.io`,
      code: `SUP${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    product = await Product.create({
      tenantId: tenant._id, name: `Produit Sup ${SUFFIX}`, description: 'Test fournisseur',
      category: 'Meubles', price: 10000, costPrice: 5000, stock: 0,
    });
  });

  test.after(async () => {
    await SupplierProduct.deleteMany({ tenantId: tenant._id });
    await Supplier.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('création fournisseur + détection de doublon insensible à la casse', async () => {
    const supplier = await supplierService.createSupplier({
      tenantId: tenant._id,
      data: { name: 'Meubles de Dakar', code: 'MDK', currency: 'XOF', leadTimeDays: 7 },
    });
    assert.strictEqual(supplier.normalizedName, 'meubles de dakar');
    assert.strictEqual(supplier.currency, 'XOF');

    await assert.rejects(
      supplierService.createSupplier({
        tenantId: tenant._id,
        data: { name: '  meubles   DE DAKAR ' },
      }),
      (err) => err.statusCode === 409
    );
  });

  test('mise à jour fournisseur (coordonnées et statut)', async () => {
    const supplier = await Supplier.findOne({ tenantId: tenant._id }).lean();
    const updated = await supplierService.updateSupplier({
      tenantId: tenant._id, supplierId: supplier._id,
      data: { phone: '771234567', status: 'inactive', email: 'contact@mdk.sn' },
    });
    assert.strictEqual(updated.phone, '771234567');
    assert.strictEqual(updated.status, 'inactive');
    assert.strictEqual(updated.email, 'contact@mdk.sn');
  });

  test('référence d\'achat : création, doublon, mise à jour, suppression', async () => {
    const supplier = await Supplier.findOne({ tenantId: tenant._id }).lean();

    const link = await supplierService.createSupplierProduct({
      tenantId: tenant._id,
      data: {
        supplierId: supplier._id, productId: product._id,
        supplierSku: 'SKU-MDK-1', lastCost: 4500, minimumOrderQuantity: 5, preferred: true,
      },
    });
    assert.strictEqual(link.preferred, true);
    assert.strictEqual(link.lastCost, 4500);

    await assert.rejects(
      supplierService.createSupplierProduct({
        tenantId: tenant._id,
        data: { supplierId: supplier._id, productId: product._id },
      }),
      (err) => err.statusCode === 409
    );

    const updated = await supplierService.updateSupplierProduct({
      tenantId: tenant._id, supplierProductId: link._id,
      data: { lastCost: 4300, preferred: false },
    });
    assert.strictEqual(updated.lastCost, 4300);
    assert.strictEqual(updated.preferred, false);

    const list = await supplierService.listSupplierProducts({
      tenantId: tenant._id, supplierId: supplier._id,
    });
    assert.strictEqual(list.length, 1);
    assert.ok(list[0].productId && list[0].productId.name, 'produit populé');

    await supplierService.deleteSupplierProduct({ tenantId: tenant._id, supplierProductId: link._id });
    assert.strictEqual(await SupplierProduct.countDocuments({ tenantId: tenant._id }), 0);
  });

  test('validations : fournisseur/produit hors tenant rejetés', async () => {
    const supplier = await Supplier.findOne({ tenantId: tenant._id }).lean();
    await assert.rejects(
      supplierService.createSupplierProduct({
        tenantId: tenant._id,
        data: { supplierId: new mongoose.Types.ObjectId(), productId: product._id },
      }),
      (err) => err.statusCode === 409
    );
    await assert.rejects(
      supplierService.createSupplierProduct({
        tenantId: tenant._id,
        data: { supplierId: supplier._id, productId: new mongoose.Types.ObjectId() },
      }),
      (err) => err.statusCode === 409
    );
  });
}
