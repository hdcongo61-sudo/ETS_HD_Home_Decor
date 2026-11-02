const getEffectiveMonthlyPrice = (tenant) => {
  const monthlyPrice = Math.max(0, Number(tenant?.monthlyPrice) || 0);
  const discount = tenant?.billingDiscount;
  const value = Number(discount?.value);

  if (!discount || !Number.isFinite(value) || value <= 0) {
    return Math.round(monthlyPrice);
  }

  const discountAmount = discount.type === 'percent'
    ? monthlyPrice * Math.min(value, 100) / 100
    : discount.type === 'amount'
      ? value
      : 0;

  return Math.max(0, Math.round(monthlyPrice - discountAmount));
};

module.exports = { getEffectiveMonthlyPrice };
