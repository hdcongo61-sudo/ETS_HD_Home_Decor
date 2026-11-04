import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import UltimateFiltersPage from './UltimateFilters';
import api from '../services/api';
import { platformApi } from '../features/platform/api';
import { catalogApi } from '../features/catalog/api';
import { attributeApi } from '../services/variantApi';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('../features/platform/api', () => ({
  platformApi: {
    users: jest.fn(),
    locations: jest.fn(),
  },
}));
jest.mock('../features/catalog/api', () => ({
  catalogApi: { fieldValues: jest.fn() },
}));
jest.mock('../services/variantApi', () => ({
  attributeApi: { list: jest.fn() },
}));
jest.mock('../components/business', () => ({
  Workspace: ({ children }) => <div>{children}</div>,
}));
jest.mock('../components/SectionError', () => () => null);
jest.mock('xlsx', () => ({ utils: {}, writeFile: jest.fn() }));
jest.mock('jspdf', () => ({
  jsPDF: jest.fn(() => ({ setFontSize: jest.fn(), text: jest.fn(), autoTable: jest.fn(), save: jest.fn() })),
}));
jest.mock('jspdf-autotable', () => ({}));

let root;
let container;

const setSelect = async (select, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
});

const setDate = async (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

const clickText = async (text) => act(async () => {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent.includes(text));
  button.click();
});

const waitForFilterRequests = () => act(async () => {
  await new Promise(resolve => window.setTimeout(resolve, 350));
});

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  platformApi.users.mockResolvedValue({ data: [] });
  platformApi.locations.mockResolvedValue({ data: [] });
  catalogApi.fieldValues.mockResolvedValue({
    data: {
      categories: ['Salon'],
      suppliers: [],
      containers: ['Dépôt A', 'Dépôt B'],
      warehouses: ['Entrepôt 1', 'Entrepôt 2'],
    },
  });
  attributeApi.list.mockResolvedValue({
    data: [{
      key: 'color',
      label: 'Couleur',
      dataType: 'select',
      options: ['Rouge', 'Bleu'],
      isActive: true,
      filterable: true,
      variantAxis: true,
    }],
  });
  api.get.mockImplementation((path) => Promise.resolve({
    data: path === '/sales/product-analysis'
      ? {
        data: [],
        pagination: { total: 0 },
        summary: { matchedProducts: 4, sales: 3, quantity: 8, lineAmount: 16000 },
      }
      : [],
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('compares two container values using the other active product filters', async () => {
  await act(async () => root.render(
    <MemoryRouter>
      <UltimateFiltersPage />
    </MemoryRouter>
  ));
  await clickText('Ventes + produits');
  await waitForFilterRequests();

  const category = [...container.querySelectorAll('select')]
    .find(select => [...select.options].some(option => option.value === 'Salon'));
  await setSelect(category, 'Salon');
  await clickText('Filtres avancés');

  await setSelect(container.querySelector('#comparison-field'), 'container');
  await setSelect(container.querySelector('#comparison-first'), 'Dépôt A');
  await setSelect(container.querySelector('#comparison-second'), 'Dépôt B');
  await waitForFilterRequests();

  expect(container.textContent).toContain('Comparaison · Conteneur');
  expect(container.textContent).toContain('Dépôt A');
  expect(container.textContent).toContain('Dépôt B');
  const comparisonCalls = api.get.mock.calls.filter(([path, config]) =>
    path === '/sales/product-analysis'
    && ['Dépôt A', 'Dépôt B'].includes(config?.params?.container)
  );
  expect(comparisonCalls).toHaveLength(2);
  comparisonCalls.forEach(([, config]) => {
    expect(config.params.category).toBe('Salon');
    expect(config.params.limit).toBe(1);
  });

  api.get.mockClear();
  await setSelect(container.querySelector('#comparison-field'), 'variant_color');
  await setSelect(container.querySelector('#comparison-first'), 'Rouge');
  await setSelect(container.querySelector('#comparison-second'), 'Bleu');
  await waitForFilterRequests();

  const variantComparisonCalls = api.get.mock.calls.filter(([path, config]) =>
    path === '/sales/product-analysis'
    && ['Rouge', 'Bleu'].includes(config?.params?.variant_color)
  );
  expect(variantComparisonCalls).toHaveLength(2);
  variantComparisonCalls.forEach(([, config]) => {
    expect(config.params.category).toBe('Salon');
  });

  api.get.mockClear();
  await setSelect(container.querySelector('#comparison-field'), 'status');
  await setSelect(container.querySelector('#comparison-first'), 'completed');
  await setSelect(container.querySelector('#comparison-second'), 'cancelled');
  await waitForFilterRequests();

  const statusComparisonCalls = api.get.mock.calls.filter(([path, config]) =>
    path === '/sales/product-analysis'
    && ['completed', 'cancelled'].includes(config?.params?.status)
  );
  expect(statusComparisonCalls).toHaveLength(2);
  statusComparisonCalls.forEach(([, config]) => {
    expect(config.params.category).toBe('Salon');
  });

  api.get.mockClear();
  await setSelect(container.querySelector('#comparison-field'), 'dateRange');
  await setDate(container.querySelector('[aria-label="Première valeur du"]'), '2026-10-01');
  await setDate(container.querySelector('[aria-label="Première valeur au"]'), '2026-10-31');
  await setDate(container.querySelector('[aria-label="Deuxième valeur du"]'), '2026-11-01');
  await setDate(container.querySelector('[aria-label="Deuxième valeur au"]'), '2026-11-30');
  await waitForFilterRequests();

  expect(container.textContent).toContain('Période de vente');
  const periodComparisonCalls = api.get.mock.calls.filter(([path, config]) =>
    path === '/sales/product-analysis'
    && ['2026-10-01', '2026-11-01'].includes(config?.params?.startDate)
  );
  expect(periodComparisonCalls).toHaveLength(2);
  expect(periodComparisonCalls.map(([, config]) => config.params.startDate).sort()).toEqual(['2026-10-01', '2026-11-01']);
  periodComparisonCalls.forEach(([, config]) => {
    expect(config.params.category).toBe('Salon');
    expect(config.params.endDate).toMatch(/^2026-(10-31|11-30)$/);
  });
});
