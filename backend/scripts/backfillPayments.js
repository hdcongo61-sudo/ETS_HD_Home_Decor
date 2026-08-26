/**
 * Migration des paiements embarqués vers la collection dédiée (Phase 5.8).
 *
 * Pour chaque vente, chaque paiement du tableau `sale.payments` est copié dans
 * `Payment` avec une clé d'idempotence déterministe `sale:{saleId}:payment:{i}`.
 * Idempotent : les paiements déjà migrés sont ignorés.
 *
 * Usage :
 *   node scripts/backfillPayments.js
 *   node scripts/backfillPayments.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/tenantModel');
const Sale = require('../models/saleModel');
const Payment = require('../models/paymentModel');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await connectDB();
  console.log(`\n💳  Migration des paiements embarqués ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : ''}\n`);

  const tenants = await Tenant.find({}).lean();
  let created = 0;
  let existing = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const sales = await Sale.find({ tenantId: tenant._id })
      .select('payments totalAmount locationId')
      .lean();
    for (const sale of sales) {
      const payments = Array.isArray(sale.payments) ? sale.payments : [];
      for (let i = 0; i < payments.length; i += 1) {
        const embedded = payments[i];
        const idempotencyKey = `sale:${sale._id}:payment:${i}`;
        const existingPayment = await Payment.findOne({ tenantId: tenant._id, idempotencyKey }).lean();
        if (existingPayment) {
          existing += 1;
          continue;
        }
        const method = ['cash', 'MobileMoney', 'credit', 'bank'].includes(embedded.method)
          ? embedded.method
          : 'cash';
        if (!Number.isFinite(embedded.amount) || embedded.amount <= 0) {
          skipped += 1;
          continue;
        }
        if (!DRY_RUN) {
          await Payment.create({
            tenantId: tenant._id,
            locationId: sale.locationId || null,
            saleId: sale._id,
            amount: embedded.amount,
            currency: 'XOF',
            method,
            status: 'completed',
            idempotencyKey,
            paidAt: embedded.paymentDate || sale.createdAt || new Date(),
            receivedBy: embedded.user || null,
            note: 'Migration des paiements embarqués',
          });
        }
        created += 1;
      }
    }
  }

  console.log(`   Créés: ${created} | Déjà migrés: ${existing} | Ignorés: ${skipped}`);
  console.log(DRY_RUN ? '\nℹ️  DRY-RUN — relancez sans --dry-run pour écrire.' : '\n✅  Migration terminée.');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('Erreur de migration :', error);
  try { await mongoose.connection.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
