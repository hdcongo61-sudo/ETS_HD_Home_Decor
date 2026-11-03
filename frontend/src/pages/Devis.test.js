import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Devis from './Devis';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

let root;
let container;
const client = { _id: 'client-1', name: 'Amina Diallo', phone: '0612345678' };
const product = { _id: 'product-1', name: 'Fauteuil', price: 25000, stock: 4, image: '/fauteuil.png' };

const renderPage = () => act(async () => root.render(<Devis />));
const clickButton = (text) => act(async () => {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent.includes(text));
  button.click();
});
const setValue = (element, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
});

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  api.get.mockImplementation((path) => Promise.resolve({
    data: path === '/clients' ? [client] : path === '/products' ? [product] : [],
  }));
  api.post.mockResolvedValue({ data: {} });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('creates a quote through the guided client, products, validity and review steps', async () => {
  await renderPage();
  await clickButton('Nouveau devis');

  expect(container.textContent).toContain('Choisir le client');
  await clickButton('Amina Diallo');
  await clickButton('Continuer vers les produits');
  expect(container.textContent).toContain('Ajouter les produits');

  const productSearch = container.querySelector('[aria-label="Rechercher un produit pour l’article 1"]');
  await setValue(productSearch, 'Fau');
  await clickButton('Fauteuil');
  expect(container.textContent).toContain('Prix catalogue :');
  await clickButton('Continuer vers la validité');
  expect(container.textContent).toContain('Validité et note');

  const note = container.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(note, 'Livraison incluse');
    note.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickButton('Vérifier le devis');
  expect(container.textContent).toContain('Vérification finale');
  expect(container.textContent).toMatch(/25.{0,2}000/);
  expect(container.textContent).toContain('Livraison incluse');

  await clickButton('Créer le devis');
  expect(api.post).toHaveBeenCalledWith('/devis', expect.objectContaining({
    client: 'client-1',
    note: 'Livraison incluse',
    products: [{ product: 'product-1', quantity: 1, price: 25000 }],
  }));
});
