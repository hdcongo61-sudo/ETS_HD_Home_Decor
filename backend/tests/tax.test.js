/**
 * Tests des fonctions pures de la taxe (TVA) — suite `node:test`.
 * Aucune base requise.
 */

const test = require('node:test');
const assert = require('node:assert');

const { DEFAULT_TAX, normalizeTax, computeTaxFromTotal } = require('../utils/tax');

test('normalizeTax applique des valeurs par défaut sûres', () => {
  assert.deepStrictEqual(normalizeTax(), DEFAULT_TAX);
  assert.deepStrictEqual(
    normalizeTax({ enabled: true, rate: 18.5, label: 'TVA', inclusive: true }),
    { enabled: true, rate: 18.5, label: 'TVA', inclusive: true }
  );
  // Les chaînes "1"/"0" venues de formulaires sont normalisées en booléens.
  assert.strictEqual(normalizeTax({ enabled: '1', rate: '18' }).enabled, true);
});

test('computeTaxFromTotal calcule la TVA incluse', () => {
  // 11800 TTC à 18% => 1800 de taxe (11800 * 18 / 118).
  assert.strictEqual(computeTaxFromTotal(11800, { enabled: true, rate: 18 }), 1800);
  assert.strictEqual(computeTaxFromTotal(1000, { enabled: false, rate: 18 }), 0);
  assert.strictEqual(computeTaxFromTotal(1000, { enabled: true, rate: 0 }), 0);
});
