/**
 * Réconciliation du registre d'inventaire (Phase 4.2b).
 *
 * Compare, pour chaque tenant, le stock legacy `Product.stock` à la somme des
 * balances `InventoryBalance.onHand` de ses boutiques. Les divergences
 * proviennent des écrits legacy directs (création/édition produit, anciennes
 * ventes, ajustements) qui contournent le registre.
 *
 * Modes :
 *   node scripts/reconcileInventory.js            # rapport seul, exit 1 si divergence
 *   node scripts/reconcileInventory.js --dry-run  # identique, explicite
 *   node scripts/reconcileInventory.js --fix      # corrige la balance de la boutique
 *                                                 # par défaut + mouvement d'ajustement
 *                                                 # (ne touche JAMAIS Product.stock)
 *
 * Idempotent : après --fix, un nouveau rapport doit sortir propre (exit 0).
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

const FIX = process.argv.includes('--fix');
const DRY_RUN = process.argv.includes('--dry-run') && !FIX;

async function run() {
  await connectDB();
  const mode = FIX ? '--fix' : DRY_RUN ? '--dry-run' : 'rapport';
  console.log(`\n🔍  Réconciliation inventaire (mode: ${mode})\n`);

  const tenants = await Tenant.find({}).lean();
  let totalMismatches = 0;
  let totalFixed = 0;

  for (const tenant of tenants) {
    // Somme des balances par produit, toutes boutiques confondues.
    const aggregated = await InventoryBalance.aggregate([
      { $match: { tenantId: tenant._id } },
      { $group: { _id: '$productId', total: { $sum: '$onHand' } } },
    ]);
    const balanceTotals = new Map(aggregated.map((row) => [String(row._id), row.total]));

    const products = await Product.find({ tenantId: tenant._id }).lean();
    const mismatches = products.filter((product) => {
      const total = balanceTotals.get(String(product._id)) || 0;
      return total !== (Number(product.stock) || 0);
    });

    if (mismatches.length === 0) continue;

    totalMismatches += mismatches.length;
    const label = tenant.name || tenant.code || String(tenant._id);
    console.log(`   ⚠️  ${label} : ${mismatches.length} produit(s) divergent(s)`);

    const location = await Location.findOne({ tenantId: tenant._id, isActive: true })
      .sort({ createdAt: 1 }).lean();
    if (!location) {
      console.log(`      → aucune boutique active, correction impossible.`);
      continue;
    }

    for (const product of mismatches) {
      const legacy = Number(product.stock) || 0;
      const total = balanceTotals.get(String(product._id)) || 0;
      const delta = legacy - total;
      console.log(`      • ${product.name || product.sku || product._id} : Product.stock=${legacy}, Σ balances=${total} (écart ${delta > 0 ? '+' : ''}${delta})`);

      if (!FIX) continue;

      // Balance de la boutique par défaut uniquement.
      const variant = await ProductVariant.findOne({
        tenantId: tenant._id, productId: product._id, isDefault: true,
      }).lean() || await ProductVariant.findOne({ tenantId: tenant._id, productId: product._id }).lean();
      if (!variant) {
        console.log(`        ↳ pas de variante, ignoré.`);
        continue;
      }

      let balance = await InventoryBalance.findOne({
        tenantId: tenant._id, locationId: location._id, variantId: variant._id,
      });
      if (!balance) {
        // Balance absente : on l'ouvre à zéro puis on ajuste (ne lit PAS
        // Product.stock pour éviter de propager la divergence).
        balance = await InventoryBalance.create({
          tenantId: tenant._id,
          locationId: location._id,
          variantId: variant._id,
          productId: product._id,
          onHand: 0,
          reserved: 0,
          available: 0,
          version: 1,
        });
      }
      if (delta === 0) continue;

      await InventoryBalance.updateOne(
        { _id: balance._id },
        { $inc: { onHand: delta, available: delta, version: 1 } }
      );
      await StockMovement.create({
        tenantId: tenant._id,
        locationId: location._id,
        product: product._id,
        variantId: variant._id,
        productName: product.name || null,
        type: delta > 0 ? 'adjustment_in' : 'adjustment_out',
        quantityDelta: delta,
        quantity: Math.abs(delta),
        unitCost: Number(product.costPrice) || 0,
        costImpact: 0,
        reason: 'reconciliation',
        source: 'migration',
        note: 'Réconciliation Product.stock ↔ balances',
        idempotencyKey: `recon:${product._id}:${location._id}:${Date.now()}`,
        occurredAt: new Date(),
      });
      totalFixed += 1;
      console.log(`        ↳ balance ajustée (${delta > 0 ? '+' : ''}${delta}) + mouvement d'ajustement.`);
    }
  }

  console.log('');
  if (totalMismatches === 0) {
    console.log('✅  Registre d\'inventaire cohérent avec Product.stock sur tous les tenants.');
  } else if (FIX) {
    console.log(`✅  ${totalFixed} correction(s) appliquée(s) sur ${totalMismatches} divergence(s). Relancez sans --fix pour confirmer.`);
  } else {
    console.log(`❌  ${totalMismatches} divergence(s). Relancez avec --fix pour corriger les balances.`);
  }
  await mongoose.connection.close();
  process.exit(totalMismatches === 0 ? 0 : FIX ? 0 : 1);
}

run().catch(async (error) => {
  console.error('Erreur de réconciliation :', error);
  try { await mongoose.connection.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
