const test = require('node:test');
const assert = require('node:assert/strict');
const { validateStockRemoval } = require('../utils/stockRemovalValidation');
const valid = { productId: 'product-1', quantity: 2, reason: 'casse', note: 'Transport' };
test('accepts whole quantities and existing reason codes', () => {
  assert.equal(validateStockRemoval(valid), null);
  assert.equal(validateStockRemoval({ ...valid, quantity: '2' }), null);
  assert.equal(validateStockRemoval({ ...valid, reason: 'autre' }), null);
});
test('rejects fractional, nonpositive, nonfinite, and coerced boolean quantities', () => {
  for (const quantity of [1.5, '2.7', 0, -1, '', null, undefined, true, Infinity, 'abc', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validateStockRemoval({ ...valid, quantity }).code, 'INVALID_STOCK_QUANTITY', String(quantity));
  }
});
test('requires explicit reason and explanation for other, and limits notes', () => {
  assert.equal(validateStockRemoval({ ...valid, reason: '' }).code, 'STOCK_REASON_REQUIRED');
  assert.equal(validateStockRemoval({ ...valid, reason: 'autre', note: '   ' }).code, 'STOCK_NOTE_REQUIRED');
  assert.equal(validateStockRemoval({ ...valid, note: 'x'.repeat(301) }).code, 'STOCK_NOTE_TOO_LONG');
  assert.equal(validateStockRemoval({ ...valid, productId: '' }).code, 'PRODUCT_REQUIRED');
});
