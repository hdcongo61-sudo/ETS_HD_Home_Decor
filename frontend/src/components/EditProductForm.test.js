import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditProductForm from './EditProductForm';
import api from '../services/api';

jest.mock('../services/api', () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock('./VariantManager', () => () => null);
jest.mock('./Modal', () => ({ isOpen, children }) => (isOpen ? children : null));

let container, root;

const product = {
  _id: 'p1',
  name: 'Chaise',
  description: 'Une chaise',
  price: 1000,
  costPrice: 500,
  stock: 12,
  category: 'Mobilier',
  image: '',
  supplierName: 'Fournisseur A',
  supplierPhone: '600000000',
  container: '',
  warehouse: '',
};

const render = async () => {
  await act(async () => root.render(
    <MemoryRouter initialEntries={['/products/p1/edit']}>
      <Routes>
        <Route path="/products/:id/edit" element={<EditProductForm />} />
      </Routes>
    </MemoryRouter>
  ));
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/products/p1') return Promise.resolve({ data: product });
    return Promise.resolve({ data: [] });
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const stockInput = () => container.querySelector('input[name="stock"]');
const setStock = (value) => act(() => {
  const input = stockInput();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
const submit = () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

test('stock field is editable, pre-filled, and submitted with the rest of the form', async () => {
  await render();
  expect(stockInput().value).toBe('12');
  setStock('20');
  expect(stockInput().value).toBe('20');

  api.put.mockResolvedValue({ data: { ...product, stock: 20 } });
  await submit();
  expect(api.put).toHaveBeenCalledWith('/products/p1', expect.objectContaining({ stock: 20 }));
});

test('rejects a negative stock before submitting', async () => {
  await render();
  setStock('-5');
  await submit();
  expect(container.textContent).toContain('Le stock ne peut pas être négatif');
  expect(api.put).not.toHaveBeenCalled();
});

test('surfaces an insufficient-inventory rejection from the backend', async () => {
  await render();
  setStock('0');
  api.put.mockRejectedValue({ response: { status: 409, data: { message: 'Stock insuffisant dans l’inventaire pour cet ajustement.' } } });
  await submit();
  expect(container.textContent).toContain('Stock insuffisant dans l’inventaire pour cet ajustement.');
});
