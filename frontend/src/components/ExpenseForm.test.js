import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import ExpenseForm from './ExpenseForm';

jest.mock('../services/api', () => ({ get: jest.fn() }));

let root;
let container;

const renderForm = (onSubmit) => act(async () => root.render(
  <MemoryRouter>
    <AuthContext.Provider value={{ auth: { user: {} } }}>
      <ExpenseForm onSubmit={onSubmit} />
    </AuthContext.Provider>
  </MemoryRouter>
));

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: [{ name: 'Fournitures' }] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('keeps the common payment method in collapsed complementary options', async () => {
  await renderForm(jest.fn());

  expect(container.textContent).toContain('Montant (CFA)');
  expect(container.textContent).toContain('Catégorie');
  expect(container.textContent).toContain('À quoi correspond cette dépense ?');
  expect(container.textContent).not.toContain('Mode de paiement');

  await act(async () => {
    [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Options complémentaires'))
      .click();
  });
  expect(container.textContent).toContain('Mode de paiement');
});

test('preserves entered values when the save is not successful', async () => {
  const onSubmit = jest.fn().mockResolvedValue(false);
  await renderForm(onSubmit);

  const amount = container.querySelector('[name="amount"]');
  const description = container.querySelector('[name="description"]');
  const category = container.querySelector('[name="category"]');

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(amount, '12500');
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(description, 'Achat de fournitures');
    description.dispatchEvent(new Event('input', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(category, 'Fournitures');
    category.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    amount: 12500,
    category: 'Fournitures',
    description: 'Achat de fournitures',
  }));
  expect(amount.value).toBe('12500');
  expect(description.value).toBe('Achat de fournitures');
  expect(category.value).toBe('Fournitures');
});
