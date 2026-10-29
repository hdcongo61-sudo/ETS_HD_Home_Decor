import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useInventorySection from './useInventorySection';
let root, container, section;
function Probe({ fetchValue }) { section = useInventorySection(fetchValue, []); return null; }
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); root = createRoot(container); });
afterEach(() => act(() => root.unmount()));
test('late success cannot overwrite a newer request', async () => {
  let finishOld;
  const fetchValue = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce(['new']);
  await act(async () => root.render(<Probe fetchValue={fetchValue} />));
  let old;
  act(() => { old = section.reload(); });
  await act(async () => section.reload());
  await act(async () => { finishOld(['old']); await old; });
  expect(section.data).toEqual(['new']);
  expect(section.error).toBeNull();
});
test('late failure cannot erase a newer successful result', async () => {
  let failOld;
  const fetchValue = jest.fn().mockImplementationOnce(() => new Promise((_, reject) => { failOld = reject; })).mockResolvedValueOnce(['new']);
  await act(async () => root.render(<Probe fetchValue={fetchValue} />));
  let old;
  act(() => { old = section.reload(); });
  await act(async () => section.reload());
  await act(async () => { failOld(new Error('old')); await old; });
  expect(section.data).toEqual(['new']); expect(section.error).toBeNull();
});
