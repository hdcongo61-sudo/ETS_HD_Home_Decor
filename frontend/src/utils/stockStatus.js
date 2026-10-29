export const getStockStatus = (stock) => {
  const value = Number(stock) || 0;
  if (value <= 0) return { tone: 'danger', label: 'Rupture' };
  if (value <= 5) return { tone: 'warning', label: 'Stock bas' };
  return { tone: 'success', label: 'Disponible' };
};

export default getStockStatus;
