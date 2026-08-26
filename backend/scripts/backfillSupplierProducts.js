/**
 * Migration 6.8 — références d'achat depuis les données fournisseur legacy.
 *
 * Pour chaque produit avec un `supplierName` renseigné (≠ « Non défini ») :
 * crée ou réutilise le fournisseur (nom normalisé) et crée le lien
 * SupplierProduct si absent. Rapport d'ambiguïté : produits sans fournisseur.
 * Idempotent. Usage : node scripts/backfillSupplierProducts.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/productModel');
const Supplier = require('../models/supplierModel');
const SupplierProduct = require('../models/supplierProductModel');

const DRY_RUN = process.argv.includes('--dry-run');
const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

async function run() {
  await connectDB();
  console.log(`\n🔗  Migration SupplierProduct ${DRY_RUN ? '(DRY-RUN)' : ''}\n`);

  const products = await Product.find({
    supplierName: { $exists: true, $ne: null, $ne: '', $ne: 'Non défini' },
  }).lean();

  let suppliersCreated = 0;
  let suppliersReused = 0;
  let linksCreated = 0;
  let linksExisting = 0;
  let ambiguous = 0;

  const supplierCache = new Map(); // tenantId:normalized → supplier

  for (const product of products) {
    const normalized = normalize(product.supplierName);
    if (!normalized) { ambiguous += 1; continue; }

    const cacheKey = `${product.tenantId}:${normalized}`;
    let supplier = supplierCache.get(cacheKey);
    if (!supplier) {
      supplier = await Supplier.findOne({ tenantId: product.tenantId, normalizedName: normalized }).lean();
      if (supplier) {
        suppliersReused += 1;
      } else {
        if (DRY_RUN) {
          // Placeholder de comptage : le dry-run doit refléter le même volume.
          supplier = { _id: new mongoose.Types.ObjectId() };
        } else {
          supplier = await Supplier.create({
            tenantId: product.tenantId, name: String(product.supplierName).trim(), normalizedName: normalized,
          });
        }
        suppliersCreated += 1;
      }
      if (supplier) supplierCache.set(cacheKey, supplier);
    }

    if (!supplier) continue;
    const existing = await SupplierProduct.findOne({
      tenantId: product.tenantId, supplierId: supplier._id, productId: product._id, variantId: null,
    }).lean();
    if (existing) { linksExisting += 1; continue; }

    if (!DRY_RUN) {
      await SupplierProduct.create({
        tenantId: product.tenantId, supplierId: supplier._id, productId: product._id,
        variantId: null, supplierSku: product.sku || '', lastCost: product.costPrice || 0,
        currency: 'XOF', minimumOrderQuantity: 1, leadTimeDays: 0, preferred: false, active: true,
      });
    }
    linksCreated += 1;
  }

  console.log(`   Fournisseurs créés: ${suppliersCreated} | réutilisés: ${suppliersReused}`);
  console.log(`   Liens créés: ${linksCreated} | déjà présents: ${linksExisting} | sans fournisseur: ${ambiguous}`);
  console.log(DRY_RUN ? '\nℹ️  DRY-RUN — relancez sans --dry-run.' : '\n✅  Terminé.');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('Erreur migration :', error.message);
  try { await mongoose.connection.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
