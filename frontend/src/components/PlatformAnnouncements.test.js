import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PlatformAnnouncements from './PlatformAnnouncements';
import { platformApi } from '../features/platform/api';

jest.mock('../features/platform/api', () => ({
  platformApi: {
    tenantAnnouncements: jest.fn(),
    markAnnouncementRead: jest.fn(),
  },
}));
jest.mock('react-hot-toast', () => ({ error: jest.fn() }));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('shows unread platform announcements and removes them after marking read', async () => {
  platformApi.tenantAnnouncements.mockResolvedValue({
    data: [{
      _id: 'announcement-1',
      title: 'Nouvelle fonctionnalité',
      message: 'Une note de version est disponible.',
      type: 'release',
      publishedAt: '2026-10-31T10:00:00.000Z',
      read: false,
    }],
  });
  platformApi.markAnnouncementRead.mockResolvedValue({});

  await act(async () => {
    root.render(<PlatformAnnouncements />);
  });

  expect(container.textContent).toContain('Nouvelle fonctionnalité');

  await act(async () => {
    container.querySelector('button').click();
  });

  expect(platformApi.markAnnouncementRead).toHaveBeenCalledWith('announcement-1');
  expect(container.textContent).not.toContain('Nouvelle fonctionnalité');
});
