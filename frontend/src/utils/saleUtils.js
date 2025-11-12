export const parseDateSafely = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (dateString) => {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  const parsedDate = parseDateSafely(dateString);
  return parsedDate
    ? parsedDate.toLocaleDateString("fr-FR", options)
    : "Date indisponible";
};

export const calculateSaleTotals = (sale) => {
  const totalPaid =
    sale?.payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) ||
    0;
  const balance = (sale.totalAmount || 0) - totalPaid;
  return { totalPaid, balance };
};

export const getStatusClass = (status) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "partially_paid":
      return "bg-yellow-100 text-yellow-800";
    case "pending":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const getStatusText = (status) => {
  switch (status) {
    case "completed":
      return "Payée";
    case "partially_paid":
      return "Partiellement payée";
    case "pending":
      return "En attente";
    case "cancelled":
      return "Annulée";
    default:
      return status;
  }
};

export const getProfitCategoryClass = (category) => {
  switch (category) {
    case "excellent":
      return "bg-purple-100 text-purple-800";
    case "élevé":
      return "bg-green-100 text-green-800";
    case "moyen":
      return "bg-blue-100 text-blue-800";
    case "faible":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const getProfitCategoryText = (category) => {
  switch (category) {
    case "excellent":
      return "Excellent";
    case "élevé":
      return "Élevé";
    case "moyen":
      return "Moyen";
    case "faible":
      return "Faible";
    default:
      return category;
  }
};

export const calculateSaleProfit = (sale) => {
  if (!sale?.products?.length) return 0;
  return sale.products.reduce((total, item) => {
    const costPrice = item.product?.costPrice || 0;
    const sellingPrice = item.priceAtSale || 0;
    const quantity = Number(item.quantity) || 0;
    return total + (sellingPrice - costPrice) * quantity;
  }, 0);
};

export const calculateSaleMargin = (sale) => {
  const totalAmount = Number(sale?.totalAmount) || 0;
  if (totalAmount === 0) return 0;
  const totalProfit = calculateSaleProfit(sale);
  return (totalProfit / totalAmount) * 100;
};

export const deriveProfitCategoryFromMargin = (margin) => {
  if (margin >= 50) return "excellent";
  if (margin >= 30) return "élevé";
  if (margin >= 15) return "moyen";
  return "faible";
};
