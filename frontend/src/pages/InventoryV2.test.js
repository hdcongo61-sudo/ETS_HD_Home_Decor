import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InventoryV2 from './InventoryV2';
import AuthContext from '../context/AuthContext';
import { inventoryApi } from '../features/inventory/api';
import { platformApi } from '../features/platform/api';
import { confirmDialog } from '../components/ConfirmProvider';
import { catalogApi } from '../features/catalog/api';

jest.mock('../components/ConfirmProvider', () => ({ confirmDialog: jest.fn().mockResolvedValue(true) }));
jest.mock('../features/inventory/api', () => ({ inventoryApi: { balances: jest.fn(), transfers: jest.fn(), counts: jest.fn(), movements: jest.fn(), reconciliation: jest.fn(), postCount: jest.fn().mockResolvedValue({ data: {} }) } }));
jest.mock('../features/platform/api', () => ({ platformApi: { locations: jest.fn(), myMemberships: jest.fn() } }));
jest.mock('../features/catalog/api', () => ({ catalogApi: { list: jest.fn() } }));
jest.mock('../context/LocationContext', () => ({ useLocations: () => ({ activeLocationId: 'loc1' }) }));
let root, container;
const auth = { tenantId: 'tenant1', user: { _id: 'u1' }, isAdmin: false };
const failure = { response: { status: 503, data: { message: 'Service indisponible', requestId: 'stock-42' } } };
const render = (value = auth) => act(async () => root.render(<AuthContext.Provider value={{ auth: value }}><InventoryV2 /></AuthContext.Provider>));
const click = text => act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes(text)).click());
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  confirmDialog.mockResolvedValue(true);
  inventoryApi.postCount.mockResolvedValue({ data: {} });
  ['balances', 'transfers', 'counts', 'movements'].forEach(key => inventoryApi[key].mockResolvedValue({ data: [] }));
  inventoryApi.reconciliation.mockResolvedValue({ data: { coherent: true, mismatches: [], productsChecked: 0 } });
  platformApi.locations.mockResolvedValue({ data: [{ _id: 'loc1', name: 'Centre' }] });
  platformApi.myMemberships.mockResolvedValue({ data: [] });
  catalogApi.list.mockResolvedValue({ data: [] });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('failed initial data is unavailable rather than empty, and retry only reloads that section', async () => {
  inventoryApi.balances.mockRejectedValueOnce(failure);
  await render();
  expect(container.textContent).not.toContain('Aucun solde');
  expect(container.textContent).toContain('Indisponible');
  expect(container.querySelector('[role="alert"]').textContent).toContain('stock-42');
  await click('Réessayer');
  expect(container.textContent).toContain('Aucun solde');
  expect(inventoryApi.balances).toHaveBeenCalledTimes(2);
  expect(inventoryApi.transfers).toHaveBeenCalledTimes(1);
});
test('failed refresh retains successful balances with a freshness warning', async () => {
  inventoryApi.balances.mockResolvedValueOnce({ data: [{ _id: 'b1', productId: { name: 'Fauteuil' }, onHand: 8, available: 8 }] });
  await render();
  inventoryApi.balances.mockRejectedValueOnce(failure);
  await click('Actualiser');
  expect(container.textContent).toContain('Fauteuil');
  expect(container.textContent).toContain('Dernières données chargées');
  expect(container.textContent).toContain('Données à actualiser');
});
test('read-only users keep reports but do not receive mutation controls', async () => {
  inventoryApi.counts.mockResolvedValue({ data: [{ _id: 'c1', status: 'open', lines: [{ product: 'p1', expectedQuantity: 4 }] }] });
  await render(); await click('Transferts');
  expect(container.textContent).toContain('Consultation uniquement');
  expect(container.textContent).not.toContain('Nouveau transfert');
  await click('Inventaires');
  expect(container.querySelector('input[type="number"]')).toBeNull();
  expect(container.textContent).not.toContain('Publier');
  await click('Ajustements');
  expect(container.textContent).not.toContain('Nouvel ajustement');
});
test('uses only active-tenant membership permissions and location scope', async () => {
  platformApi.myMemberships.mockResolvedValue({ data: [
    { tenantId: 'other', status: 'active', permissions: ['*'] },
    { tenantId: 'tenant1', status: 'active', permissions: ['inventory.adjust'], allLocations: false, locationIds: ['elsewhere'] },
  ] });
  await render(); await click('Transferts');
  expect(container.textContent).not.toContain('Nouveau transfert');
  await click('Ajustements');
  expect(container.textContent).not.toContain('Nouvel ajustement');
});
test('individual transfer permission and administrator compatibility expose correct actions', async () => {
  platformApi.myMemberships.mockResolvedValue({ data: [{ tenantId: 'tenant1', status: 'active', permissions: ['inventory.transfer'] }] });
  await render(); await click('Transferts');
  expect(container.textContent).toContain('Nouveau transfert');
  await click('Ajustements'); expect(container.textContent).not.toContain('Nouvel ajustement');
  await render({ ...auth, isAdmin: true });
  expect(container.textContent).toContain('Nouvel ajustement');
});
test('lookup failure has a targeted retry and disables creation until recovery', async () => {
  platformApi.locations.mockRejectedValueOnce(failure);
  await render({ ...auth, isAdmin: true }); await click('Transferts');
  expect([...container.querySelectorAll('button')].find(button => button.textContent.includes('Nouveau transfert')).disabled).toBe(true);
  await click('Réessayer');
  expect([...container.querySelectorAll('button')].find(button => button.textContent.includes('Nouveau transfert')).disabled).toBe(false);
});
test('permission lookup failure is explicit and does not grant actions', async () => {
  platformApi.myMemberships.mockRejectedValueOnce(failure);
  await render(); await click('Transferts');
  expect(container.textContent).toContain('stock-42');
  expect(container.textContent).not.toContain('Nouveau transfert');
  await click('Réessayer');
  expect(platformApi.myMemberships).toHaveBeenCalledTimes(2);
});
test('a slow section does not block successful sections or navigation', async () => {
  let resolve;
  inventoryApi.transfers.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render();
  expect(container.textContent).toContain('Aucun solde');
  await click('Transferts');
  expect(container.textContent).not.toContain('Aucun transfert');
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  await act(async () => resolve({ data: [] }));
  expect(container.textContent).toContain('Aucun transfert');
});
test('supervision remains read-only even for an administrator', async () => {
  sessionStorage.setItem('impersonating', 'true');
  try {
    await render({ ...auth, isAdmin: true }); await click('Transferts');
    expect(container.textContent).not.toContain('Nouveau transfert');
  } finally { sessionStorage.removeItem('impersonating'); }
});
test('failed movement and reconciliation loads do not claim empty or coherent results', async () => {
  inventoryApi.movements.mockRejectedValueOnce(failure);
  inventoryApi.reconciliation.mockRejectedValueOnce(failure);
  await render(); await click('Ajustements');
  expect(container.textContent).not.toContain('Aucun mouvement');
  await click('Rapprochement');
  expect(container.textContent).not.toContain('sont cohérents');
  expect(container.textContent).not.toContain('À corriger');
  expect(container.textContent).toContain('stock-42');
});
test('refreshing unavailable lookups retains an open form and its entered note', async () => {
  await render({ ...auth, isAdmin: true }); await click('Transferts'); await click('Nouveau transfert');
  await act(async () => {
    const input = container.querySelector('input[type="text"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Livraison vendredi');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  platformApi.locations.mockRejectedValueOnce(failure);
  await click('Actualiser');
  expect(container.querySelector('input[type="text"]').value).toBe('Livraison vendredi');
  expect(container.querySelector('fieldset').disabled).toBe(true);
  await click('Réessayer');
  expect(container.querySelector('input[type="text"]').value).toBe('Livraison vendredi');
  expect(container.querySelector('fieldset').disabled).toBe(false);
});
test('two open counts keep separate quantities for the same product', async () => {
  inventoryApi.counts.mockResolvedValue({ data: [
    { _id: 'count1', status: 'open', lines: [{ product: 'p1', expectedQuantity: 4 }] },
    { _id: 'count2', status: 'open', lines: [{ product: 'p1', expectedQuantity: 6 }] },
  ] });
  await render({ ...auth, isAdmin: true }); await click('Inventaires');
  const inputs = container.querySelectorAll('input[type="number"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inputs[0], '3');
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(inputs[0].value).toBe('3'); expect(inputs[1].value).toBe('');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inputs[1], '5');
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(inputs[0].value).toBe('3'); expect(inputs[1].value).toBe('5');
});
test('publishing one count sends its own quantity and retains another count input', async () => {
  inventoryApi.counts.mockResolvedValue({ data: [
    { _id: 'count1', status: 'open', lines: [{ product: 'p1', expectedQuantity: 4 }] },
    { _id: 'count2', status: 'open', lines: [{ product: 'p1', expectedQuantity: 6 }] },
  ] });
  await render({ ...auth, isAdmin: true }); await click('Inventaires');
  for (const [index, value] of ['3', '5'].entries()) {
    await act(async () => {
      const input = container.querySelectorAll('input[type="number"]')[index];
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  await click('Publier');
  expect(inventoryApi.postCount).toHaveBeenCalledWith('count1', { countedQuantities: { p1: 3 } });
  expect(container.querySelectorAll('input[type="number"]')[1].value).toBe('5');
});
