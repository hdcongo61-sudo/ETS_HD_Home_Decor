import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
jest.mock('date-fns/locale', () => ({ fr: require('date-fns/locale/fr.cjs').fr }));
jest.mock('../services/api', () => ({ get: jest.fn() }));
jest.mock('../context/DashboardDataContext', () => ({ useDashboardData: () => ({}) }));
jest.mock('../context/AppSettingsContext', () => ({ useAppSettings: () => ({ appSettings: { branding: {} } }) }));
jest.mock('./FeatureGate', () => ({ useFeature: () => true, LockedFeatureButton: () => null }));
jest.mock('./ExportModal', () => () => null);
jest.mock('recharts', () => {
  const React = require('react'); const View = ({ children }) => React.createElement('div', null, children);
  return { ComposedChart: () => null, ...Object.fromEntries(['Bar','Line','Area','XAxis','YAxis','CartesianGrid','Tooltip','Legend','ResponsiveContainer','LineChart','BarChart'].map(name => [name, View])) };
});
let container, root;
const render = () => act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={{ auth: { user: { _id: 'u1', isAdmin: false, permissions: ['view_dashboard'] } } }}><Dashboard /></AuthContext.Provider></MemoryRouter>));
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); api.get.mockResolvedValue({ data: [] }); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
test('dashboard leads with analysis and offers accessible source data actions', async () => {
  await render();
  expect(container.querySelector('h1').textContent).toBe('Tableau de bord');
  expect(container.textContent).not.toContain('Données derrière les graphiques');
  expect(container.textContent).not.toContain('Pages rattachées');
  expect(container.querySelector('a[href="/sales?workspace=history"]')).not.toBeNull();
});
test('first financial failure never renders fabricated zero KPI values and can retry', async () => {
  api.get.mockImplementation(url => url.includes('date-range') ? Promise.reject({ response: { status: 503, data: { message: 'Indisponible', requestId: 'dash-42' } } }) : Promise.resolve({ data: [] }));
  await render(); expect(container.textContent).toContain('dash-42');
  expect(container.textContent).not.toContain('Ventes totales');
  api.get.mockResolvedValue({ data: [] });
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Réessayer')).click());
  expect(container.textContent).toContain('Ventes totales');
});
