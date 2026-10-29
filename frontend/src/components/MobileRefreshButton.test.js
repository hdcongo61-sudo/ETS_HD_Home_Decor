import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MobileRefreshButton from './MobileRefreshButton';
import { confirmDialog } from './ConfirmProvider';
import { startRequest, finishRequest } from '../utils/requestActivity';
jest.mock('./ConfirmProvider', () => ({ confirmDialog: jest.fn() }));
let container, root;
const online = value => Object.defineProperty(navigator, 'onLine', { configurable: true, value });
const render = callback => act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MobileRefreshButton onRefresh={callback} /><form><input aria-label="Note" /></form></MemoryRouter>));
const click = () => container.querySelector('button').click();
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; online(true); jest.clearAllMocks(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); online(true); });
test('one tap refreshes and simultaneous taps are blocked', async () => {
  let finish;
  const callback = jest.fn(() => new Promise(resolve => { finish = resolve; })); await render(callback);
  act(() => { click(); click(); });
  expect(callback).toHaveBeenCalledTimes(1); expect(container.querySelector('button').disabled).toBe(true);
  await act(async () => finish());
});
test('offline tap retains the page and explains how to recover', async () => {
  online(false); const callback = jest.fn(); await render(callback); await act(async () => click());
  expect(callback).not.toHaveBeenCalled(); expect(container.textContent).toContain('Reconnectez-vous');
});
test('edited form requires confirmation and cancellation preserves the page', async () => {
  const callback = jest.fn(); await render(callback);
  act(() => container.querySelector('input').dispatchEvent(new Event('input', { bubbles: true })));
  confirmDialog.mockResolvedValueOnce(false); await act(async () => click()); expect(callback).not.toHaveBeenCalled();
  confirmDialog.mockResolvedValueOnce(true); await act(async () => click()); expect(callback).toHaveBeenCalledTimes(1);
});
test('refresh stays disabled for the duration of a write', async () => {
  const callback = jest.fn(); const config = { method: 'post' }; await render(callback);
  act(() => startRequest(config)); expect(container.querySelector('button').disabled).toBe(true);
  await act(async () => click()); expect(callback).not.toHaveBeenCalled();
  act(() => finishRequest({ ...config })); expect(container.querySelector('button').disabled).toBe(false);
});
test('a write started during confirmation prevents refresh', async () => {
  const callback = jest.fn(); let confirm;
  confirmDialog.mockImplementation(() => new Promise(resolve => { confirm = resolve; }));
  await render(callback); act(() => container.querySelector('input').dispatchEvent(new Event('change', { bubbles: true })));
  act(() => click()); const config = { method: 'put' }; act(() => startRequest(config));
  await act(async () => confirm(true)); expect(callback).not.toHaveBeenCalled(); act(() => finishRequest(config));
});
test('failed refresh exposes a retryable message and releases the button', async () => {
  const callback = jest.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(); await render(callback);
  await act(async () => click()); expect(container.textContent).toContain('Réessayez');
  await act(async () => click()); expect(callback).toHaveBeenCalledTimes(2);
});
