import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import UserProfile from './UserProfile';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
  api.get.mockResolvedValue({
    data: {
      _id: 'operator-1',
      name: 'Amina Admin',
      email: 'amina@example.com',
      phone: '+243900000000',
      isAdmin: true,
      isSuperAdmin: true,
      isActive: true,
      mfaEnabled: true,
      createdAt: '2025-01-15T12:00:00.000Z',
      lastLogin: '2026-10-31T12:00:00.000Z',
    },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.removeItem('token');
});

test('shows a dedicated platform operator profile and avoids shop admin statistics', async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AuthContext.Provider value={{ auth: { isSuperAdmin: true }, setAuth: jest.fn() }}>
          <UserProfile />
        </AuthContext.Provider>
      </MemoryRouter>
    );
  });

  expect(container.textContent).toContain('Compte plateforme');
  expect(container.textContent).toContain('Super Admin');
  expect(container.textContent).toContain('Amina Admin');
  expect(container.textContent).toContain('Informations du compte');
  expect(container.textContent).toContain('Double authentification');
  expect(container.textContent).toContain('Activée');
  expect(container.textContent).toContain('Changer le mot de passe');
  expect(container.querySelector('#operator-current-password')).not.toBeNull();
  expect(container.querySelector('#operator-new-password')).not.toBeNull();
  expect(container.querySelector('#operator-confirm-password')).not.toBeNull();
  expect(container.querySelector('#operator-mfa-code')).not.toBeNull();
  expect(container.textContent).toContain('Paramètres plateforme');
  expect(container.textContent).not.toContain('Statistiques administrateur');
  expect(container.textContent).not.toContain('Statistiques de ventes');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/users/profile');
});

test('rejects a weak Super Admin password before sending a change request', async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AuthContext.Provider value={{ auth: { isSuperAdmin: true }, setAuth: jest.fn() }}>
          <UserProfile />
        </AuthContext.Provider>
      </MemoryRouter>
    );
  });

  const fill = async (id, value) => {
    const input = container.querySelector(id);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    await act(async () => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  await fill('#operator-current-password', 'CurrentPassword123');
  await fill('#operator-new-password', 'weak');
  await fill('#operator-confirm-password', 'weak');

  const form = container.querySelector('#operator-current-password').closest('form');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(api.put).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('10 caractères'));
});
