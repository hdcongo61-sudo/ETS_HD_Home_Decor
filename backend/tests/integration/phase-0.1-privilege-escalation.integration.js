/**
 * Phase 0.1 : protection contre l'escalade de privilèges (intégration).
 *
 * Vérifie qu'aucun endpoint public ne crée d'utilisateur et que les champs
 * isAdmin / isSuperAdmin / tenantId fournis par le client sont rejetés.
 *
 * Prérequis : RUN_TENANT_TESTS=1 + TEST_MONGO_URI (base de test dédiée).
 * Exécution : npm test (Jest — jest.config.js ne prend que *.integration.js).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const request = require('supertest');
// IMPÉRATIF : importer l'app AVANT les modèles (plugin tenant-guard global).
const app = require('../../server');
const User = require('../../models/userModel');
const Tenant = require('../../models/tenantModel');

const enabled = process.env.RUN_TENANT_TESTS === '1';
const run = enabled ? describe : describe.skip;

const SUFFIX = Date.now().toString(36);
const ADMIN_EMAIL = `phase01-admin-${SUFFIX}@test.com`;
const REGULAR_EMAIL = `phase01-user-${SUFFIX}@test.com`;

describe('garde-fou', () => {
  test('RUN_TENANT_TESTS et TEST_MONGO_URI requis', () => {
    expect(enabled).toBe(true);
  });
});

run('Phase 0.1 : protection contre l\'escalade de privilèges', () => {
  let adminToken;
  let testTenant;
  let regularUserId;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    await User.deleteMany({ email: /phase01-/ });
    await Tenant.deleteMany({ ownerEmail: /phase01-/ });

    testTenant = await Tenant.create({
      name: `Phase01 ${SUFFIX}`,
      ownerName: 'Test Owner',
      ownerEmail: `phase01-owner-${SUFFIX}@test.com`,
      code: `P01${SUFFIX}`.slice(0, 10),
      plan: 'trial',
      status: 'active',
    });

    await User.create({
      tenantId: testTenant._id,
      name: 'Admin User',
      email: ADMIN_EMAIL,
      password: 'SecurePass123!',
      isAdmin: true,
      isActive: true,
    });

    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ email: ADMIN_EMAIL, password: 'SecurePass123!' });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: /phase01-/ });
    await Tenant.deleteMany({ ownerEmail: /phase01-/ });
    await mongoose.disconnect();
  });

  describe('POST /api/users — aucune création publique', () => {
    it('rejette la création non authentifiée', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ name: 'Malicious', email: `evil-${SUFFIX}@test.com`, password: 'password', isAdmin: true });
      expect([401, 404]).toContain(res.status);
    });
  });

  describe('POST /api/users/admin — champs de privilège fournis par le client', () => {
    it('ignore isAdmin=true (l\'utilisateur reste non-admin)', async () => {
      const res = await request(app)
        .post('/api/users/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New User', email: REGULAR_EMAIL, password: 'SecurePass123!', isAdmin: true });
      expect(res.status).toBe(201);
      expect(res.body.isAdmin).toBe(false);

      const user = await User.findOne({ email: REGULAR_EMAIL }).lean();
      expect(user.isAdmin).toBe(false);
      regularUserId = user._id;
    });

    it('rejette isSuperAdmin=true', async () => {
      const res = await request(app)
        .post('/api/users/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New User 2', email: `phase01-sa-${SUFFIX}@test.com`, password: 'SecurePass123!', isSuperAdmin: true });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('isSuperAdmin');
    });

    it('rejette un tenantId étranger', async () => {
      const res = await request(app)
        .post('/api/users/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New User 3', email: `phase01-t-${SUFFIX}@test.com`, password: 'SecurePass123!', tenantId: new mongoose.Types.ObjectId() });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('tenantId');
    });
  });

  describe('PUT /api/users/:id — escalade via mise à jour', () => {
    it('rejette la modification isAdmin', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAdmin: true });
      expect(res.status).toBe(403);
      const user = await User.findById(regularUserId).lean();
      expect(user.isAdmin).toBe(false);
    });

    it('rejette la modification isSuperAdmin', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuperAdmin: true });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('isSuperAdmin');
    });

    it('rejette le changement de tenantId', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tenantId: new mongoose.Types.ObjectId() });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('tenantId');
    });
  });

  describe('PUT /api/users/profile — protection du profil personnel', () => {
    let regularUserToken;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email: REGULAR_EMAIL, password: 'SecurePass123!', tenantCode: testTenant.code });
      expect(loginRes.status).toBe(200);
      regularUserToken = loginRes.body.token;
    });

    it('rejette l\'auto-promotion admin', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ isAdmin: true });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('isAdmin');
    });

    it('rejette l\'auto-promotion super-admin', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ isSuperAdmin: true });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('isSuperAdmin');
    });

    it('rejette le changement de boutique', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ tenantId: new mongoose.Types.ObjectId() });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('tenantId');
    });

    it('autorise les mises à jour légitimes du profil', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ name: 'Updated Name', photo: 'https://example.com/photo.jpg' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.isAdmin).toBe(false);
    });
  });
});
