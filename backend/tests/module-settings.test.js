/**
 * Tests catalogue de modules + hiérarchie des paramètres (Phases 7.2-7.3).
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
  const User = require('../models/userModel');
  const ModuleSetting = require('../models/moduleSettingModel');
  const SettingOverride = require('../models/settingOverrideModel');
  const moduleService = require('../services/moduleService');
  const settingsService = require('../services/settingsService');

  const SUFFIX = Date.now().toString(36);
  let tenantTrial, tenantCore, location;

  test.before(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    tenantTrial = await Tenant.create({
      name: `Mod ${SUFFIX}`, ownerName: 'T', ownerEmail: `mod-${SUFFIX}@t.io`,
      code: `MOD${SUFFIX}`.slice(0, 10), status: 'active', plan: 'trial',
    });
    tenantCore = await Tenant.create({
      name: `ModCore ${SUFFIX}`, ownerName: 'T', ownerEmail: `modc-${SUFFIX}@t.io`,
      code: `MOC${SUFFIX}`.slice(0, 10), status: 'active', plan: 'basic',
    });
    location = await Location.create({
      tenantId: tenantTrial._id, name: 'Boutique principale', code: `LM${SUFFIX}`.slice(0, 10), type: 'store',
    });
  });

  test.after(async () => {
    const tenantIds = [tenantTrial && tenantTrial._id, tenantCore && tenantCore._id].filter(Boolean);
    await ModuleSetting.deleteMany({ tenantId: { $in: tenantIds } });
    await SettingOverride.deleteMany({ tenantId: { $in: tenantIds } });
    await Location.deleteMany({ tenantId: { $in: tenantIds } });
    await User.deleteMany({ tenantId: { $in: tenantIds } });
    await Tenant.deleteMany({ _id: { $in: tenantIds } });
    await mongoose.disconnect();
  });

  test('catalogue : droits de plan et permissions résolus par organisation', async () => {
    const modulesTrial = await moduleService.resolveModules({ tenantId: tenantTrial._id });
    const purchasingTrial = modulesTrial.find((m) => m.key === 'purchasing');
    assert.strictEqual(purchasingTrial.entitled, true, 'trial a droit au module achats');
    assert.strictEqual(purchasingTrial.enabled, true);
    assert.strictEqual(purchasingTrial.allowed, false, 'sans utilisateur : aucune permission');

    const modulesCore = await moduleService.resolveModules({ tenantId: tenantCore._id });
    const purchasingCore = modulesCore.find((m) => m.key === 'purchasing');
    assert.strictEqual(purchasingCore.entitled, false, 'plan basic exclu du ravitaillement fournisseur');
    assert.strictEqual(purchasingCore.enabled, false);
  });

  test('remplacement organisationnel : désactivation et config de module', async () => {
    await moduleService.setModuleSetting({
      tenantId: tenantTrial._id, moduleKey: 'returns',
      data: { enabled: false, config: { maxReturnDays: 15 } },
    });
    const modules = await moduleService.resolveModules({ tenantId: tenantTrial._id });
    const returns = modules.find((m) => m.key === 'returns');
    assert.strictEqual(returns.entitled, true);
    assert.strictEqual(returns.enabled, false, 'désactivé par remplacement org');
    assert.strictEqual(returns.override.config.maxReturnDays, 15);

    await assert.rejects(
      moduleService.setModuleSetting({ tenantId: tenantTrial._id, moduleKey: 'inconnu', data: { enabled: false } }),
      (err) => err.statusCode === 404
    );
    // L'entitlement reste autoritaire : un plan non éligible ne peut pas forcer.
    await moduleService.setModuleSetting({
      tenantId: tenantCore._id, moduleKey: 'purchasing', data: { enabled: true },
    });
    const forced = await moduleService.resolveModules({ tenantId: tenantCore._id });
    const purchasing = forced.find((m) => m.key === 'purchasing');
    assert.strictEqual(purchasing.enabled, false, 'forçage sans droit de plan refusé');
  });

  test('permissions : un membre staff avec permission dédiée est allowed', async () => {
    const staff = await User.create({
      tenantId: tenantTrial._id, name: 'Staff', email: `mod-staff-${SUFFIX}@t.io`,
      password: 'pass-123', isAdmin: false, isActive: true,
    });
    // Un admin legacy passe (adaptateur) ; on vérifie le chemin membership.
    const { ensureMembershipForUser } = require('../services/authorization');
    const Role = require('../models/roleModel');
    const Membership = require('../models/membershipModel');
    const role = await Role.create({
      tenantId: tenantTrial._id, key: `mod-${SUFFIX}`, name: 'Acheteur',
      permissions: ['purchasing.manage'], isSystem: false,
    });
    await ensureMembershipForUser(tenantTrial._id, staff);
    await Membership.updateOne(
      { tenantId: tenantTrial._id, userId: staff._id },
      { $set: { roleIds: [role._id] } }
    );
    const modules = await moduleService.resolveModules({
      tenantId: tenantTrial._id, userId: staff._id,
    });
    const purchasing = modules.find((m) => m.key === 'purchasing');
    assert.strictEqual(purchasing.allowed, true, 'permission purchasing.manage accordée');
    const cash = modules.find((m) => m.key === 'cash');
    assert.strictEqual(cash.allowed, false, 'sans permission cashier.manage');

    await Membership.deleteMany({ tenantId: tenantTrial._id });
    await Role.deleteMany({ tenantId: tenantTrial._id });
  });

  test('hiérarchie des paramètres : défaut → org → boutique', async () => {
    const defaults = await settingsService.getSettings({ tenantId: tenantTrial._id });
    assert.strictEqual(defaults.currency, 'XOF');
    assert.strictEqual(defaults.locale, 'fr-FR');
    assert.strictEqual(defaults['payments.allowCredit'], false);

    await settingsService.setSetting({
      tenantId: tenantTrial._id, key: 'currency', value: 'EUR',
    });
    const orgLevel = await settingsService.getSettings({ tenantId: tenantTrial._id });
    assert.strictEqual(orgLevel.currency, 'EUR', 'remplacement organisation');

    await settingsService.setSetting({
      tenantId: tenantTrial._id, locationId: location._id, key: 'currency', value: 'USD',
    });
    const locationLevel = await settingsService.getSettings({
      tenantId: tenantTrial._id, locationId: location._id,
    });
    assert.strictEqual(locationLevel.currency, 'USD', 'la boutique gagne');
    const otherTenant = await settingsService.getSettings({ tenantId: tenantCore._id });
    assert.strictEqual(otherTenant.currency, 'XOF', 'isolation par organisation');

    await assert.rejects(
      settingsService.setSetting({ tenantId: tenantTrial._id, key: 'inconnu', value: 1 }),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      settingsService.setSetting({ tenantId: tenantTrial._id, key: 'payments.allowCredit', value: 'oui' }),
      (err) => err.statusCode === 400
    );

    await settingsService.resetSetting({ tenantId: tenantTrial._id, key: 'currency' });
    await settingsService.resetSetting({ tenantId: tenantTrial._id, locationId: location._id, key: 'currency' });
    const reset = await settingsService.getSettings({ tenantId: tenantTrial._id });
    assert.strictEqual(reset.currency, 'XOF', 'retour au défaut plateforme');
  });
}
