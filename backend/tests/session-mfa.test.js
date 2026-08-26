/**
 * Tests sessions + MFA + usurpation lecture seule (Phase 0.8) — `node:test`.
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
  const User = require('../models/userModel');
  const UserSession = require('../models/userSessionModel');
  const sessionService = require('../services/sessionService');
  const mfaService = require('../services/mfaService');
  const { generateSecret, generateTotp, verifyTotp } = require('../utils/totp');
  const { enforceImpersonationReadOnly } = require('../middlewares/authMiddleware');

  const SUFFIX = Date.now().toString(36);
  let tenant, user;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenant = await Tenant.create({
      name: `Ses ${SUFFIX}`, ownerName: 'T', ownerEmail: `ses-${SUFFIX}@t.io`,
      code: `SES${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    user = await User.create({
      tenantId: tenant._id, name: 'Compte', email: `ses-u-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
  });

  test.after(async () => {
    await UserSession.deleteMany({ userId: user._id });
    await User.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteMany({ _id: tenant._id });
    await mongoose.disconnect();
  });

  test('TOTP : génération, vérification, fenêtre temporelle', () => {
    const secret = generateSecret();
    assert.ok(/^[A-Z2-7]+$/.test(secret), 'secret base32');
    const now = Date.now();
    // Ancrer au début d'une fenêtre pour des assertions déterministes.
    const aligned = Math.floor(now / 30000) * 30000 + 1000;
    const code = generateTotp({ secret, time: aligned });
    assert.ok(verifyTotp(code, secret, { time: aligned, window: 0 }), 'code courant valide');
    assert.strictEqual(verifyTotp('000000', secret, { time: aligned, window: 0 }), false, 'mauvais code refusé');
    assert.ok(verifyTotp(code, secret, { time: aligned + 10 * 1000, window: 0 }), 'même fenêtre (30 s) acceptée');
    assert.strictEqual(verifyTotp(code, secret, { time: aligned + 60 * 1000, window: 0 }), false, 'deux fenêtres plus loin refusé');
  });

  test('MFA service : setup + vérification de code', () => {
    const setup = mfaService.setup('test@etshd.com');
    assert.ok(setup.otpauthUrl.startsWith('otpauth://totp/'), 'URL d\'application');
    const code = generateTotp({ secret: setup.secret });
    assert.ok(mfaService.verifyCode(setup.secret, code), 'code frais accepté');
    assert.strictEqual(mfaService.verifyCode(setup.secret, '000000'), false);
  });

  test('sessions : enregistrement, liste, révocation unitaire et globale', async () => {
    const s1 = await sessionService.recordSession({
      kind: 'user', userId: user._id, tenantId: tenant._id,
      device: 'iPhone', ip: '1.2.3.4', tokenVersion: user.tokenVersion,
    });
    const s2 = await sessionService.recordSession({
      kind: 'user', userId: user._id, device: 'Chrome Desktop', ip: '5.6.7.8',
    });

    let sessions = await sessionService.listSessions({ kind: 'user', userId: user._id });
    assert.strictEqual(sessions.length, 2);

    await sessionService.touchSession({ kind: 'user', userId: user._id, sessionId: s2._id });
    await sessionService.revokeSession({ kind: 'user', userId: user._id, sessionId: s1._id });
    sessions = await sessionService.listSessions({ kind: 'user', userId: user._id });
    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(String(sessions[0]._id), String(s2._id));

    const before = user.tokenVersion || 0;
    await sessionService.revokeAllForUser({ kind: 'user', userId: user._id });
    const after = await User.findById(user._id).select('tokenVersion').lean();
    assert.strictEqual(after.tokenVersion, before + 1, 'tokenVersion incrémenté → anciens jetons invalides');
    sessions = await sessionService.listSessions({ kind: 'user', userId: user._id });
    assert.strictEqual(sessions.length, 0, 'toutes les sessions révoquées');
  });

  test('usurpation en lecture seule : mutations bloquées, lectures autorisées', () => {
    const violation = enforceImpersonationReadOnly({ method: 'POST', isImpersonating: true });
    assert.strictEqual(violation.code, 'IMPERSONATION_READ_ONLY');
    assert.strictEqual(
      enforceImpersonationReadOnly({ method: 'GET', isImpersonating: true }),
      null,
      'les lectures restent autorisées'
    );
    assert.strictEqual(
      enforceImpersonationReadOnly({ method: 'PUT', isImpersonating: false }),
      null,
      'sans usurpation, aucune restriction'
    );
  });
}
