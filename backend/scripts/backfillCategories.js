/**
 * Backfill des catégories hiérarchiques (Phase 3).
 *
 * Complète les catégories existantes : normalizedName, slug, path, depth
 * (parentId reste null pour le legacy), puis synchronise les index
 * (l'ancien index {tenantId, name} est remplacé par {tenantId, parentId,
 * normalizedName}).
 *
 * Usage :
 *   node scripts/backfillCategories.js
 *   node scripts/backfillCategories.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/categoryModel');
const slugify = require('../utils/slugify');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await connectDB();
  console.log(`\n🏷️   Backfill catégories ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : ''}\n`);

  const categories = await Category.find({}).lean();
  let updated = 0;

  for (const cat of categories) {
    const slug = slugify(cat.name || '');
    const normalized = (cat.name || '').trim().toLowerCase();
    const needs = !cat.normalizedName || !cat.slug || cat.path === undefined || cat.depth === undefined;
    if (!needs) continue;
    if (!DRY_RUN) {
      await Category.updateOne(
        { _id: cat._id },
        {
          $set: {
            normalizedName: normalized,
            slug,
            parentId: cat.parentId || null,
            path: cat.path !== undefined ? cat.path : `/${slug}`,
            depth: cat.depth !== undefined ? cat.depth : 0,
          },
        }
      );
    }
    updated += 1;
    console.log(`   ✏️  ${cat.name}`);
  }

  if (!DRY_RUN) {
    // Remplace l'ancien index {tenantId, name} par le nouveau (par niveau).
    await Category.syncIndexes();
    console.log('\n   🔧  Index catégories synchronisés');
  } else {
    console.log('\n   🔧  (dry-run) syncIndexes sautée');
  }

  console.log(`\n✅  Terminé : ${updated} catégorie(s) complétée(s).\n`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Backfill categories failed:', err);
  process.exit(1);
});
