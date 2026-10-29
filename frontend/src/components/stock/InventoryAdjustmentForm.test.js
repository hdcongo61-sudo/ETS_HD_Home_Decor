import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InventoryAdjustmentForm from './InventoryAdjustmentForm';
import { inventoryApi } from '../../features/inventory/api';
jest.mock('../../features/inventory/api', () => ({ inventoryApi: { balances: jest.fn(), adjust: jest.fn() } }));
let root, container;
const saved = jest.fn();
const rows = [{ locationId: 'loc-1', variantId: { isDefault: true }, onHand: 8 }];
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); inventoryApi.balances.mockResolvedValue({ data: { balances: rows } });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(<InventoryAdjustmentForm products={[{ _id: 'p1', name: 'Chaise' }]} location={{ _id: 'loc-1', name: 'Centre' }} onSaved={saved} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const set = async (selector, value) => act(async () => { const node = container.querySelector(selector); const proto = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value); node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
const submit = () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
test('requires a reason, previews the selected location, and reviews before mutation', async () => {
  await set('select', 'p1'); await set('input[type="number"]', '-3'); await submit();
  expect(container.textContent).toContain('motif de cet ajustement est obligatoire');
  await set('textarea', 'Comptage corrigé'); await submit();
  expect(inventoryApi.balances).toHaveBeenCalledWith({ productId: 'p1', locationId: 'loc-1' });
  expect(container.querySelector('[aria-label="Aperçu de l’ajustement"]').textContent).toContain('Stock après : 5');
  expect(inventoryApi.adjust).not.toHaveBeenCalled();
});
test('blocks a negative stock result and invalid cost', async () => {
  await set('select', 'p1'); await set('textarea', 'Correction'); await set('input[type="number"]', '-9'); await submit();
  expect(container.textContent).toContain('8 unités en stock');
  await set('input[type="number"]', '2'); await set('input[min="0"]', '-1'); await submit();
  expect(container.textContent).toContain('coût unitaire');
  expect(inventoryApi.adjust).not.toHaveBeenCalled();
});
test('retains failed inputs, blocks duplicate clicks and reports authoritative result', async () => {
  await set('select', 'p1'); await set('input[type="number"]', '-3'); await set('textarea', 'Correction'); await submit();
  inventoryApi.adjust.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Service indisponible', requestId: 'adjust-42' } } });
  await submit();
  expect(container.querySelector('[role="alert"]').textContent).toContain('adjust-42');
  expect(container.querySelector('textarea').value).toBe('Correction');
  let resolve;
  inventoryApi.adjust.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  act(() => { const form = container.querySelector('form'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(inventoryApi.adjust).toHaveBeenCalledTimes(2);
  await act(async () => resolve({ data: { balance: { onHand: 4 } } }));
  expect(container.textContent).toContain('Stock confirmé : 4 unités');
  expect(saved).toHaveBeenCalledTimes(1);
  expect(inventoryApi.adjust).toHaveBeenLastCalledWith({ productId: 'p1', quantity: -3, unitCost: 0, note: 'Correction' });
});
test('does not pretend a missing balance is zero', async () => {
  inventoryApi.balances.mockResolvedValueOnce({ data: { balances: [] } });
  await set('select', 'p1');
  expect(container.textContent).toContain('aucun solde nul n’est supposé');
});

test('conflict reloads the balance and requires a fresh review without losing the reason', async () => {
  await set('select', 'p1'); await set('input[type="number"]', '-3'); await set('textarea', 'Correction'); await submit();
  inventoryApi.balances.mockResolvedValueOnce({ data: { balances: [{ ...rows[0], onHand: 6 }] } });
  inventoryApi.adjust.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Stock modifié' } } });
  await submit();
  expect(container.querySelector('textarea').value).toBe('Correction');
  expect(container.querySelector('[aria-label="Aperçu de l’ajustement"]').textContent).toContain('Stock après : 3');
  expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Vérifier l’ajustement')).toBe(true);
  expect(inventoryApi.adjust).toHaveBeenCalledTimes(1);
});
