/**
 * Initialisation du registre d'inventaire (Phase 4.1).
 *
 * Pour chaque produit avec un stock positif : balance d'ouverture (onHand =
 * Product.stock) sur la variante par défaut et la boutique par défaut du
 * tenant, + mouvement `opening` immuable avec clé d'idempotence déterministe.
 *
 * Idempotent (une balance par scope, une clé par mouvement).
 *
 * Usage :
 *   node scripts/backfillInventoryBalances.js
 *   node scripts/backfillInventoryBalances.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/tenantModel');
const Location = require('../models/locationModel');
const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');
const InventoryBalance = require('../models/inventoryBalanceModel');
const StockMovement = require('../models/stockMovementModel');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await connectDB();
  console.log(`\n📦  Ouverture du registre d'inventaire ${DRY_RUN ? '(DRY-RUN — aucune écriture)' : ''}\n`);

  const tenants = await Tenant.find({}).lean();
  let balancesCreated = 0;
  let balancesExisting = 0;
  let skippedNoLocation = 0;
  let skippedNoVariant = 0;

  for (const tenant of tenants) {
    const location = await Location.findOne({ tenantId: tenant._id, isActive: true }).sort({ createdAt: 1 }).lean();
    if (!location) {
      skippedNoLocation += 1;
      console.log(`   ⚠️  ${tenant.name || tenant.code} : aucune boutique (backfillLocations requis).`);
      continue;
    }

    const products = await Product.find({ tenantId: tenant._id, stock: { $gt: 0 } }).lean();
    for (const product of products) {
      const variant = await ProductVariant.findOne({ tenantId: tenant._id, productId: product._id, isDefault: true }).lean()
        || await ProductVariant.findOne({ tenantId: tenant._id, productId: product._id }).lean();
      if (!variant) {
        skippedNoVariant += 1;
        continue;
      }

      const existingBalance = await InventoryBalance.findOne({
        tenantId: tenant._id, locationId: location._id, variantId: variant._id,
      }).lean();
      if (existingBalance) {
        balancesExisting += 1;
        continue;
      }

      if (!DRY_RUN) {
        await InventoryBalance.create({
          tenantId: tenant._id,
          locationId: location._id,
          variantId: variant._id,
          productId: product._id,
          onHand: product.stock,
          reserved: 0,
          available: product.stock,
          version: 1,
        });
        await StockMovement.create({
          tenantId: tenant._id,
          locationId: location._id,
          product: product._id,
          variantId: variant._id,
          productName: product.name,
          type: 'opening',
          quantityDelta: product.stock,
          quantity: product.stock,
          unitCost: product.costPrice || 0,
          costImpact: 0,
          reason: 'correction',
          source: 'migration',
          idempotencyKey: `opening:${product._id}:${location._id}`,
          occurredAt: product.createdAt || new Date(),
        });
      }
      balancesCreated += 1;
    }
  }

  console.log(`\n✅  Terminé : ${balancesCreated} balance(s) créée(s), ${balancesExisting} déjà présente(s), ` +
    `${skippedNoLocation} tenant(s) sans boutique, ${skippedNoVariant} produit(s) sans variante.\n`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Backfill balances failed:', err);
  process.exit(1);
});
