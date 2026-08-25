/**
 * Test d'isolation multi-tenant (Phase 1 — filet de sécurité).
 *
 * Crée deux boutiques temporaires A et B avec des données réelles, puis vérifie
 * via l'API réelle que la boutique B ne peut NI lire, NI modifier, NI référencer
 * les données de A — et que les comptes sans contexte sont rejetés.
 *
 * Prérequis : le backend doit tourner (par défaut http://localhost:5001).
 *   node scripts/isolationCheck.js
 *   API_BASE=http://localhost:5001/api node scripts/isolationCheck.js
 *
 * Le script nettoie ses données (idempotent) et sort avec 0 si tout passe.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Tenant = require('../models/tenantModel');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Client = require('../models/clientModel');
const Sale = require('../models/saleModel');

const API_BASE = process.env.API_BASE || 'http://localhost:5001/api';
const SUFFIX = `${Date.now().toString(36)}`;

const api = async (method, path, token, body) => {
  const data = body ? JSON.stringify(body) : null;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    json = null;
  }
  return { status: res.status, body: json };
};

let passed = 0;
let failed = 0;
const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${label} ${detail}`);
  }
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const tenantA = await Tenant.create({
    name: `Isolation A ${SUFFIX}`, ownerName: 'ISO A', ownerEmail: `isoa-${SUFFIX}@test.io`,
    code: `ISOA${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
  });
  const tenantB = await Tenant.create({
    name: `Isolation B ${SUFFIX}`, ownerName: 'ISO B', ownerEmail: `isob-${SUFFIX}@test.io`,
    code: `ISOB${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
  });
  const userA = await User.create({
    tenantId: tenantA._id, name: 'Admin A', email: `admin-a-${SUFFIX}@test.io`,
    password: 'isoa-pass', isAdmin: true, isActive: true,
  });
  const userB = await User.create({
    tenantId: tenantB._id, name: 'Admin B', email: `admin-b-${SUFFIX}@test.io`,
    password: 'isob-pass', isAdmin: true, isActive: true,
  });

  const tokenA = jwt.sign(
    { id: String(userA._id), tenantId: String(tenantA._id) },
    process.env.JWT_SECRET, { expiresIn: '15m' }
  );
  const tokenB = jwt.sign(
    { id: String(userB._id), tenantId: String(tenantB._id) },
    process.env.JWT_SECRET, { expiresIn: '15m' }
  );

  try {
    console.log('\n🔒 Test d\'isolation multi-tenant\n');

    // ── Données de A ──
    const prodRes = await api('POST', '/products', tokenA, {
      name: `ISO Chaise ${SUFFIX}`, description: 'Produit de test isolation',
      category: 'Meubles', price: 25000, costPrice: 15000, stock: 5,
    });
    check('A crée un produit', prodRes.status === 201, JSON.stringify(prodRes.body).slice(0, 120));
    const productA = prodRes.body?._id;

    const clientRes = await api('POST', '/clients', tokenA, {
      name: `ISO Client ${SUFFIX}`, email: `client-a-${SUFFIX}@test.io`, phone: '0611111111',
    });
    check('A crée un client', clientRes.status === 201, JSON.stringify(clientRes.body).slice(0, 120));
    const clientA = clientRes.body?._id;

    // ── Lecture : B ne voit pas les données de A ──
    const listB = await api('GET', '/products', tokenB);
    const leaked = Array.isArray(listB.body)
      ? listB.body.filter((p) => p._id === productA).length
      : -1;
    check('B ne voit pas le produit de A dans sa liste', listB.status === 200 && leaked === 0,
      `leaked=${leaked}`);

    const direct = await api('GET', `/products/${productA}`, tokenB);
    check('B ne lit pas le produit de A par ID (404)', direct.status === 404, `status=${direct.status}`);

    // ── Modification : B ne peut pas modifier A ──
    const update = await api('PUT', `/products/${productA}`, tokenB, { name: 'Pirate' });
    check('B ne modifie pas le produit de A (404)', update.status === 404, `status=${update.status}`);

    const del = await api('DELETE', `/products/${productA}`, tokenB);
    check('B ne supprime pas le produit de A (404)', del.status === 404, `status=${del.status}`);

    // ── Référence croisée : vente B avec le client de A ──
    const crossSale = await api('POST', '/sales', tokenB, {
      client: clientA,
      products: [{ product: productA, quantity: 1, price: 25000 }],
      paymentMethod: 'cash',
      initialPaymentAmount: 25000,
    });
    check('B ne peut pas vendre avec le client de A (400)', crossSale.status === 400,
      `status=${crossSale.status} ${JSON.stringify(crossSale.body).slice(0, 100)}`);

    // ── Dashboard scoped : B voit ses propres zéros, pas ceux de A ──
    const dashB = await api('GET', '/dashboard/overview?range=30days', tokenB);
    check('Dashboard B répond sans erreurs', dashB.status === 200 && dashB.body?.errors === 0,
      `status=${dashB.status} errors=${dashB.body?.errors}`);
    const dashA = await api('GET', '/dashboard/overview?range=30days', tokenA);
    check('Dashboard A inclut sa vente réelle', dashA.status === 200, `status=${dashA.status}`);

    // ── Accès anonyme / sans tenant ──
    const anon = await api('GET', '/products', null);
    check('Anonyme rejeté sur les produits (401)', anon.status === 401, `status=${anon.status}`);

    console.log(`\n── Résultat : ${passed} OK, ${failed} échec(s) ──\n`);
  } finally {
    // Nettoyage (idempotent).
    await Sale.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Client.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Product.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
    await mongoose.disconnect();
  }

  process.exit(failed === 0 ? 0 : 1);
}

run().catch(async (err) => {
  console.error('Erreur fatale :', err.message);
  process.exit(1);
});
