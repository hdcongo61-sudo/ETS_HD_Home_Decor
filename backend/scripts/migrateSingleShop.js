/**
 * Migration: Assign all existing data to a default tenant.
 *
 * Run ONCE when deploying multi-tenancy on an existing single-shop database:
 *   node backend/scripts/migrateSingleShop.js
 *
 * What it does:
 *  1. Creates a "default" Tenant document (or finds existing)
 *  2. Assigns tenantId to every User, Product, Sale, Client, etc.
 *  3. Marks the first admin user as the tenant owner
 *
 * Safe to re-run: skips documents that already have a tenantId.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Import all models so they register with Mongoose
require('../models/tenantModel');
require('../models/userModel');
require('../models/productModel');
require('../models/saleModel');
require('../models/clientModel');
require('../models/employeeModel');
require('../models/expenseModel');
require('../models/bankTransactionModel');
require('../models/adminRequestModel');
require('../models/documentModel');
require('../models/appSettingsModel');
require('../models/categoryModel');
require('../models/containerModel');
require('../models/warehouseModel');
require('../models/supplierModel');
require('../models/expenseCategoryModel');
require('../models/deletedSaleModel');
require('../models/loginHistoryModel');
require('../models/proformaModel');
require('../models/stockMovementModel');
require('../models/stockReplacementReminderModel');
require('../models/supportTicketModel');
require('../models/subscriptionPaymentModel');

const Tenant = mongoose.model('Tenant');
const User = mongoose.model('User');
const { TENANT_SCOPED_MODELS } = require('../utils/tenantCollections');

// Liste dérivée du registre central, sans User (migré séparément avec ses règles).
const MODELS_TO_MIGRATE = TENANT_SCOPED_MODELS.filter((name) => name !== 'User');

// `--dry-run` : compte les documents sans tenant sans rien modifier.
const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await connectDB();
  console.log(`\n🔄  Multi-tenancy migration starting...${DRY_RUN ? ' (DRY-RUN — aucune écriture)' : ''}\n`);

  // ── Step 0: Pré-vol — comptage des documents sans tenant par collection ──
  console.log('── Pré-vol : documents sans tenantId ──');
  for (const modelName of MODELS_TO_MIGRATE) {
    try {
      const Model = mongoose.model(modelName);
      const count = await Model.countDocuments({ tenantId: null });
      if (count > 0) console.log(`   ${modelName}: ${count}`);
    } catch (err) {
      console.warn(`   ⚠️  ${modelName}: ${err.message}`);
    }
  }
  const orphanUsers = await User.countDocuments({ tenantId: null, isSuperAdmin: { $ne: true } });
  if (orphanUsers > 0) console.log(`   User: ${orphanUsers}`);

  // ── Step 1: Find or create the default tenant ──
  let tenant = await Tenant.findOne({ code: 'DEFAULT' }).catch(() => null);

  if (!tenant) {
    // Find the first admin user to get shop info
    const adminUser = await User.findOne({ isAdmin: true, tenantId: null }).lean();

    const shopName = process.env.DEFAULT_SHOP_NAME || 'Ma Boutique';
    const ownerEmail = adminUser?.email || process.env.DEFAULT_OWNER_EMAIL || 'admin@shop.com';
    const ownerName = adminUser?.name || 'Propriétaire';

    tenant = await Tenant.create({
      name: shopName,
      ownerName,
      ownerEmail,
      code: 'DEFAULT',
      status: 'active',
      plan: 'pro',
      trialEndsAt: null,
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      branding: { appName: shopName },
    });

    console.log(`✅  Created default tenant: "${shopName}" (id: ${tenant._id}, code: ${tenant.code})`);
  } else {
    console.log(`ℹ️   Default tenant already exists: "${tenant.name}" (id: ${tenant._id})`);
  }

  const tenantId = tenant._id;

  // ── Step 2: Migrate Users ──
  const userResult = DRY_RUN
    ? { modifiedCount: 0 }
    : await User.updateMany(
        { tenantId: null, isSuperAdmin: { $ne: true } },
        { $set: { tenantId } }
      );
  console.log(`👤  Users migrated: ${DRY_RUN ? '(dry-run)' : userResult.modifiedCount}`);

  // ── Step 3: Migrate all other collections ──
  for (const modelName of MODELS_TO_MIGRATE) {
    try {
      const Model = mongoose.model(modelName);
      const result = DRY_RUN
        ? { modifiedCount: 0 }
        : await Model.updateMany(
            { tenantId: null },
            { $set: { tenantId } }
          );
      console.log(`📦  ${modelName}: ${DRY_RUN ? '(dry-run)' : result.modifiedCount + ' documents migrated'}`);
    } catch (err) {
      console.warn(`⚠️   Could not migrate ${modelName}:`, err.message);
    }
  }

  // ── Step 3b: Drop stale GLOBAL unique indexes that block multi-tenancy ──
  // Old single-shop schemas had unique indexes on fields that must now be
  // unique PER TENANT (email, appsettings.key, etc.). Drop the legacy ones
  // so the new compound { tenantId, ... } indexes can take over.
  const staleIndexes = [
    ['users', 'email_1'],
    ['appsettings', 'key_1'],
    ['clients', 'email_1'],
  ];
  if (DRY_RUN) {
    console.log('🧹  Index legacy à supprimer (ignorés en dry-run): ' +
      staleIndexes.map(([c, i]) => `${c}.${i}`).join(', '));
  } else {
    for (const [collection, indexName] of staleIndexes) {
      try {
        await mongoose.connection.db.collection(collection).dropIndex(indexName);
        console.log(`🧹  Dropped stale index ${collection}.${indexName}`);
      } catch (err) {
        if (err.codeName === 'IndexNotFound' || /index not found/i.test(err.message)) {
          // already gone — fine
        } else {
          console.warn(`⚠️   Could not drop ${collection}.${indexName}:`, err.message);
        }
      }
    }
  }

  // ── Step 4: Update tenant user count ──
  const userCount = await User.countDocuments({ tenantId });
  if (!DRY_RUN) {
    await Tenant.findByIdAndUpdate(tenantId, { 'stats.userCount': userCount });
  }
  console.log(`\n✅  Migration complete. ${userCount} users in default tenant.`);
  console.log(`\n🔑  Default tenant ID: ${tenantId}`);
  console.log('   Save this ID — you may need it for debugging.\n');

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
