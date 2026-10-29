const test = require('node:test');
const assert = require('node:assert/strict');
const { findStalePartialSales } = require('../utils/staleBalanceDetection');

const NOW = new Date('2026-11-01T00:00:00.000Z');
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const sale = (overrides) => ({
  _id: 'sale-1',
  balance: 1000,
  totalPaid: 500,
  payments: [{ amount: 500, paymentDate: daysAgo(15) }],
  ...overrides,
});

test('flags a partially paid sale whose last payment is older than the threshold', () => {
  const [result] = findStalePartialSales([sale()], NOW);
  assert.equal(result.daysSincePayment, 15);
});

test('ignores a sale paid recently, even if the sale itself is old', () => {
  const result = findStalePartialSales([sale({ payments: [{ amount: 500, paymentDate: daysAgo(2) }] })], NOW);
  assert.equal(result.length, 0);
});

test('ignores a sale with no balance left, regardless of payment age', () => {
  const result = findStalePartialSales([sale({ balance: 0 })], NOW);
  assert.equal(result.length, 0);
});

test('falls back to the most recent of several payments', () => {
  const [result] = findStalePartialSales([sale({
    payments: [
      { amount: 200, paymentDate: daysAgo(40) },
      { amount: 300, paymentDate: daysAgo(12) },
    ],
  })], NOW);
  assert.equal(result.daysSincePayment, 12);
});

test('ignores a sale with no identifiable payment date', () => {
  const result = findStalePartialSales([sale({ payments: [{ amount: 500 }] })], NOW);
  assert.equal(result.length, 0);
});

test('sorts the oldest stale balances first', () => {
  const results = findStalePartialSales([
    sale({ _id: 'recent-stale', payments: [{ amount: 500, paymentDate: daysAgo(11) }] }),
    sale({ _id: 'very-stale', payments: [{ amount: 500, paymentDate: daysAgo(60) }] }),
  ], NOW);
  assert.deepEqual(results.map((r) => r._id), ['very-stale', 'recent-stale']);
});

test('respects a custom threshold', () => {
  const result = findStalePartialSales([sale({ payments: [{ amount: 500, paymentDate: daysAgo(6) }] })], NOW, 5);
  assert.equal(result.length, 1);
});
