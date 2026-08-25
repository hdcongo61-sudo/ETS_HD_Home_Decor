/**
 * Backfill des Memberships (Phase 2.3).
 *
 * Pour chaque organisation : crée les rôles système (`owner` = propriétaire
 * avec `*`, `staff` = vendeur sans permissions) puis une membership pour
 * chaque utilisateur existant (owner si isAdmin, staff sinon). Idempotent.
 *
 * Usage :
 *   node scripts/backfillMemberships.js
 *   node scripts/backfillMemberships.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/tenantModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const Membership = require('../models/membershipModel');

const DRY_RUN = process.argv.includes('--dry-run');

const SYSTEM_ROLES = [
  { key: 'owner', name: 'Propriétaire', description: 'Accès complet à l’organisation.', permissions: ['*'] },
  { key: 'staff', name: 'Vendeur', description: 'Accès de base.', permissions: [] },
];

async function run() {
  await connectDB();
  console.log(`\n👥  Backfill Memberships ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : ''}\n`);

  const tenants = await Tenant.find({}).lean();
  let rolesCreated = 0;
  let membershipsCreated = 0;
  let membershipsExisting = 0;

  for (const tenant of tenants) {
    const roleMap = {};
    for (const def of SYSTEM_ROLES) {
      let role = await Role.findOne({ tenantId: tenant._id, key: def.key }).lean();
      if (!role) {
        if (!DRY_RUN) {
          role = await Role.create({ tenantId: tenant._id, ...def, isSystem: true });
        }
        rolesCreated += 1;
        console.log(`   ➕ rôle ${def.key} pour ${tenant.name || tenant.code}`);
      }
      if (role) roleMap[def.key] = role;
    }

    const users = await User.find({ tenantId: tenant._id }).lean();
    for (const user of users) {
      const existing = await Membership.findOne({ tenantId: tenant._id, userId: user._id }).lean();
      if (existing) {
        membershipsExisting += 1;
        continue;
      }
      if (!DRY_RUN) {
        const target = user.isAdmin ? 'owner' : 'staff';
        await Membership.create({
          tenantId: tenant._id,
          userId: user._id,
          status: 'active',
          roleIds: roleMap[target] ? [roleMap[target]._id] : [],
          allLocations: true,
          joinedAt: user.createdAt || new Date(),
        });
      }
      membershipsCreated += 1;
    }
  }

  console.log(`\n✅  Terminé : ${rolesCreated} rôle(s) créé(s), ${membershipsCreated} membership(s) créée(s), ${membershipsExisting} déjà présente(s).\n`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Backfill memberships failed:', err);
  process.exit(1);
});
