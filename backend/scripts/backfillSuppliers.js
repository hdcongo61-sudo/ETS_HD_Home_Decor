/**
 * Backfill des noms normalisés des fournisseurs (Phase 6.1).
 * Idempotent. Usage : node scripts/backfillSuppliers.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Supplier = require('../models/supplierModel');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await connectDB();
  console.log(`\n🏭  Normalisation des fournisseurs ${DRY_RUN ? '(DRY-RUN)' : ''}\n`);
  const suppliers = await Supplier.find({});
  let updated = 0;
  let skipped = 0;
  for (const supplier of suppliers) {
    const normalized = String(supplier.name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized || supplier.normalizedName === normalized) {
      skipped += 1;
      continue;
    }
    if (!DRY_RUN) {
      supplier.normalizedName = normalized;
      await supplier.save();
    }
    updated += 1;
  }
  console.log(`   Normalisés: ${updated} | Déjà conformes: ${skipped}`);
  console.log(DRY_RUN ? '\nℹ️  DRY-RUN — relancez sans --dry-run.' : '\n✅  Terminé.');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('Erreur backfill :', error.message);
  try { await mongoose.connection.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
