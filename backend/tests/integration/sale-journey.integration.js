/**
 * Tests d'intégration Supertest — parcours vente complet (Phase 1 approfondie).
 *
 * Prérequis :
 *   RUN_TENANT_TESTS=1 + TEST_MONGO_URI (base de test dédiée).
 * Exécution : npm test (Jest, jest.config.js ne prend que *.integration.test.js).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// IMPÉRATIF : importer l'app AVANT les modèles — server.js enregistre le
// plugin tenant-guard global (tous les modèles compilés ensuite sont gardés).
const app = require('../../server');

const enabled = process.env.RUN_TENANT_TESTS === '1';
const run = enabled ? describe : describe.skip;

const Tenant = require('../../models/tenantModel');
const Location = require('../../models/locationModel');
const User = require('../../models/userModel');
const Client = require('../../models/clientModel');
const Product = require('../../models/productModel');
const ProductVariant = require('../../models/productVariantModel');
const InventoryBalance = require('../../models/inventoryBalanceModel');
const StockMovement = require('../../models/stockMovementModel');
const Sale = require('../../models/saleModel');
const DeletedSale = require('../../models/deletedSaleModel');
const Payment = require('../../models/paymentModel');

const SUFFIX = Date.now().toString(36);
let tenant, token;
let productId, clientId, saleId;

describe('garde-fou', () => {
  test('RUN_TENANT_TESTS et TEST_MONGO_URI requis pour l\'intégration', () => {
    expect(enabled).toBe(true);
  });
});

run('Parcours vente complet via l\'API (Supertest)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `IT ${SUFFIX}`, ownerName: 'T', ownerEmail: `it-${SUFFIX}@t.io`,
      code: `IT${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    const location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LIT${SUFFIX}`.slice(0, 10), type: 'store',
    });
    const user = await User.create({
      tenantId: tenant._id, name: 'Admin', email: `it-admin-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: true, isActive: true,
    });
    const product = await Product.create({
      tenantId: tenant._id, name: `Produit IT ${SUFFIX}`, description: 'Test intégration',
      category: 'Meubles', price: 200, costPrice: 100, stock: 10, sku: `IT-${SUFFIX}`,
    });
    productId = String(product._id);
    const variant = await ProductVariant.create({
      tenantId: tenant._id, productId: product._id, optionValues: {}, sku: product.sku,
      status: 'active', isDefault: true,
    });
    await InventoryBalance.create({
      tenantId: tenant._id, locationId: location._id, variantId: variant._id, productId: product._id,
      onHand: 10, reserved: 0, available: 10, version: 1,
    });
    const client = await Client.create({
      tenantId: tenant._id, name: 'Client', email: `it-c-${SUFFIX}@t.io`,
    });
    clientId = String(client._id);
    token = jwt.sign(
      { id: String(user._id), tenantId: String(tenant._id) },
      process.env.JWT_SECRET, { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    for (const Model of [DeletedSale, Sale, Payment, Product, ProductVariant, InventoryBalance,
      StockMovement, Client, User, Location]) {
      await Model.deleteMany({ tenantId: tenant._id }).catch(() => {});
    }
    await Tenant.deleteMany({ _id: tenant._id }).catch(() => {});
    await mongoose.disconnect();
  });

  test('401 sans jeton', async () => {
    await request(app).get('/api/sales').expect(401);
  });

  test('création de vente (2×200 payée comptant)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client: clientId,
        products: [{ product: productId, quantity: 2, price: 200 }],
        paymentMethod: 'cash', initialPaymentAmount: 400, markAsDelivered: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(400);

    const product = await Product.findById(productId).lean();
    expect(product.stock).toBe(8);
    const balance = await InventoryBalance.findOne({ tenantId: tenant._id, productId }).lean();
    expect(balance.onHand).toBe(8);
    const movement = await StockMovement.findOne({
      tenantId: tenant._id, product: productId, type: 'sale',
    }).lean();
    expect(movement.quantityDelta).toBe(-2);

    // Paiement initial double-écrit dans la collection dédiée.
    const payment = await Payment.findOne({ tenantId: tenant._id, idempotencyKey: new RegExp(`^sale:${res.body._id}:payment:0$`) }).lean();
    expect(payment).toBeTruthy();
    expect(payment.amount).toBe(400);

    saleId = res.body._id;
  });

  test('paiement complémentaire à crédit + double-écriture', async () => {
    const res = await request(app)
      .post(`/api/sales/${saleId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, method: 'credit' });
    expect(res.status).toBe(200);

    const payments = await Payment.countDocuments({ tenantId: tenant._id, saleId });
    expect(payments).toBe(2, 'paiement initial + paiement complémentaire');
  });

  test('modification de la vente (2 → 3 unités, écart +1)', async () => {
    const res = await request(app)
      .put(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ products: [{ product: productId, quantity: 3, price: 200 }] });
    expect(res.status).toBe(200);

    const product = await Product.findById(productId).lean();
    expect(product.stock).toBe(7);
    const balance = await InventoryBalance.findOne({ tenantId: tenant._id, productId }).lean();
    expect(balance.onHand).toBe(7);
  });

  test('suppression de la vente : stock restauré, mouvement sale_return', async () => {
    const res = await request(app)
      .delete(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Test intégration' });
    expect(res.status).toBe(200);

    const product = await Product.findById(productId).lean();
    expect(product.stock).toBe(10, 'stock entièrement restauré');
    const restore = await StockMovement.findOne({
      tenantId: tenant._id, product: productId, type: 'sale_return',
    }).lean();
    expect(restore).toBeTruthy();
    expect(restore.quantityDelta).toBe(3);
    const deleted = await DeletedSale.findOne({ tenantId: tenant._id }).lean();
    expect(deleted).toBeTruthy();
  });
});
