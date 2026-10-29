import { matchesSaleSearch, readSalesSearch, buildSalesReturnSearch, EMPTY_QUICK_FILTERS } from './salesSearch';
const sale = { _id: 'abcdef123456', reference: 'FAC-2026-015', client: { name: 'Élodie Mbuyi', phone: '+242 06 123 45 67' } };
test.each(['fac-2026', '123456', 'elodie', 'MBUYI', '061234567', '+242 (06) 123-45-67', '  Élodie  '])('finds a sale using %s', query => {
  expect(matchesSaleSearch(sale, query)).toBe(true);
});
test('rejects unrelated text containing digits and handles missing clients', () => {
  expect(matchesSaleSearch(sale, 'client 061234567')).toBe(false);
  expect(matchesSaleSearch(sale, 'Alice')).toBe(false);
  expect(matchesSaleSearch({ _id: 'other', client: null }, 'Elodie')).toBe(false);
  expect(matchesSaleSearch(sale, ' ')).toBe(true);
});
test('restores every filter and search from a detail return link', () => {
  const filters = { statusFilter: 'partially_paid', clientFilter: 'client-1', sellerFilter: 'seller-1', saleTypeFilter: 'wholesale', paymentStructureFilter: 'multiple_payments', dateFilter: '2026-10-24', deliveryFilter: 'pending', containerFilter: 'Lot & 2', searchTerm: 'Élodie +242', quickFilters: { ...EMPTY_QUICK_FILTERS, highValue: true, recurring: true } };
  const query = buildSalesReturnSearch(filters);
  expect(new URLSearchParams(query).get('workspace')).toBe('history');
  expect(readSalesSearch(query)).toEqual(filters);
});
test('deep links and cleared filters do not introduce an implicit today filter', () => {
  expect(readSalesSearch('?delivery=pending').dateFilter).toBe('');
  const filters = readSalesSearch('');
  expect(readSalesSearch(buildSalesReturnSearch(filters))).toEqual(filters);
  expect(filters.quickFilters).toEqual(EMPTY_QUICK_FILTERS);
  expect(readSalesSearch('?quick=unknown').quickFilters).toEqual(EMPTY_QUICK_FILTERS);
});
