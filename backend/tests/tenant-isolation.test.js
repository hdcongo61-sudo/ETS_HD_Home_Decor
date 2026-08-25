/**
 * Tests d'isolation multi-tenant (Phase 1) — suite `node:test`.
 *
 * Prérequis :
 *   RUN_TENANT_TESTS=1                 (garde-fou explicite)
 *   TEST_MONGO_URI=mongodb://...       (base de test dédiée, jamais la prod)
 *   TEST_API_BASE=http://localhost:5001/api (optionnel)
 *
 * Exécution :  node --test tests/tenant-isolation.test.js
 *
 * Les fixtures (2 organisations temporaires) sont nettoyées en fin de suite,
 * même en cas d'échec (hook `after`).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (process.env.RUN_TENANT_TESTS !== '1') {
  // Garde-fou : sans accord explicite, la suite échoue plutôt que de toucher
  // une base non prévue.
  test('garde-fou RUN_TENANT_TESTS', () => {
    assert.fail('RUN_TENANT_TESTS=1 et TEST_MONGO_URI sont requis pour exécuter la suite.');
  });
} else {
  const jwt = require('jsonwebtoken');
  const mongoose = require('mongoose');
  const Tenant = require('../models/tenantModel');
  const User = require('../models/userModel');
  const Product = require('../models/productModel');
  const Client = require('../models/clientModel');
  const Sale = require('../models/saleModel');

  const MONGO_URI = process.env.TEST_MONGO_URI;
  const API_BASE = process.env.TEST_API_BASE || 'http://localhost:5001/api';
  const SUFFIX = `${Date.now().toString(36)}`;

  const api = async (method, pathName, token, body) => {
    const data = body ? JSON.stringify(body) : null;
    const res = await fetch(`${API_BASE}${pathName}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Type': 'application/json' } : {}),
      },
      body: data,
    });
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, body: json };
  };

  let tenantA, tenantB, userA, userB, tokenA, tokenB, productA, clientA;

  test.before(async () => {
    await mongoose.connect(MONGO_URI);
    tenantA = await Tenant.create({ name: `Isolation A ${SUFFIX}`, ownerName: 'ISO A', ownerEmail: `isoa-${SUFFIX}@test.io`, code: `ISOA${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial' });
    tenantB = await Tenant.create({ name: `Isolation B ${SUFFIX}`, ownerName: 'ISO B', ownerEmail: `isob-${SUFFIX}@test.io`, code: `ISOB${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial' });
    userA = await User.create({ tenantId: tenantA._id, name: 'Admin A', email: `admin-a-${SUFFIX}@test.io`, password: 'isoa-pass', isAdmin: true, isActive: true });
    userB = await User.create({ tenantId: tenantB._id, name: 'Admin B', email: `admin-b-${SUFFIX}@test.io`, password: 'isob-pass', isAdmin: true, isActive: true });
    tokenA = jwt.sign({ id: String(userA._id), tenantId: String(tenantA._id) }, process.env.JWT_SECRET, { expiresIn: '15m' });
    tokenB = jwt.sign({ id: String(userB._id), tenantId: String(tenantB._id) }, process.env.JWT_SECRET, { expiresIn: '15m' });
  });

  test.after(async () => {
    await Sale.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Client.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Product.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
    await mongoose.disconnect();
  });

  test('A crée un produit et un client', async () => {
    const prod = await api('POST', '/products', tokenA, {
      name: `ISO Chaise ${SUFFIX}`, description: 'Produit de test isolation',
      category: 'Meubles', price: 25000, costPrice: 15000, stock: 5,
    });
    assert.strictEqual(prod.status, 201);
    productA = prod.body._id;
    const client = await api('POST', '/clients', tokenA, {
      name: `ISO Client ${SUFFIX}`, email: `client-a-${SUFFIX}@test.io`, phone: '0611111111',
    });
    assert.strictEqual(client.status, 201);
    clientA = client.body._id;
  });

  test('B ne voit pas le produit de A dans sa liste', async () => {
    const list = await api('GET', '/products', tokenB);
    assert.strictEqual(list.status, 200);
    const leaked = Array.isArray(list.body) ? list.body.filter((p) => p._id === productA).length : -1;
    assert.strictEqual(leaked, 0);
  });

  test('B ne lit pas le produit de A par ID (404)', async () => {
    const direct = await api('GET', `/products/${productA}`, tokenB);
    assert.strictEqual(direct.status, 404);
  });

  test('B ne modifie pas le produit de A (404)', async () => {
    const update = await api('PUT', `/products/${productA}`, tokenB, { name: 'Pirate' });
    assert.strictEqual(update.status, 404);
  });

  test('B ne supprime pas le produit de A (404)', async () => {
    const del = await api('DELETE', `/products/${productA}`, tokenB);
    assert.strictEqual(del.status, 404);
  });

  test('B ne peut pas vendre avec le client de A (400)', async () => {
    const crossSale = await api('POST', '/sales', tokenB, {
      client: clientA,
      products: [{ product: productA, quantity: 1, price: 25000 }],
      paymentMethod: 'cash',
      initialPaymentAmount: 25000,
    });
    assert.strictEqual(crossSale.status, 400);
  });

  test('Les dashboards restent scopés et sans erreur', async () => {
    const dashB = await api('GET', '/dashboard/overview?range=30days', tokenB);
    assert.strictEqual(dashB.status, 200);
    assert.strictEqual(dashB.body.errors, 0);
    const dashA = await api('GET', '/dashboard/overview?range=30days', tokenA);
    assert.strictEqual(dashA.status, 200);
  });

  test('Anonyme rejeté sur les produits (401)', async () => {
    const anon = await api('GET', '/products', null);
    assert.strictEqual(anon.status, 401);
  });
}
