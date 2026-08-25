/**
 * Backfill des Locations (Phase 2).
 *
 * Pour chaque tenant existant, crée une Location par défaut « Boutique
 * principale » (idempotent : détecte par code unique) puis rattache
 * `locationId` aux ventes, dépenses, transactions de caisse et mouvements de
 * stock qui n'en ont pas encore.
 *
 * Usage :
 *   node scripts/backfillLocations.js            # applique
 *   node scripts/backfillLocations.js --dry-run  # rapport sans écriture
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/tenantModel');
const Location = require('../models/locationModel');
const Sale = require('../models/saleModel');
const Expense = require('../models/expenseModel');
const BankTransaction = require('../models/bankTransactionModel');
const StockMovement = require('../models/stockMovementModel');

const DRY_RUN = process.argv.includes('--dry-run');

const cleanCode = (value, fallback) => {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return raw || fallback;
};

async function run() {
  await connectDB();
  console.log(`\n📍  Backfill Locations ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : ''}\n`);

  const tenants = await Tenant.find({}).lean();
  let created = 0;
  let existing = 0;

  for (const tenant of tenants) {
    const code = cleanCode(tenant.code || tenant.slug, 'MAIN');
    let location = await Location.findOne({ tenantId: tenant._id, code }).lean();

    if (!location) {
      if (!DRY_RUN) {
        location = await Location.create({
          tenantId: tenant._id,
          name: 'Boutique principale',
          code,
          type: 'store',
          isSalesLocation: true,
          isStockLocation: true,
          isActive: true,
        });
      }
      created += 1;
      console.log(`   ➕ ${tenant.name || tenant.code} → ${code}`);
    } else {
      existing += 1;
    }

    // Aperçu / rattachement des documents opérationnels (même en dry-run).
    const backfills = [
      [Sale, 'sales'],
      [Expense, 'expenses'],
      [BankTransaction, 'banktransactions'],
      [StockMovement, 'stockmovements'],
    ];
    for (const [Model, label] of backfills) {
      const count = await Model.countDocuments({ tenantId: tenant._id, locationId: null });
      if (count > 0) {
        if (!DRY_RUN && location) {
          await Model.updateMany({ tenantId: tenant._id, locationId: null }, { $set: { locationId: location._id } });
        }
        console.log(`      ${label}: ${count} à rattacher${DRY_RUN ? ' (dry-run)' : ''}`);
      }
    }
  }

  console.log(`\n✅  Terminé : ${created} créée(s), ${existing} déjà présente(s).\n`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Backfill failed:', err);
  process.exit(1);
});
