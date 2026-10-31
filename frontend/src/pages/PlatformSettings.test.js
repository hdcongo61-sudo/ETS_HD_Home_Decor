import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import PlatformSettings from './PlatformSettings';
import { platformApi } from '../features/platform/api';

jest.mock('../features/platform/api', () => ({
  platformApi: { tenantDataUsage: jest.fn() },
}));
jest.mock('react-hot-toast', () => ({ error: jest.fn() }));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
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
