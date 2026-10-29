const FILTER_PARAMS = {
  statusFilter: 'status', clientFilter: 'client', sellerFilter: 'seller',
  saleTypeFilter: 'saleType', paymentStructureFilter: 'paymentStructure',
  dateFilter: 'date', deliveryFilter: 'delivery', containerFilter: 'container', searchTerm: 'q',
};
export const EMPTY_QUICK_FILTERS = { highValue: false, latePayments: false, recurring: false, highProfit: false };
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
export const matchesSaleSearch = (sale, query) => {
  const term = normalize(query);
  if (!term) return true;
  const client = sale.client || {};
  const text = [sale.reference, sale._id, client.name, client.phone, client.phoneNumber].map(normalize).join(' ');
  if (text.includes(term)) return true;
  const digits = term.replace(/\D/g, '');
  return digits.length >= 3 && /^[+\d\s().-]+$/.test(term) &&
    [client.phone, client.phoneNumber].some(phone => String(phone || '').replace(/\D/g, '').includes(digits));
};
export const readSalesSearch = search => {
  const params = new URLSearchParams(search);
  const filters = Object.fromEntries(Object.entries(FILTER_PARAMS).map(([key, param]) => [key, params.get(param) || '']));
  const enabled = new Set((params.get('quick') || '').split(','));
  filters.quickFilters = Object.fromEntries(Object.keys(EMPTY_QUICK_FILTERS).map(key => [key, enabled.has(key)]));
  return filters;
};
export const buildSalesReturnSearch = filters => {
  const params = new URLSearchParams({ workspace: 'history' });
  Object.entries(FILTER_PARAMS).forEach(([key, param]) => { if (filters[key]) params.set(param, filters[key]); });
  const quick = Object.keys(EMPTY_QUICK_FILTERS).filter(key => filters.quickFilters?.[key]);
  if (quick.length) params.set('quick', quick.join(','));
  return '?' + params.toString();
};
