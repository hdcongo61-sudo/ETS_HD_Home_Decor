import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import GlobalSaleModal from './GlobalSaleModal';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { SALE_STAGE_CONTINUE_LABELS } from './SaleForm';

jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../utils/proformaPdf', () => ({ generateProformaPdf: jest.fn() }));
jest.mock('./ExportSalesPdf', () => () => null);
jest.mock('./ConfirmProvider', () => ({ confirmDialog: jest.fn().mockResolvedValue(true) }));
jest.mock('./Modal', () => ({ isOpen, children, footer }) => (isOpen ? <div>{children}{footer}</div> : null));
jest.mock('../context/ModalContext', () => ({ useModal: () => ({ activeModal: 'sale', closeModal: jest.fn() }) }));

let root, container;
const clients = [{ _id: 'c1', name: 'Alice' }];
const products = [{ _id: 'p1', name: 'Chaise', price: 500, costPrice: 100, stock: 8 }];

const render = () => act(async () => root.render(
  <MemoryRouter>
    <AuthContext.Provider value={{ auth: { tenantId: 'shop1', user: { _id: 'u1' } }, hasFeature: () => true }}>
      <GlobalSaleModal />
    </AuthContext.Provider>
  </MemoryRouter>
));
const click = (text) => act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent.includes(text)).click());
const footerButton = () => container.querySelector('button[form="global-sale-form"]');

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  jest.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/clients') return Promise.resolve({ data: clients });
    return Promise.resolve({ data: products });
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('the footer continue button tracks SaleForm stage labels from a single shared source', async () => {
  await render();
  expect(footerButton().textContent).toBe(SALE_STAGE_CONTINUE_LABELS[0]);

  const clientSelect = container.querySelector('select[aria-label="Sélectionner un client"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(clientSelect, 'c1');
    clientSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await click(SALE_STAGE_CONTINUE_LABELS[0]);
  expect(footerButton().textContent).toBe(SALE_STAGE_CONTINUE_LABELS[1]);
});
