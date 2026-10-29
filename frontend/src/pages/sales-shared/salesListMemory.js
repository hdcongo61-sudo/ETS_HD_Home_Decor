import { buildSalesReturnSearch, readSalesSearch } from './salesSearch';
const PREFIX = 'sales-list-return:v1:';
const MAX_AGE = 30 * 60 * 1000;
const idOf = value => typeof value === 'object' ? value?._id || value?.id : value;
export const salesMemoryScope = auth => {
  const tenant = idOf(auth?.tenantId || auth?.tenant || auth?.user?.tenantId);
  const user = idOf(auth?.user);
  return tenant && user ? encodeURIComponent(tenant) + ':' + encodeURIComponent(user) : null;
};
const keyFor = (scope, entry) => scope && entry ? PREFIX + scope + ':' + encodeURIComponent(entry) : null;
export const saveSalesList = (scope, entry, snapshot) => {
  const key = keyFor(scope, entry);
  if (!key) return;
  try { sessionStorage.setItem(key, JSON.stringify({ ...snapshot, at: Date.now() })); }
  catch { /* Storage failure must not block navigation. */ }
};
export const readSalesList = (scope, entry) => {
  const key = keyFor(scope, entry);
  if (!key) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(key));
    if (!value || !Number.isFinite(value.at) || Date.now() - value.at > MAX_AGE || value.at > Date.now() ||
      typeof value.search !== 'string' || !Number.isFinite(value.scrollY) || value.scrollY < 0) return null;
    return value;
  } catch { return null; }
};
export const getSalesListReturn = (scope, location, navigationType) => {
  if (location.hash) return null;
  const resume = new URLSearchParams(location.search).get('resume');
  const saved = readSalesList(scope, resume || (navigationType === 'POP' ? location.key : null));
  if (!saved) return null;
  if (resume && buildSalesReturnSearch(readSalesSearch(saved.search)) !== buildSalesReturnSearch(readSalesSearch(location.search))) return null;
  if (!resume && saved.path !== location.pathname + location.search) return null;
  return saved;
};
