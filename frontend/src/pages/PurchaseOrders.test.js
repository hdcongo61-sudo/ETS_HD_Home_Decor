import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PurchaseOrders from './PurchaseOrders';
import AuthContext from '../context/AuthContext';
import { purchasingApi } from '../features/purchasing/api';
import { catalogApi } from '../features/catalog/api';
import { platformApi } from '../features/platform/api';

jest.mock('../features/purchasing/api', () => ({
  purchasingApi: {
    suppliers: jest.fn(),
    orders: jest.fn(),
    shipments: jest.fn(),
    invoices: jest.fn(),
    payables: jest.fn(),
    recordReceivedPurchase: jest.fn(),
    createSupplier: jest.fn(),
  },
}));
jest.mock('../features/catalog/api', () => ({ catalogApi: { list: jest.fn() } }));
jest.mock('../features/platform/api', () => ({ platformApi: { locations: jest.fn() } }));
jest.mock('../components/ConfirmProvider', () => ({ confirmDialog: jest.fn().mockResolvedValue(true) }));
jest.mock('../components/business', () => {
  const React = require('react');
  const Wrapper = ({ children }) => <div>{children}</div>;
  return {
    Workspace: Wrapper,
    Surface: Wrapper,
    DataTable: Wrapper,
    PageHeader: ({ title, actions }) => <header><h1>{title}</h1>{actions}</header>,
    KPICard: ({ title, value }) => <div>{title}: {value}</div>,
    StatusBadge: Wrapper,
    EmptyState: ({ title, description }) => <div>{title} {description}</div>,
    LoadingSkeleton: () => <div>Chargement</div>,
  };
});

let root;
let container;

const renderPage = async () => act(async () => root.render(
  <AuthContext.Provider value={{ auth: { user: { isAdmin: true } } }}>
    <PurchaseOrders />
  </AuthContext.Provider>
));

const setValue = async (element, value) => act(async () => {
  const prototype = element.tagName === 'SELECT'
    ? HTMLSelectElement.prototype
    : element.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});

const inputForLabel = (labelText) => [...container.querySelectorAll('label')]
  .find((label) => label.textContent.includes(labelText))
  .querySelector('input');

const fillSharedPurchaseFields = async () => {
  const selects = container.querySelectorAll('select');
  await setValue(selects[0], 'supplier-1');
  await setValue(container.querySelector('input[type="number"]'), '2');
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  purchasingApi.suppliers.mockResolvedValue({ data: [{ _id: 'supplier-1', name: 'Fournisseur A' }] });
  purchasingApi.orders.mockResolvedValue({ data: [] });
  purchasingApi.shipments.mockResolvedValue({ data: [] });
  purchasingApi.invoices.mockResolvedValue({ data: [] });
  purchasingApi.payables.mockResolvedValue({ data: { bySupplier: [], totalOutstanding: 0 } });
  purchasingApi.recordReceivedPurchase.mockResolvedValue({ data: { order: { code: 'PO-2026-0001' } } });
  catalogApi.list.mockResolvedValue({ data: [{ _id: 'product-1', name: 'Chaise', sku: 'CH-1' }] });
  platformApi.locations.mockResolvedValue({ data: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('registers a received purchase for existing products and records full payment', async () => {
  await renderPage();
  expect(container.textContent).toContain('Enregistrer un achat reçu');
  expect(container.textContent).toContain('Options avancées');
  expect(container.textContent).not.toContain('Nouvelle expédition');

  const selects = container.querySelectorAll('select');
  await setValue(selects[0], 'supplier-1');
  await setValue(selects[2], 'product-1');
  const numberInputs = container.querySelectorAll('input[type="number"]');
  await setValue(numberInputs[0], '2');
  await setValue(numberInputs[1], '1250');

  await act(async () => container.querySelector('form').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true })
  ));

  expect(purchasingApi.recordReceivedPurchase).toHaveBeenCalledWith(expect.objectContaining({
    supplierId: 'supplier-1',
    paymentMethod: 'cash',
    lines: [{ productId: 'product-1', newProduct: undefined, quantity: 2, unitCost: 1250 }],
  }));
});

test('includes new product details in the received purchase', async () => {
  await renderPage();
  await fillSharedPurchaseFields();
  await act(async () => {
    [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Créer un nouveau produit'))
      .click();
  });
  await setValue(inputForLabel('Nom du produit'), 'Table basse');
  await setValue(inputForLabel('Catégorie'), 'Salon');
  const numberInputs = container.querySelectorAll('input[type="number"]');
  await setValue(numberInputs[0], '5000');
  await setValue(numberInputs[1], '1');
  await setValue(numberInputs[2], '2500');

  await act(async () => container.querySelector('form').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true })
  ));

  expect(purchasingApi.recordReceivedPurchase).toHaveBeenCalledWith(expect.objectContaining({
    lines: [{
      productId: undefined,
      newProduct: { name: 'Table basse', category: 'Salon', price: '5000', description: '' },
      quantity: 1,
      unitCost: 2500,
    }],
  }));
});
