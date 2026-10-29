import { salesMemoryScope, saveSalesList, readSalesList, getSalesListReturn } from './salesListMemory';
const auth = { tenantId: 'shop-1', user: { _id: 'user-1' } };
const scope = salesMemoryScope(auth);
const location = { key: 'list-1', pathname: '/sales', search: '?delivery=pending', hash: '' };
const snapshot = { path: '/sales?delivery=pending', search: '?workspace=history&delivery=pending&q=Elodie', scrollY: 900, saleId: 'sale-1' };
beforeEach(() => sessionStorage.clear());
test('keeps snapshots isolated by shop, user, and history entry', () => {
  saveSalesList(scope, 'list-1', snapshot);
  expect(readSalesList(scope, 'list-1')).toMatchObject(snapshot);
  expect(readSalesList(salesMemoryScope({ ...auth, tenantId: 'shop-2' }), 'list-1')).toBeNull();
  expect(readSalesList(salesMemoryScope({ ...auth, user: { _id: 'user-2' } }), 'list-1')).toBeNull();
  expect(readSalesList(scope, 'list-2')).toBeNull();
  saveSalesList(null, 'anonymous', snapshot);
  expect(readSalesList(null, 'anonymous')).toBeNull();
  expect(salesMemoryScope({ user: auth.user })).toBeNull();
});
test('restores Back and explicit matching returns without overriding fresh links', () => {
  saveSalesList(scope, location.key, snapshot);
  expect(getSalesListReturn(scope, location, 'POP')).toMatchObject(snapshot);
  expect(getSalesListReturn(scope, location, 'PUSH')).toBeNull();
  expect(getSalesListReturn(scope, { ...location, hash: '#sale-form' }, 'POP')).toBeNull();
  const explicit = { ...location, key: 'new-entry', search: snapshot.search + '&resume=list-1' };
  expect(getSalesListReturn(scope, explicit, 'PUSH')).toMatchObject(snapshot);
  expect(getSalesListReturn(scope, { ...explicit, search: '?q=Other&resume=list-1' }, 'PUSH')).toBeNull();
});
test('ignores expired, malformed snapshots and unavailable storage', () => {
  saveSalesList(scope, 'old', { ...snapshot, scrollY: -1 });
  expect(readSalesList(scope, 'old')).toBeNull();
  saveSalesList(scope, 'list-1', snapshot);
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
  expect(readSalesList(scope, 'list-1')).toBeNull();
  now.mockRestore();
  const invalid = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('{broken');
  expect(readSalesList(scope, 'list-1')).toBeNull();
  invalid.mockRestore();
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
  expect(() => saveSalesList(scope, 'blocked', snapshot)).not.toThrow();
  storage.mockRestore();
});
