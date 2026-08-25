/**
 * Backfill des variantes (Phase 3) : une variante par défaut par produit.
 *
 * Idempotent : ne crée que pour les produits sans aucune variante. Le SKU
 * legacy du produit est copié sur la variante (si présent).
 *
 * Usage :
 *   node scripts/backfillVariants.js
 *   node scripts/backfillVariants.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await connectDB();
  console.log(`\n🧬  Backfill variantes ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : ''}\n`);

  const products = await Product.find({}).select('_id tenantId sku').lean();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    const existing = await ProductVariant.countDocuments({ tenantId: product.tenantId, productId: product._id });
    if (existing > 0) {
      skipped += 1;
      continue;
    }
    if (!DRY_RUN) {
      try {
        await ProductVariant.create({
          tenantId: product.tenantId,
          productId: product._id,
          optionValues: {},
          sku: product.sku || undefined,
          barcodes: [],
          status: 'active',
          isDefault: true,
        });
      } catch (error) {
        errors += 1;
        console.log(`   ⚠️  ${product._id} : ${error.message}`);
        continue;
      }
    }
    created += 1;
  }

  console.log(`\n✅  Terminé : ${created} variante(s) créée(s), ${skipped} produit(s) déjà couvert(s), ${errors} erreur(s).\n`);
  await mongoose.disconnect();
  process.exit(errors === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('❌  Backfill variants failed:', err);
  process.exit(1);
});
