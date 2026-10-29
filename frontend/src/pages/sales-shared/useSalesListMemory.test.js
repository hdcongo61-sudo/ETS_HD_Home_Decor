import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import ScrollToTop from '../../components/ScrollToTop';
import useSalesListMemory from './useSalesListMemory';
import { saveSalesList, salesMemoryScope } from './salesListMemory';
const auth = { tenantId: 'shop-1', user: { _id: 'user-1' } };
let root, container, frames;
function List({ ready = true }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [search, setSearch] = useState('?workspace=history');
  const { restored, remember } = useSalesListMemory({ auth, location, navigationType, search, ready });
  useEffect(() => { if (restored) setSearch(restored.search); }, [restored]);
  return <><output>{search}</output><button onClick={() => setSearch('?workspace=history&q=Elodie')}>Filter</button><div data-sale-id="sale-1"><Link to={'/sales/sale-1?returnToSales=' + encodeURIComponent('/sales' + search + '&resume=' + location.key)} onClick={() => remember('sale-1')}>Open</Link></div></>;
}
function Detail() {
  const navigate = useNavigate();
  const location = useLocation();
  return <><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(new URLSearchParams(location.search).get('returnToSales'))}>Return</button></>;
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; sessionStorage.clear(); frames = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Element.prototype.scrollIntoView = jest.fn();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });
const click = label => act(() => [...container.querySelectorAll('button,a')].find(node => node.textContent === label).click());
const render = ready => act(() => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ScrollToTop /><Routes><Route path="/" element={<List ready={ready} />} /><Route path="/sales" element={<List ready={ready} />} /><Route path="/sales/:id" element={<Detail />} /></Routes></MemoryRouter>));
const flushFrames = () => act(() => { const queued = frames; frames = []; queued.forEach(callback => callback()); });
test.each(['Back', 'Return'])('%s restores filters and focus after route scrolling resets', label => {
  render(true); click('Filter'); click('Open'); click(label); flushFrames();
  expect(container.querySelector('output').textContent).toContain('q=Elodie');
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  expect(document.activeElement.textContent).toBe('Open');
});
test('waits for data and restores scroll offset when the record is unavailable', () => {
  saveSalesList(salesMemoryScope(auth), 'default', { path: '/', search: '?workspace=history&q=Missing', scrollY: 920, saleId: 'missing' });
  render(false); flushFrames();
  expect(window.scrollTo).not.toHaveBeenCalledWith({ top: 920, behavior: 'instant' });
  render(true); flushFrames();
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 920, behavior: 'instant' });
});
