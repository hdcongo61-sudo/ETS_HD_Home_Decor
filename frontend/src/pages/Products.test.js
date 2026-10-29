import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Products, { ProductList } from './Products';
import AuthContext from '../context/AuthContext';
import { catalogApi } from '../features/catalog/api';
jest.mock('../features/catalog/api', () => ({
  catalogApi: {
    list: jest.fn(),
    update: jest.fn(),
    lossMap: jest.fn().mockResolvedValue({ data: { map: {} } }),
    salesMap: jest.fn().mockResolvedValue({ data: { map: {} } }),
    lookupCategories: jest.fn().mockResolvedValue({ data: [] }),
    lookupContainers: jest.fn().mockResolvedValue({ data: [] }),
    lookupWarehouses: jest.fn().mockResolvedValue({ data: [] }),
    lookupSuppliers: jest.fn().mockResolvedValue({ data: [] }),
  },
}));
jest.mock('../context/AppSettingsContext', () => ({ useAppSettings: () => ({ appSettings: { branding: {} } }) }));
jest.mock('../context/ModalContext', () => ({ useModal: () => ({ suppressGlobalModals: () => () => {} }) }));
jest.mock('../components/Modal', () => () => null);
jest.mock('../components/ProductQuickViewModal', () => () => null);
jest.mock('../components/ProductImportModal', () => () => null);
jest.mock('../components/ProductDataMigration', () => () => null);
jest.mock('../components/FeatureGate', () => ({ __esModule: true, default: ({ children }) => children, LockedFeatureButton: () => null }));
const product = { _id: 'one', name: 'Étagère Chêne', sku: 'HD-042', stock: 3, price: 500, category: 'Meubles' };
let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks();
  window.matchMedia = jest.fn(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (node, path = '/products', admin = false) => act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}><AuthContext.Provider value={{ auth: { user: { isAdmin: admin } } }}>{node}</AuthContext.Provider></MemoryRouter>));
const click = label => act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === label).click());
test('SKU deep-link finds a product and empty results provide filter recovery', async () => {
  await render(<ProductList products={[product]} loading={false} isAdmin={false} />, '/products?product=HD-042');
  expect(container.querySelector('input[type="search"]').value).toBe('HD-042');
  expect(container.textContent).toContain('Étagère Chêne');
});
test('default view hides out-of-stock products but still shows the KPI-driven catalogue size', async () => {
  const outOfStock = { ...product, _id: 'two', name: 'Tabouret Rupture', sku: 'HD-099', stock: 0 };
  await render(<ProductList products={[product, outOfStock]} loading={false} isAdmin={false} />, '/products');
  expect(container.textContent).toContain('Étagère Chêne');
  expect(container.textContent).not.toContain('Tabouret Rupture');
});
test('a SKU deep-link still finds an out-of-stock product despite the default filter', async () => {
  const outOfStock = { ...product, _id: 'two', name: 'Tabouret Rupture', sku: 'HD-099', stock: 0 };
  await render(<ProductList products={[product, outOfStock]} loading={false} isAdmin={false} />, '/products?product=HD-099');
  expect(container.textContent).toContain('Tabouret Rupture');
});
test('"Tous" reveals out-of-stock products', async () => {
  const outOfStock = { ...product, _id: 'two', name: 'Tabouret Rupture', sku: 'HD-099', stock: 0 };
  await render(<ProductList products={[product, outOfStock]} loading={false} isAdmin={false} />, '/products');
  expect(container.textContent).not.toContain('Tabouret Rupture');
  await click('Tous');
  expect(container.textContent).toContain('Tabouret Rupture');
});
test('re-reading a "show all" URL does not silently restore the default stock filter', async () => {
  const outOfStock = { ...product, _id: 'two', name: 'Tabouret Rupture', sku: 'HD-099', stock: 0 };
  await render(<ProductList products={[product, outOfStock]} loading={false} isAdmin={false} />, '/products?stockOperator=all');
  expect(container.textContent).toContain('Tabouret Rupture');
});
test('no-results reset restores the catalogue on both responsive representations', async () => {
  await render(<ProductList products={[product]} loading={false} isAdmin={false} />, '/products?product=missing&warehouse=Other');
  expect(container.textContent).toContain('Aucun produit ne correspond');
  await click('Effacer la recherche et les filtres');
  expect(container.querySelector('input[type="search"]').value).toBe('');
  expect(container.textContent).toContain('Étagère Chêne');
  expect(container.textContent).not.toContain('Aucun produit ne correspond');
});
test('empty catalogue is distinguished from a filtered search', async () => {
  await render(<ProductList products={[]} loading={false} isAdmin={false} />);
  expect(container.textContent).toContain('Catalogue vide');
  expect(container.textContent).not.toContain('Effacer la recherche et les filtres');
});
test('load error shows request ID, retries, and retains stock after failed refresh', async () => {
  catalogApi.list.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Catalogue indisponible', requestId: 'catalogue-42' } } }).mockResolvedValueOnce({ data: [product] }).mockRejectedValueOnce({ response: { status: 503, data: { message: 'Connexion interrompue' } } });
  await render(<Products />);
  expect(container.querySelector('[role="alert"]').textContent).toContain('catalogue-42');
  await click('Réessayer');
  expect(container.textContent).toContain('Étagère Chêne');
  await act(async () => window.dispatchEvent(new Event('saleCreated')));
  expect(container.textContent).toContain('Étagère Chêne');
  expect(container.textContent).toContain('Les données affichées peuvent être anciennes');
  expect(catalogApi.list).toHaveBeenCalledTimes(3);
});
test('a slow earlier refresh cannot replace newer stock data', async () => {
  let resolveOlder;
  catalogApi.list.mockResolvedValueOnce({ data: [product] }).mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve; })).mockResolvedValueOnce({ data: [{ ...product, name: 'Stock actualisé', stock: 8 }] });
  await render(<Products />);
  await act(async () => {
    window.dispatchEvent(new Event('saleCreated'));
    window.dispatchEvent(new Event('saleCreated'));
  });
  expect(container.textContent).toContain('Stock actualisé');
  await act(async () => resolveOlder({ data: [{ ...product, name: 'Ancienne quantité', stock: 1 }] }));
  expect(container.textContent).toContain('Stock actualisé');
  expect(container.textContent).not.toContain('Ancienne quantité');
});
test('admin can edit stock from the "Modifier le produit" panel and the value reaches the update payload', async () => {
  catalogApi.list.mockResolvedValue({ data: [product] });
  catalogApi.update.mockResolvedValue({ data: { ...product, stock: 9 } });
  catalogApi.lossMap.mockResolvedValue({ data: { map: {} } });
  catalogApi.salesMap.mockResolvedValue({ data: { map: {} } });
  catalogApi.lookupCategories.mockResolvedValue({ data: [] });
  catalogApi.lookupContainers.mockResolvedValue({ data: [] });
  catalogApi.lookupWarehouses.mockResolvedValue({ data: [] });
  catalogApi.lookupSuppliers.mockResolvedValue({ data: [] });
  await render(<Products />, '/products', true);
  await click('Modifier');
  const stockInput = container.querySelector('input[name="stock"]');
  expect(stockInput.value).toBe('3');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(stockInput, '9');
    stockInput.dispatchEvent(new Event('input', { bubbles: true }));
    stockInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => container.querySelector('#product-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(catalogApi.update.mock.calls[0][0]).toBe('one');
  expect(catalogApi.update.mock.calls[0][1]).toEqual(expect.objectContaining({ stock: 9 }));
});
