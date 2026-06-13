/**
 * Create or promote a Super Admin user.
 *
 * Usage:
 *   node backend/scripts/createSuperAdmin.js --email you@example.com --password secret
 *   node backend/scripts/createSuperAdmin.js --promote --email existing@user.com
 *
 * Options:
 *   --email      Email of the super-admin (required)
 *   --password   Password for a NEW super-admin user (required when creating)
 *   --name       Name for new user (default: "Super Admin")
 *   --promote    Promote an existing user to super-admin instead of creating a new one
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

require('../models/userModel');
const User = mongoose.model('User');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email')    result.email    = args[++i];
    if (args[i] === '--password') result.password = args[++i];
    if (args[i] === '--name')     result.name     = args[++i];
    if (args[i] === '--promote')  result.promote  = true;
  }
  return result;
}

async function run() {
  const opts = parseArgs();

  if (!opts.email) {
    console.error('❌  --email is required');
    process.exit(1);
  }

  await connectDB();
  console.log('\n🔐  Super Admin Setup\n');

  if (opts.promote) {
    // ── Promote existing user ──
    const user = await User.findOne({ email: opts.email.toLowerCase() });
    if (!user) {
      console.error(`❌  No user found with email: ${opts.email}`);
      await mongoose.connection.close();
      process.exit(1);
    }

    user.isSuperAdmin = true;
    user.tenantId = null; // super-admins have no tenant
    await user.save({ validateBeforeSave: false });

    console.log(`✅  User "${user.name}" (${user.email}) promoted to Super Admin.`);
  } else {
    // ── Create new super-admin user ──
    if (!opts.password) {
      console.error('❌  --password is required when creating a new super-admin');
      await mongoose.connection.close();
      process.exit(1);
    }

    const existing = await User.findOne({ email: opts.email.toLowerCase(), tenantId: null });
    if (existing) {
      // Already exists — just make super-admin
      existing.isSuperAdmin = true;
      existing.tenantId = null;
      await existing.save({ validateBeforeSave: false });
      console.log(`✅  Existing user "${existing.name}" updated to Super Admin.`);
    } else {
      const user = new User({
        name:        opts.name || 'Super Admin',
        email:       opts.email.toLowerCase(),
        password:    opts.password,
        isAdmin:     true,
        isSuperAdmin: true,
        tenantId:    null,
        isActive:    true,
      });
      await user.save();
      console.log(`✅  Super Admin created:`);
      console.log(`    Name:  ${user.name}`);
      console.log(`    Email: ${user.email}`);
    }
  }

  console.log('\n   Log in at /login with these credentials.');
  console.log('   The Super Admin panel is at /super-admin\n');

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
