/**
 * Tests du PaymentService (Phase 5.4) — suite `node:test`.
 *
 * Prérequis :
 *   RUN_TENANT_TESTS=1 + TEST_MONGO_URI (base de test dédiée).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (process.env.RUN_TENANT_TESTS !== '1') {
  test('garde-fou RUN_TENANT_TESTS', () => {
    assert.fail('RUN_TENANT_TESTS=1 et TEST_MONGO_URI sont requis.');
  });
} else {
  const mongoose = require('mongoose');
  const Tenant = require('../models/tenantModel');
  const Location = require('../models/locationModel');
  const Payment = require('../models/paymentModel');
  const { recordPayment, reversePayment } = require('../services/paymentService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, saleId;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Pay ${SUFFIX}`, ownerName: 'T', ownerEmail: `pay-${SUFFIX}@t.io`,
      code: `PAY${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LP${SUFFIX}`.slice(0, 10), type: 'store',
    });
    saleId = new mongoose.Types.ObjectId();
  });

  test.after(async () => {
    await Payment.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('recordPayment crée le paiement dédié', async () => {
    const result = await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId,
      amount: 5000, method: 'cash', idempotencyKey: `t1:${SUFFIX}`,
    });
    assert.strictEqual(result.alreadyApplied, false);
    assert.strictEqual(result.payment.amount, 5000);
    assert.strictEqual(result.payment.currency, 'XOF');
    assert.strictEqual(String(result.payment.saleId), String(saleId));
  });

  test('idempotence : le rejeu ne crée pas de doublon', async () => {
    const replay = await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId,
      amount: 5000, method: 'cash', idempotencyKey: `t1:${SUFFIX}`,
    });
    assert.strictEqual(replay.alreadyApplied, true);
    const count = await Payment.countDocuments({ tenantId: tenant._id, idempotencyKey: `t1:${SUFFIX}` });
    assert.strictEqual(count, 1);
  });

  test('anti-sur-paiement : rejet au-delà du solde restant', async () => {
    await assert.rejects(
      recordPayment({
        tenantId: tenant._id, locationId: location._id, saleId,
        amount: 150, method: 'cash', idempotencyKey: `t2:${SUFFIX}`,
        allowedRemaining: 100,
      }),
      (err) => err.statusCode === 409
    );
    const count = await Payment.countDocuments({ tenantId: tenant._id, idempotencyKey: `t2:${SUFFIX}` });
    assert.strictEqual(count, 0, 'aucun paiement écrit');
  });

  test('crédit client : prépaiement autorisé quand la politique le permet', async () => {
    const result = await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId,
      amount: 150, method: 'credit', idempotencyKey: `t3:${SUFFIX}`,
      allowedRemaining: 100, allowCredit: true,
    });
    assert.strictEqual(result.alreadyApplied, false);
    assert.strictEqual(result.payment.amount, 150);
  });

  test('reversePayment marque le paiement reversed (idempotent)', async () => {
    const first = await reversePayment({
      tenantId: tenant._id, paymentId: null, reversalReason: 'Erreur de saisie',
    }).catch((error) => error);
    assert.ok(first instanceof Error, 'paiement inconnu → 404');
    assert.strictEqual(first.statusCode, 404);

    const created = await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId,
      amount: 1000, method: 'MobileMoney', idempotencyKey: `t4:${SUFFIX}`,
    });
    const reversed = await reversePayment({
      tenantId: tenant._id, paymentId: created.payment._id, reversalReason: 'Erreur de saisie',
    });
    assert.strictEqual(reversed.payment.status, 'reversed');
    assert.strictEqual(reversed.payment.reversalReason, 'Erreur de saisie');

    const replay = await reversePayment({
      tenantId: tenant._id, paymentId: created.payment._id, reversalReason: 'Autre',
    });
    assert.strictEqual(replay.alreadyApplied, true);
    assert.strictEqual(replay.payment.reversalReason, 'Erreur de saisie', 'motif inchangé au rejeu');
  });
}
