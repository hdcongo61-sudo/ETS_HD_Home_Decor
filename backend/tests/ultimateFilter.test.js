const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductFilter, buildSaleFilter, createDateRange } = require('../utils/ultimateFilter');

test('builds combined sale filters only from supported sale fields', () => {
  const filter = buildSaleFilter({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    status: 'completed',
    paymentMethod: 'cash',
    saleType: 'wholesale',
    deliveryStatus: 'delivered',
    minAmount: '100',
    maxAmount: '500',
    saleSearch: 'sale.*',
    isAdmin: 'true',
  });

  assert.equal(filter.status, 'completed');
  assert.equal(filter.paymentMethod, 'cash');
  assert.equal(filter.saleType, 'wholesale');
  assert.deepEqual(filter.totalAmount, { $gte: 100, $lte: 500 });
  assert.deepEqual(filter.$or[0].reference, { $regex: 'sale\\.\\*', $options: 'i' });
  assert.equal(filter.isAdmin, undefined);
  assert.equal(filter.saleDate.$gte.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(filter.saleDate.$lte.toISOString(), '2026-01-31T23:59:59.999Z');
});

test('builds product filters for catalog fields, stock, pricing, and expiry', () => {
  const filter = buildProductFilter({
    productSearch: 'chair(',
    category: 'Salon',
    supplierName: 'Fournisseur A',
    warehouse: 'Dépôt',
    minPrice: '2000',
    maxPrice: '8000',
    minStock: '2',
    maxStock: '10',
    minThreshold: '1',
    maxThreshold: '5',
    isActive: 'false',
    expiryStart: '2026-05-01',
    expiryEnd: '2026-06-30',
  });

  assert.deepEqual(filter.$or[0].name, { $regex: 'chair\\(', $options: 'i' });
  assert.equal(filter.category, 'Salon');
  assert.equal(filter.supplierName, 'Fournisseur A');
  assert.deepEqual(filter.price, { $gte: 2000, $lte: 8000 });
  assert.deepEqual(filter.stock, { $gte: 2, $lte: 10 });
  assert.deepEqual(filter.minStockLevel, { $gte: 1, $lte: 5 });
  assert.equal(filter.isActive, false);
  assert.equal(filter.expiryDate.$gte.toISOString(), '2026-05-01T00:00:00.000Z');
});

test('rejects invalid and reversed date ranges without building a query', () => {
  assert.equal(createDateRange('not-a-date', '2026-01-01'), null);
  assert.equal(createDateRange('2026-02-01', '2026-01-01'), null);
  assert.deepEqual(createDateRange('', '2026-01-01'), {
    $lte: new Date('2026-01-01T23:59:59.999Z'),
  });
});

test('combines product search and image filters without replacing either condition', () => {
  const filter = buildProductFilter({
    productSearch: 'linge',
    hasImage: 'false',
    lowStock: 'true',
    activityType: 'return',
    minViews: '10',
  });

  assert.ok(Array.isArray(filter.$or));
  assert.equal(filter.$or.some((condition) => condition.name), true);
  assert.deepEqual(filter.$and, [{ $or: [{ image: null }, { image: '' }] }]);
  assert.deepEqual(filter.$expr, { $lte: ['$stock', '$minStockLevel'] });
  assert.equal(filter['activities.type'], 'return');
  assert.deepEqual(filter.viewsCount, { $gte: 10 });
});

test('builds sale filters for receipts, reminders, tax, and profitability', () => {
  const filter = buildSaleFilter({
    taxInclusive: 'false',
    taxLabel: 'TVA.*',
    hasProforma: 'true',
    deliveryStart: '2026-01-01',
    deliveryEnd: '2026-01-31',
    paymentDetailMethod: 'MobileMoney',
    minPaidAmount: '1000',
    maxPaidAmount: '5000',
    paymentStart: '2026-01-02',
    paymentEnd: '2026-01-03',
    minProfitMargin: '12',
    reminderStatus: 'sent',
    saleSearch: 'ref-7',
    reminderSearch: 'rappel.*',
  });

  assert.equal(filter.taxInclusive, false);
  assert.deepEqual(filter.taxLabel, { $regex: 'TVA\\.\\*', $options: 'i' });
  assert.deepEqual(filter.sourceProforma, { $ne: null });
  assert.deepEqual(filter.deliveryDate.$gte.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.deepEqual(filter.payments.$elemMatch.method, 'MobileMoney');
  assert.deepEqual(filter.payments.$elemMatch.amount, { $gte: 1000, $lte: 5000 });
  assert.equal(filter.payments.$elemMatch.paymentDate.$lte.toISOString(), '2026-01-03T23:59:59.999Z');
  assert.deepEqual(filter['profitData.profitMargin'], { $gte: 12 });
  assert.equal(filter['paymentReminder.status'], 'sent');
  assert.deepEqual(filter.$and, [{
    $or: [
      { 'paymentReminder.reminderNote': { $regex: 'rappel\\.\\*', $options: 'i' } },
      { 'reminderLog.note': { $regex: 'rappel\\.\\*', $options: 'i' } },
    ],
  }]);
  assert.equal(filter.$or[0].reference.$regex, 'ref-7');
});
