import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import PlatformSettings from './PlatformSettings';
import { platformApi } from '../features/platform/api';

const mockSetPlatformBranding = jest.fn();
const mockPlatformBranding = { appName: 'ETS HD Gestion', logoUrl: '' };

jest.mock('../features/platform/api', () => ({
  platformApi: { tenantDataUsage: jest.fn(), updatePlatformBranding: jest.fn() },
}));
jest.mock('../context/AppSettingsContext', () => ({
  useAppSettings: () => ({
    platformBranding: mockPlatformBranding,
    setPlatformBranding: mockSetPlatformBranding,
  }),
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.URL.createObjectURL = jest.fn(() => 'blob:platform-logo-preview');
  global.URL.revokeObjectURL = jest.fn();
  jest.clearAllMocks();
  Object.assign(mockPlatformBranding, { appName: 'ETS HD Gestion', logoUrl: '' });
  platformApi.updatePlatformBranding.mockResolvedValue({
    data: { appName: 'ETS HD Gestion', logoUrl: 'https://cdn.example.com/platform-logo.webp', updatedAt: '2026-10-31T12:00:00.000Z' },
  });
  platformApi.tenantDataUsage.mockResolvedValue({
    data: {
      computedAt: '2026-10-31T12:00:00.000Z',
      totalEstimatedBytes: 1500,
      measuredCollections: 12,
      methodology: 'Taille BSON estimée.',
      shops: [{
        tenantId: 'tenant-1',
        name: 'Boutique A',
        code: 'B001',
        estimatedBytes: 750,
        documentCount: 12,
        sharePercentage: 50,
      }],
    },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('shows platform-wide controls instead of shop-specific settings', async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlatformSettings />
      </MemoryRouter>
    );
  });

  expect(container.textContent).toContain('Paramètres plateforme');
  expect(container.textContent).toContain('Logo de l’application');
  expect(container.textContent).toContain('Les noms et logos commerciaux des boutiques sur leurs factures et documents restent inchangés.');
  expect(container.querySelector('#platform-app-name').value).toBe('ETS HD Gestion');
  expect(container.textContent).toContain('Forfaits et limites');
  expect(container.textContent).toContain('Comptes des opérateurs');
  expect(container.textContent).toContain('État du système');
  expect(container.textContent).toContain('Réglages des boutiques');
  expect(container.textContent).not.toContain('Catégories produits');
  expect(container.querySelector('a[href="/super-admin?tab=plans"]')).not.toBeNull();
  expect(container.querySelector('a[href="/super-admin?tab=system"]')).not.toBeNull();
  expect(container.textContent).toContain('Boutique A');
  expect(container.textContent).toContain('50 %');
  expect(container.textContent).toContain('part du total des données mesurées');
  expect(container.querySelector('[aria-label="Part des données de Boutique A"]').getAttribute('aria-valuenow')).toBe('50');
});

test('uploads the platform logo and updates shared platform branding', async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlatformSettings />
      </MemoryRouter>
    );
  });

  const input = container.querySelector('#platform-app-logo');
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [new File(['logo'], 'platform-logo.png', { type: 'image/png' })],
  });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Enregistrer'));
  expect(saveButton).toBeDefined();
  await act(async () => {
    saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(platformApi.updatePlatformBranding).toHaveBeenCalledTimes(1);
  const [formData] = platformApi.updatePlatformBranding.mock.calls[0];
  expect(formData.get('logoFile')).toBeInstanceOf(File);
  expect(mockSetPlatformBranding).toHaveBeenCalledWith({
    appName: 'ETS HD Gestion',
    logoUrl: 'https://cdn.example.com/platform-logo.webp',
    updatedAt: '2026-10-31T12:00:00.000Z',
  });
});

test('updates the global app name without changing the shop name', async () => {
  platformApi.updatePlatformBranding.mockResolvedValue({
    data: { appName: 'HD Gestion Global', logoUrl: '', updatedAt: '2026-10-31T12:00:00.000Z' },
  });

  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlatformSettings />
      </MemoryRouter>
    );
  });

  const appNameInput = container.querySelector('#platform-app-name');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(appNameInput, 'HD Gestion Global');
  await act(async () => {
    appNameInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Enregistrer'));
  expect(saveButton).toBeDefined();
  await act(async () => {
    saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const [formData] = platformApi.updatePlatformBranding.mock.calls[0];
  expect(formData.get('appName')).toBe('HD Gestion Global');
  expect(formData.has('logoFile')).toBe(false);
  expect(mockSetPlatformBranding).toHaveBeenCalledWith({
    appName: 'HD Gestion Global',
    logoUrl: '',
    updatedAt: '2026-10-31T12:00:00.000Z',
  });
});

test('saves platform support contact details, including the WhatsApp link', async () => {
  platformApi.updatePlatformBranding.mockResolvedValue({
    data: {
      appName: 'ETS HD Gestion',
      logoUrl: '',
      supportEmail: 'support@example.com',
      supportPhone: '+243 900 000 000',
      whatsappUrl: 'https://wa.me/243900000000',
      websiteUrl: 'https://example.com',
      address: 'Kinshasa, RDC',
      updatedAt: '2026-10-31T12:00:00.000Z',
    },
  });

  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlatformSettings />
      </MemoryRouter>
    );
  });

  const supportEmailInput = container.querySelector('#platform-supportEmail');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(supportEmailInput, 'support@example.com');
  await act(async () => {
    supportEmailInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const whatsappInput = container.querySelector('#platform-whatsappUrl');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(whatsappInput, 'https://wa.me/243900000000');
  await act(async () => {
    whatsappInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Enregistrer'));
  expect(saveButton).toBeDefined();
  await act(async () => {
    saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const [formData] = platformApi.updatePlatformBranding.mock.calls[0];
  expect(formData.get('supportEmail')).toBe('support@example.com');
  expect(formData.get('whatsappUrl')).toBe('https://wa.me/243900000000');
  expect(mockSetPlatformBranding).toHaveBeenCalledWith(expect.objectContaining({
    supportEmail: 'support@example.com',
    supportPhone: '+243 900 000 000',
    whatsappUrl: 'https://wa.me/243900000000',
    websiteUrl: 'https://example.com',
    address: 'Kinshasa, RDC',
  }));
});

test('resets the platform logo without changing shop branding', async () => {
  mockPlatformBranding.logoUrl = 'https://cdn.example.com/platform-logo.webp';
  platformApi.updatePlatformBranding.mockResolvedValue({
    data: { appName: 'ETS HD Gestion', logoUrl: '', updatedAt: '2026-10-31T12:00:00.000Z' },
  });

  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlatformSettings />
      </MemoryRouter>
    );
  });

  const resetButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Réinitialiser le logo'));
  expect(resetButton).toBeDefined();
  await act(async () => {
    resetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Enregistrer'));
  await act(async () => {
    saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const [formData] = platformApi.updatePlatformBranding.mock.calls[0];
  expect(formData.get('appName')).toBe('ETS HD Gestion');
  expect(formData.get('removeLogo')).toBe('true');
  expect(mockSetPlatformBranding).toHaveBeenCalledWith({
    appName: 'ETS HD Gestion',
    logoUrl: '',
    updatedAt: '2026-10-31T12:00:00.000Z',
  });
});
