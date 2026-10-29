import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SaleForm from './SaleForm';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { saleDraftKey, SALE_DRAFT_VERSION } from '../utils/saleDraft';
jest.mock('../context/AppSettingsContext', () => ({ useAppSettings: () => ({ appSettings: { branding: {} } }) }));
jest.mock('../services/api', () => ({ get: jest.fn().mockResolvedValue({ data: [] }), post: jest.fn() }));
jest.mock('../utils/proformaPdf', () => ({ generateProformaPdf: jest.fn() }));
jest.mock('./ExportSalesPdf', () => () => <button type="button">Télécharger la facture</button>);
let root, container;
const user = { _id: 'u1' };
const clients = [{ _id: 'c1', name: 'Alice' }];
const products = [{ _id: 'p1', name: 'Chaise', price: 500, costPrice: 100, stock: 8 }];
const key = tenantId => saleDraftKey({ tenantId, userId: 'u1' });
const draft = { version: SALE_DRAFT_VERSION, updatedAt: new Date().toISOString(), selectedClient: 'c1', selectedProducts: [{ product: 'p1', quantity: 2, price: 500 }], note: 'Commande conservée', paymentAmount: '100' };
const render = (tenantId = 'shop1', onSubmit = jest.fn()) => act(async () => root.render(<MemoryRouter><AuthContext.Provider value={{ auth: { tenantId, user }, hasFeature: () => true }}><SaleForm clients={clients} products={products} onSubmit={onSubmit} /></AuthContext.Provider></MemoryRouter>));
const click = text => act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes(text)).click());
const submit = () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const continueToReview = async () => {
  await click('Continuer vers les produits');
  await click('Continuer vers le paiement');
  await click('Vérifier la vente');
};
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
test('asks before restoring, preserves the stored draft until choice, and isolates shop changes', async () => {
  localStorage.setItem(key('shop1'), JSON.stringify(draft));
  await render();
  expect(container.textContent).toContain('Reprendre le brouillon');
  expect(JSON.parse(localStorage.getItem(key('shop1'))).note).toBe(draft.note);
  expect(container.querySelector('fieldset').disabled).toBe(true);
  await click('Reprendre le brouillon');
  expect(container.querySelector('textarea').value).toBe(draft.note);
  await render('shop2');
  expect(container.querySelector('textarea').value).toBe('');
  expect(localStorage.getItem(key('shop2'))).toBeNull();
  expect(JSON.parse(localStorage.getItem(key('shop1'))).note).toBe(draft.note);
});
test('discard removes the draft and does not immediately recreate an empty draft', async () => {
  localStorage.setItem(key('shop1'), JSON.stringify(draft)); await render();
  await click('Supprimer le brouillon');
  expect(localStorage.getItem(key('shop1'))).toBeNull();
  expect(container.querySelector('textarea').value).toBe('');
});
test('missing referenced client/product require reselection', async () => {
  localStorage.setItem(key('shop1'), JSON.stringify({ ...draft, selectedClient: 'removed', selectedProducts: [{ product: 'missing', quantity: 1, price: 100 }] }));
  const save = jest.fn(); await render('shop1', save); await click('Reprendre le brouillon');
  expect(container.textContent).toContain('ne sont plus disponibles');
  await act(async () => submit()); expect(save).not.toHaveBeenCalled();
});
test('locks simultaneous submissions and retains draft and input on failure', async () => {
  localStorage.setItem(key('shop1'), JSON.stringify(draft));
  let reject;
  const save = jest.fn(() => new Promise((_, fail) => { reject = fail; }));
  await render('shop1', save); await click('Reprendre le brouillon');
  await continueToReview();
  act(() => { submit(); submit(); });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Failed')));
  expect(container.querySelector('textarea').value).toBe(draft.note);
  expect(JSON.parse(localStorage.getItem(key('shop1'))).note).toBe(draft.note);
});
test('successful save removes the completed draft', async () => {
  localStorage.setItem(key('shop1'), JSON.stringify(draft));
  const save = jest.fn().mockResolvedValue({ _id: 'sale-1', client: { name: 'Alice' }, totalAmount: 1000, payments: [{ amount: 100 }] }); await render('shop1', save); await click('Reprendre le brouillon');
  await continueToReview();
  await act(async () => submit());
  expect(save).toHaveBeenCalledTimes(1); expect(localStorage.getItem(key('shop1'))).toBeNull();
  expect(container.textContent).toContain('Vente enregistrée');
  expect(container.textContent).toContain('Ouvrir pour encaisser');
  expect(container.querySelector('a[href="/sales/sale-1"]')).not.toBeNull();
  await click('Enregistrer une autre vente');
  expect(container.querySelector('textarea').value).toBe('');
});
test('requires each stage before review and summarizes the sale before saving', async () => {
  localStorage.setItem(key('shop1'), JSON.stringify(draft));
  const save = jest.fn().mockResolvedValue({}); await render('shop1', save); await click('Reprendre le brouillon');
  await continueToReview();
  expect(container.textContent).toContain('Vérification finale');
  expect(container.textContent).toContain('Alice');
  expect(container.textContent).toContain('Commande conservée');
  expect(container.textContent).toContain('1 000 CFA');
  expect(save).not.toHaveBeenCalled();
});
test('sale and proforma have separate draft states', async () => {
  localStorage.setItem(key('shop1'), JSON.stringify(draft)); await render(); await click('Reprendre le brouillon');
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Proforma').click());
  expect(container.querySelector('textarea').value).toBe('');
  expect(localStorage.getItem(saleDraftKey({ tenantId: 'shop1', userId: 'u1', mode: 'proforma' }))).toBeNull();
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Vente').click());
  expect(container.textContent).toContain('Reprendre le brouillon');
});
test('blocked storage explains drafts are unavailable and leaves the form usable', async () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  try {
    await render();
    expect(container.textContent).toContain('ne peut pas être enregistré');
    expect(container.querySelector('fieldset').disabled).toBe(false);
  } finally { spy.mockRestore(); }
});
