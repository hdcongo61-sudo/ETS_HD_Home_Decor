/**
 * Seed des unités par défaut par organisation (Phase 3.3). Idempotent.
 *
 * Usage :
 *   node scripts/backfillUnits.js
 *   node scripts/backfillUnits.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/tenantModel');
const UnitOfMeasure = require('../models/unitOfMeasureModel');

const DRY_RUN = process.argv.includes('--dry-run');

const DEFAULT_UNITS = [
  { key: 'piece', name: 'Pièce', symbol: 'pce', unitClass: 'count', decimals: 0 },
  { key: 'carton', name: 'Carton', symbol: 'ctn', unitClass: 'count', decimals: 0 },
  { key: 'metre', name: 'Mètre', symbol: 'm', unitClass: 'length', decimals: 2 },
  { key: 'kg', name: 'Kilogramme', symbol: 'kg', unitClass: 'weight', decimals: 2 },
  { key: 'litre', name: 'Litre', symbol: 'L', unitClass: 'volume', decimals: 2 },
];

async function run() {
  await connectDB();
  console.log(`\n📏  Seed des unités ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : ''}\n`);

  const tenants = await Tenant.find({}).lean();
  let created = 0;
  let existing = 0;

  for (const tenant of tenants) {
    for (const def of DEFAULT_UNITS) {
      const found = await UnitOfMeasure.findOne({ tenantId: tenant._id, key: def.key }).lean();
      if (found) {
        existing += 1;
        continue;
      }
      if (!DRY_RUN) {
        await UnitOfMeasure.create({ tenantId: tenant._id, ...def });
      }
      created += 1;
      console.log(`   ➕ ${tenant.name || tenant.code} → ${def.key}`);
    }
  }

  console.log(`\n✅  Terminé : ${created} unité(s) créée(s), ${existing} déjà présente(s).\n`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Seed units failed:', err);
  process.exit(1);
});
