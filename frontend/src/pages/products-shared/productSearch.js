const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
export const matchesProductSearch = (product, query) => {
  const term = normalize(query);
  return !term || [product.name, product.sku].some(value => normalize(value).includes(term));
};
