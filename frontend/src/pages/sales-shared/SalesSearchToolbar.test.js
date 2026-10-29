import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import SalesSearchToolbar from './SalesSearchToolbar';
import SaleCard from './SaleCard';
import { buildSalesReturnSearch } from './salesSearch';
let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
test('keeps search, individual filter removal, and reset available', () => {
  const onChange = jest.fn(), onRemove = jest.fn(), onReset = jest.fn();
  act(() => root.render(<SalesSearchToolbar value="Elodie" onChange={onChange} filters={[{ key: 'delivery', label: 'Livraison : En attente', onRemove }]} onReset={onReset} count={2} />));
  const input = container.querySelector('input[type="search"]');
  expect(container.querySelector('label').htmlFor).toBe(input.id);
  expect(container.querySelector('[role="status"]').textContent).toContain('2 ventes affichées');
  act(() => container.querySelector('[aria-label="Retirer le filtre Livraison : En attente"]').click());
  expect(onRemove).toHaveBeenCalledTimes(1);
  act(() => container.querySelector('[aria-label="Effacer la recherche"]').click());
  expect(onChange).toHaveBeenCalledWith('');
  act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Tout effacer').click());
  expect(onReset).toHaveBeenCalledTimes(1);
});
test('sale links carry search and filters back to history', () => {
  const returnTo = '/sales' + buildSalesReturnSearch({ searchTerm: 'Élodie', deliveryFilter: 'pending', quickFilters: { latePayments: true } });
  act(() => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SaleCard sale={{ _id: 'sale123456', client: { name: 'Élodie' }, totalAmount: 1000 }} totalPaid={300} balance={700} formatDate={() => '25/10/2026'} getStatusText={() => 'Partiellement payée'} returnTo={returnTo} /></MemoryRouter>));
  const href = container.querySelector('a').getAttribute('href');
  expect(new URL(href, 'http://localhost').searchParams.get('returnToSales')).toBe(returnTo);
  expect(container.textContent).toContain('700 CFA');
});
