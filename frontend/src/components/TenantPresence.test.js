import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TenantPresence from './TenantPresence';
import { platformApi } from '../features/platform/api';

jest.mock('../features/platform/api', () => ({
  platformApi: { recordTenantPresence: jest.fn() },
}));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  jest.useFakeTimers();
  platformApi.recordTenantPresence.mockResolvedValue({});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  jest.useRealTimers();
  container.remove();
});

test('records presence immediately and on its heartbeat interval for a tenant', async () => {
  await act(async () => {
    root.render(<TenantPresence tenantId="tenant-1" />);
  });

  expect(platformApi.recordTenantPresence).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(30000);
  });

  expect(platformApi.recordTenantPresence).toHaveBeenCalledTimes(2);
});

test('does not send heartbeats without an active tenant', async () => {
  await act(async () => {
    root.render(<TenantPresence tenantId={null} />);
  });

  expect(platformApi.recordTenantPresence).not.toHaveBeenCalled();
});
