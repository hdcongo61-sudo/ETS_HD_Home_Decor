import { saleDraftKey, readSaleDraft, hasSaleDraftContent, SALE_DRAFT_VERSION, SALE_DRAFT_TTL } from './saleDraft';
const now = Date.parse('2026-10-25T10:00:00Z');
const draft = { version: SALE_DRAFT_VERSION, updatedAt: new Date(now).toISOString(), selectedClient: 'c1', selectedProducts: [{ product: 'p1', quantity: 2, price: 500 }] };
beforeEach(() => localStorage.clear());
test('isolates shop, account and document mode and rejects unidentified principals', () => {
  const base = { tenantId: 'shop1', userId: 'u1' };
  const keys = [saleDraftKey(base), saleDraftKey({ ...base, tenantId: 'shop2' }), saleDraftKey({ ...base, userId: 'u2' }), saleDraftKey({ ...base, mode: 'proforma' })];
  expect(new Set(keys).size).toBe(4); expect(saleDraftKey({ userId: 'u1' })).toBe('');
  expect(saleDraftKey({ ...base, mode: 'invalid' })).toBe('');
});
test('reads only supported fresh valid draft data', () => {
  localStorage.setItem('key', JSON.stringify(draft)); expect(readSaleDraft(localStorage, 'key', now)).toEqual(draft);
  [null, { ...draft, version: 1 }, { ...draft, updatedAt: 'bad' }, { ...draft, updatedAt: new Date(now - SALE_DRAFT_TTL - 1).toISOString() }, { ...draft, updatedAt: new Date(now + 1).toISOString() }, { ...draft, selectedProducts: [null] }, { ...draft, selectedProducts: [{ product: 'p1', quantity: -1, price: 1 }] }].forEach(value => {
    localStorage.setItem('key', JSON.stringify(value)); expect(readSaleDraft(localStorage, 'key', now)).toBeNull(); expect(localStorage.getItem('key')).toBeNull();
  });
  localStorage.setItem('key', '{broken'); expect(readSaleDraft(localStorage, 'key', now)).toBeNull();
});
test('does not restore or migrate legacy ambiguous keys', () => {
  localStorage.setItem('sale-draft:u1', JSON.stringify(draft));
  expect(readSaleDraft(localStorage, saleDraftKey({ tenantId: 'shop1', userId: 'u1' }), now)).toBeNull();
});
test('avoids saving blank forms', () => {
  const empty = { selectedClient: '', selectedProducts: [{ product: '' }], note: '', paymentAmount: '', reminderNote: '', saleDate: '' };
  expect(hasSaleDraftContent(empty)).toBe(false);
  expect(hasSaleDraftContent({ ...empty, selectedClient: 'c1' })).toBe(true);
});
