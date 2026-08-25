/**
 * Corrige les index uniques globaux hérités du mono-boutique.
 *
 * Contexte : les modèles Category, Client, Employee, Supplier, Container,
 * Warehouse, ExpenseCategory (nom/email) et Product (SKU) avaient un index
 * UNIQUE GLOBAL : deux boutiques ne pouvaient pas utiliser le même nom/email/SKU.
 * Les schémas définissent désormais des index composés `{ tenantId, champ }`
 * uniques. Ce script :
 *   1. supprime les anciens index globaux (name_1, email_1, sku_1),
 *   2. recrée les nouveaux index composés via syncIndexes().
 *
 * Usage :
 *   node scripts/fixUniqueIndexes.js
 *
 * Sûr à re-exécuter (idempotent). À lancer une seule fois par environnement,
 * idéalement hors heures de pointe : la création d'index peut être lourde.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const MODELS = [
  { file: '../models/categoryModel', name: 'Category', legacy: ['name_1'] },
  { file: '../models/clientModel', name: 'Client', legacy: ['email_1'] },
  { file: '../models/employeeModel', name: 'Employee', legacy: ['email_1'] },
  { file: '../models/supplierModel', name: 'Supplier', legacy: ['name_1'] },
  { file: '../models/containerModel', name: 'Container', legacy: ['name_1'] },
  { file: '../models/warehouseModel', name: 'Warehouse', legacy: ['name_1'] },
  { file: '../models/expenseCategoryModel', name: 'ExpenseCategory', legacy: ['name_1'] },
  { file: '../models/productModel', name: 'Product', legacy: ['sku_1'] },
  { file: '../models/userModel', name: 'User', legacy: ['email_1'] },
];

async function run() {
  await connectDB();
  console.log('\n🔧  Correction des index uniques multi-tenant...\n');

  for (const { file, name, legacy } of MODELS) {
    require(file);
    const model = mongoose.model(name);
    const collection = model.collection;

    // 1. Supprimer les anciens index globaux s'ils existent encore.
    const existingIndexes = await collection.indexes().catch(() => []);
    for (const idxName of legacy) {
      if (existingIndexes.some((idx) => idx.name === idxName)) {
        try {
          await collection.dropIndex(idxName);
          console.log(`  ✅ ${name}: index global ${idxName} supprimé`);
        } catch (err) {
          console.log(`  ⚠️  ${name}: impossible de supprimer ${idxName} — ${err.message}`);
        }
      }
    }

    // 2. (Re)créer les index déclarés dans le schéma (composés tenantId + champ).
    try {
      await model.syncIndexes();
      console.log(`  ✅ ${name}: index synchronisés`);
    } catch (err) {
      console.log(`  ❌ ${name}: syncIndexes échoué — ${err.message}`);
    }
  }

  console.log('\n✅ Terminé. Vérification finale :\n');
  for (const { name } of MODELS) {
    const model = mongoose.model(name);
    const indexes = await model.collection.indexes().catch(() => []);
    const names = indexes.map((idx) => idx.name).join(', ');
    console.log(`  ${name}: ${names}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
