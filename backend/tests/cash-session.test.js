/**
 * Tests caisse/sessions et numérotation (Phases 5.3 + 5.7) — `node:test`.
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
  const CashRegister = require('../models/cashRegisterModel');
  const CashSession = require('../models/cashSessionModel');
  const NumberSequence = require('../models/numberSequenceModel');
  const Payment = require('../models/paymentModel');
  const Expense = require('../models/expenseModel');
  const { recordPayment } = require('../services/paymentService');
  const cashService = require('../services/cashService');

  const SUFFIX = Date.now().toString(36);
  let tenant, location, register;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Cash ${SUFFIX}`, ownerName: 'T', ownerEmail: `cash-${SUFFIX}@t.io`,
      code: `CSH${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    location = await Location.create({
      tenantId: tenant._id, name: 'Boutique principale', code: `LCS${SUFFIX}`.slice(0, 10), type: 'store',
    });
    register = await cashService.createRegister({
      tenantId: tenant._id, locationId: location._id, code: `REG${SUFFIX}`.slice(0, 10), name: 'Caisse 1',
    });
  });

  test.after(async () => {
    await Expense.deleteMany({ tenantId: tenant._id });
    await Payment.deleteMany({ tenantId: tenant._id });
    await CashSession.deleteMany({ tenantId: tenant._id });
    await CashRegister.deleteMany({ tenantId: tenant._id });
    await NumberSequence.deleteMany({ tenantId: tenant._id });
    await Location.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('ouverture de session : une seule session ouverte par caisse', async () => {
    const session = await cashService.openSession({
      tenantId: tenant._id, registerId: register._id, openingFloat: 5000,
    });
    assert.strictEqual(session.status, 'open');
    assert.strictEqual(session.openingFloat, 5000);

    await assert.rejects(
      cashService.openSession({ tenantId: tenant._id, registerId: register._id, openingFloat: 0 }),
      (err) => err.statusCode === 409
    );
  });

  test('état de session : expected = ouverture + cash entrant - cash sortant', async () => {
    const openSession = await CashSession.findOne({ tenantId: tenant._id, status: 'open' }).lean();

    await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId: new mongoose.Types.ObjectId(),
      amount: 2000, method: 'cash', cashSessionId: openSession._id, idempotencyKey: `cash-in:${SUFFIX}`,
    });
    // Un paiement MobileMoney lié ne bouge pas le fond de caisse.
    await recordPayment({
      tenantId: tenant._id, locationId: location._id, saleId: new mongoose.Types.ObjectId(),
      amount: 900, method: 'MobileMoney', cashSessionId: openSession._id, idempotencyKey: `cash-mm:${SUFFIX}`,
    });
    await Expense.create({
      tenantId: tenant._id, locationId: location._id, description: 'Transport',
      amount: 500, category: 'Transport', date: new Date(), paymentMethod: 'cash',
      cashSessionId: openSession._id,
    });

    const state = await cashService.getSessionState({ tenantId: tenant._id, sessionId: openSession._id });
    assert.strictEqual(state.cashIn, 2000);
    assert.strictEqual(state.cashOut, 500);
    assert.strictEqual(state.expectedClosing, 6500);
    assert.strictEqual(state.discrepancy, null, 'écart indisponible tant que non compté');
  });

  test('clôture : écart enregistré, session fermée', async () => {
    const openSession = await CashSession.findOne({ tenantId: tenant._id, status: 'open' }).lean();
    const result = await cashService.closeSession({
      tenantId: tenant._id, sessionId: openSession._id, countedClosing: 6600,
    });
    assert.strictEqual(result.session.status, 'closed');
    assert.strictEqual(result.session.expectedClosing, 6500);
    assert.strictEqual(result.session.discrepancy, 100);

    await assert.rejects(
      cashService.closeSession({ tenantId: tenant._id, sessionId: openSession._id, countedClosing: 6600 }),
      (err) => err.statusCode === 409
    );
  });

  test('numérotation atomique par type, boutique et période fiscale', async () => {
    const first = await cashService.nextNumber({
      tenantId: tenant._id, docType: 'INVOICE', fiscalPeriod: '2026',
    });
    const second = await cashService.nextNumber({
      tenantId: tenant._id, docType: 'INVOICE', fiscalPeriod: '2026',
    });
    assert.strictEqual(first.number, 1);
    assert.strictEqual(second.number, 2, 'incrément sans réutilisation');

    const otherPeriod = await cashService.nextNumber({
      tenantId: tenant._id, docType: 'INVOICE', fiscalPeriod: '2025',
    });
    assert.strictEqual(otherPeriod.number, 1, 'période fiscale distincte');

    const scoped = await cashService.nextNumber({
      tenantId: tenant._id, locationId: location._id, docType: 'RECEIPT', fiscalPeriod: '2026',
    });
    const scopedOrg = await cashService.nextNumber({
      tenantId: tenant._id, locationId: null, docType: 'RECEIPT', fiscalPeriod: '2026',
    });
    assert.strictEqual(scoped.number, 1);
    assert.strictEqual(scopedOrg.number, 1, 'séquence organisation vs boutique séparées');
  });
}
