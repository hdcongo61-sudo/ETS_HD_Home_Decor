const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInventoryAdjustment } = require('../utils/inventoryAdjustmentValidation');
const input = { productId: 'p1', quantity: -2, unitCost: 0, note: 'Correction du comptage' };
test('allows signed quantities including decimals supported by inventory', () => {
  for (const quantity of [-2, 3, -0.5, '2.5']) assert.equal(validateInventoryAdjustment({ ...input, quantity }), null);
});
test('rejects absent reasons, invalid costs, and invalid signed quantities', () => {
  for (const quantity of [0, '', null, true, Infinity, 'bad']) assert.equal(validateInventoryAdjustment({ ...input, quantity }).code, 'INVALID_ADJUSTMENT_QUANTITY');
  for (const unitCost of [-1, Infinity, true, 'bad']) assert.equal(validateInventoryAdjustment({ ...input, unitCost }).code, 'INVALID_UNIT_COST');
  assert.equal(validateInventoryAdjustment({ ...input, note: '  ' }).code, 'ADJUSTMENT_REASON_REQUIRED');
  assert.equal(validateInventoryAdjustment({ ...input, note: 'x'.repeat(301) }).code, 'ADJUSTMENT_REASON_TOO_LONG');
});
