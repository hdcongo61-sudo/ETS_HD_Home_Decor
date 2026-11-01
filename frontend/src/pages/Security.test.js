import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Security from './Security';
import { useSessions, useMfa } from '../features/auth/hooks';

jest.mock('../features/auth/hooks', () => ({
  useSessions: jest.fn(),
  useMfa: jest.fn(),
}));
jest.mock('../components/ConfirmProvider', () => ({ confirmDialog: jest.fn() }));
jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  useSessions.mockReturnValue({
    sessions: [{
      _id: 'session-1',
      deviceType: 'Mobile',
      operatingSystem: 'Android',
      browser: 'Chrome',
      location: 'Brazzaville, CG',
      ip: '192.0.2.1',
      lastSeenAt: '2026-11-01T08:00:00.000Z',
    }],
    loading: false,
    revoking: null,
    revokingAll: false,
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  });
  useMfa.mockReturnValue({
    enabled: false,
    setupData: null,
    loading: false,
    setup: jest.fn(),
    verify: jest.fn(),
    disable: jest.fn(),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('shows device type, browser, and approximate session location', async () => {
  await act(async () => {
    root.render(<Security />);
  });

  expect(container.textContent).toContain('Mobile · Android');
  expect(container.textContent).toContain('Navigateur : Chrome');
  expect(container.textContent).toContain('Localisation : Brazzaville, CG');
  expect(container.textContent).toContain('192.0.2.1');
});
