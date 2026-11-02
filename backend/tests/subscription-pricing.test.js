const { getEffectiveMonthlyPrice } = require('../utils/subscriptionPricing');

describe('getEffectiveMonthlyPrice', () => {
  test('returns the monthly price when no discount is configured', () => {
    expect(getEffectiveMonthlyPrice({ monthlyPrice: 15000 })).toBe(15000);
  });

  test('applies a recurring percentage discount', () => {
    expect(getEffectiveMonthlyPrice({
      monthlyPrice: 15000,
      billingDiscount: { type: 'percent', value: 20 },
    })).toBe(12000);
  });

  test('applies a fixed discount and never charges below zero', () => {
    expect(getEffectiveMonthlyPrice({
      monthlyPrice: 5000,
      billingDiscount: { type: 'amount', value: 1200 },
    })).toBe(3800);
    expect(getEffectiveMonthlyPrice({
      monthlyPrice: 5000,
      billingDiscount: { type: 'amount', value: 6000 },
    })).toBe(0);
  });
});
