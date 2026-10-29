import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import Overview from './Overview';
const mockFetch = jest.fn();
const mockOpen = jest.fn();
jest.mock('../context/DashboardDataContext', () => ({ useDashboardData: () => ({ fetchOverviewData: mockFetch }) }));
jest.mock('../context/ModalContext', () => ({ useModal: () => ({ openModal: mockOpen }) }));
let container;
let root;
const healthy = { errors: 0, reminders: {}, products: {}, delivery: {}, sales: { summary: { today: 1000, todayCount: 2 } }, paymentsToday: { total: 500, count: 1 } };
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const renderHome = async (admin = true) => {
  await act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ auth: { user: { _id: 'seller-1', isAdmin: admin, permissions: [] } }, hasFeature: () => false }}><Overview /></AuthContext.Provider></MemoryRouter>));
};
test('shows all alert categories before metrics and filters delivery links', async () => {
  mockFetch.mockResolvedValue({ ...healthy, reminders: { overdue: [{}], neverPaid: [{}], upcoming: [{}], salaryReminders: [{}] }, products: { outOfStockCount: 2, lowStockCount: 3 }, delivery: { pending: { count: 4 }, not_delivered: { count: 1 } } });
  await renderHome();
  const tasks = container.querySelector('[aria-labelledby="home-tasks-title"]');
  expect(tasks.querySelectorAll('li')).toHaveLength(7);
  expect(tasks.querySelector('a[href="/sales?delivery=pending"]')).not.toBeNull();
  expect(tasks.textContent).not.toContain('salaires');
  expect(tasks.compareDocumentPosition(container.querySelector('[aria-labelledby="home-today-title"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
test('offers seller workflow without administrator tasks or analytics', async () => {
  mockFetch.mockResolvedValue({ errors: 0, todaySales: { total: 500, count: 1 } });
  await renderHome(false);
  expect(container.querySelector('a[href="/sales/user/seller-1"]')).not.toBeNull();
  expect(container.querySelector('a[href="/dashboard"]')).toBeNull();
  expect(container.textContent).not.toContain('Saisir une dépense');
  act(() => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Nouvelle vente')).click());
  expect(mockOpen).toHaveBeenCalledWith('sale');
});
test('does not claim all clear with incomplete data and forces a retry', async () => {
  mockFetch.mockResolvedValue({ ...healthy, errors: 1, paymentsToday: null });
  await renderHome();
  expect(container.textContent).toContain('Les priorités ne peuvent pas être confirmées');
  expect(container.textContent).not.toContain('Aucune alerte à traiter');
  expect(container.textContent).toContain('Paiements indisponibles');
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Réessayer')).click());
  expect(mockFetch).toHaveBeenLastCalledWith('30days', true);
});
test('labels offline data and surfaces a refresh failure', async () => {
  mockFetch.mockResolvedValueOnce({ ...healthy, freshness: { offline: true, at: 1 } }).mockRejectedValueOnce(new Error('offline'));
  await renderHome();
  expect(container.textContent).toContain('Données enregistrées sur cet appareil');
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Actualiser')).click());
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
