import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AuthContext from '../context/AuthContext';
import { PaymentForm } from './PaymentModal';

jest.mock('./Modal', () => () => null);
const sale = { _id: 'sale-1', totalAmount: 1000, client: { name: 'Client' }, payments: [{ amount: 200 }] };
let container;
let root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const renderForm = (props = {}) => act(() => root.render(<AuthContext.Provider value={{ auth: { user: {} } }}><PaymentForm sale={sale} {...props} /></AuthContext.Provider>));
const fillAmount = (value) => act(() => {
  const input = container.querySelector('input[type=number]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
const submit = () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

test('preserves entered amount through rerenders and previews remaining balance', () => {
  renderForm({ onAddPayment: jest.fn() });
  fillAmount('300');
  renderForm({ onAddPayment: jest.fn() });
  expect(container.querySelector('input[type=number]').value).toBe('300');
  expect(container.textContent).toContain('500 CFA restant');
});

test('blocks simultaneous submits and reports success once', async () => {
  let finish;
  const onAddPayment = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const onSuccess = jest.fn();
  renderForm({ onAddPayment, onSuccess }); fillAmount('300');
  act(() => { submit(); submit(); });
  expect(onAddPayment).toHaveBeenCalledTimes(1);
  expect(container.querySelector('fieldset').disabled).toBe(true);
  await act(async () => { finish(); });
  expect(onSuccess).toHaveBeenCalledWith({ amount: 300, balance: 500 });
  act(() => submit());
  expect(onAddPayment).toHaveBeenCalledTimes(1);
});

test('retains failed payment input and allows retry', async () => {
  const onAddPayment = jest.fn().mockRejectedValueOnce({ response: { data: { message: 'Service indisponible' } } }).mockResolvedValueOnce({});
  const onSuccess = jest.fn();
  renderForm({ onAddPayment, onSuccess }); fillAmount('300');
  await act(async () => { submit(); });
  expect(container.querySelector('[role=alert]').textContent).toContain('Service indisponible');
  expect(container.querySelector('input[type=number]').value).toBe('300');
  expect(onSuccess).not.toHaveBeenCalled();
  await act(async () => { submit(); });
  expect(onAddPayment).toHaveBeenCalledTimes(2);
});

test('rejects overpayment without sending a request', async () => {
  const onAddPayment = jest.fn();
  renderForm({ onAddPayment }); fillAmount('900');
  await act(async () => { submit(); });
  expect(onAddPayment).not.toHaveBeenCalled();
  expect(container.querySelector('[role=alert]').textContent).toContain('solde restant');
});
