import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import api from '../services/api';
import { ModalProvider, useModal } from '../context/ModalContext';
import GlobalPaymentModal from './GlobalPaymentModal';
import { confirmDialog } from './ConfirmProvider';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('./Modal', () => {
  const React = require('react');
  return ({ children, footer, title, subtitle }) => (
    <section>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
      <footer>{footer}</footer>
    </section>
  );
});
jest.mock('./PaymentModal', () => {
  const React = require('react');
  return {
    PaymentForm: ({ onDirtyChange, formId }) => (
      <form id={formId}>
        <button type="button" onClick={() => onDirtyChange(true)}>Modifier le paiement</button>
      </form>
    ),
  };
});
jest.mock('./business', () => ({
  StatusBadge: ({ children }) => <span>{children}</span>,
}));
jest.mock('react-hot-toast', () => ({ success: jest.fn() }));
jest.mock('./ConfirmProvider', () => ({ confirmDialog: jest.fn() }));

const sales = [
  {
    _id: 'sale-1',
    reference: 'REF-42',
    status: 'partially_paid',
    totalAmount: 1000,
    payments: [{ amount: 200 }],
    client: { name: 'Aminata', phone: '5550100' },
    user: { name: 'Agent A' },
    products: [],
  },
  {
    _id: 'sale-cancelled',
    status: 'cancelled',
    totalAmount: 900,
    payments: [],
    client: { name: 'Annulée' },
  },
];

const OpenPaymentModal = () => {
  const { openModal } = useModal();
  return (
    <>
      <button type="button" onClick={() => openModal('payment')}>Ouvrir les encaissements</button>
      <GlobalPaymentModal />
    </>
  );
};

let container;
let root;

const renderModal = async () => {
  await act(async () => {
    root.render(<ModalProvider><OpenPaymentModal /></ModalProvider>);
  });
  act(() => container.querySelector('button').click());
  await act(async () => { await Promise.resolve(); });
};

const clickButton = (label) => {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent.includes(label)
  );
  expect(button).toBeTruthy();
  act(() => button.click());
};

const clickButtonAndWait = async (label) => {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent.includes(label)
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  api.get.mockResolvedValue({ data: sales });
  api.get.mockClear();
  confirmDialog.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('lists only collectible sales and searches by client phone', async () => {
  await renderModal();

  expect(api.get).toHaveBeenCalledWith('/sales', { params: { summary: 'list' } });
  expect(container.textContent).toContain('Aminata');
  expect(container.textContent).not.toContain('Annulée');

  const search = container.querySelector('input[type="search"]');
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(search, '5550100');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(container.textContent).toContain('REF-42');

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(search, 'no-match');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(container.textContent).toContain('Aucun résultat');
});

test('guides the operator to payment and guards returning with an edited draft', async () => {
  await renderModal();
  clickButton('Aminata');
  clickButton('Continuer vers le paiement');
  expect(container.querySelector('h1').textContent).toBe('Saisir le paiement');

  clickButton('Modifier le paiement');
  confirmDialog.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await clickButtonAndWait('Choisir une autre vente');
  expect(container.querySelector('h1').textContent).toBe('Saisir le paiement');
  expect(confirmDialog).toHaveBeenCalledTimes(1);

  await clickButtonAndWait('Choisir une autre vente');
  expect(container.querySelector('h1').textContent).toBe('Choisir une vente à encaisser');
  expect(confirmDialog).toHaveBeenCalledTimes(2);
});
