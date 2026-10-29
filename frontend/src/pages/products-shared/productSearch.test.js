import { matchesProductSearch } from './productSearch';
const product = { name: 'Étagère Chêne', sku: 'HD-042' };
test.each(['etagere', 'CHÊNE', 'hd-042', ' HD-04 ', ''])('matches name or SKU using %s', query => expect(matchesProductSearch(product, query)).toBe(true));
test('rejects other references and handles missing names and SKUs', () => {
  expect(matchesProductSearch(product, 'HD-999')).toBe(false);
  expect(matchesProductSearch({}, 'HD')).toBe(false);
});
