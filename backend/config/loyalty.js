// Client loyalty ("fidélité") program configuration.
//
// Points are earned from spend (1 point per CFA_PER_POINT spent) and clients
// move through tiers as their earned points grow. Shops can give bonus points
// or let clients redeem points for rewards — those adjustments are persisted on
// the client; the earned base is always derived from actual sales.

const CFA_PER_POINT = 1000; // 1 point per 1 000 CFA of purchases

const TIERS = [
  { key: 'bronze', label: 'Bronze', minPoints: 0, color: '#B45309' },
  { key: 'silver', label: 'Argent', minPoints: 50, color: '#64748B' },
  { key: 'gold', label: 'Or', minPoints: 150, color: '#D97706' },
  { key: 'vip', label: 'VIP', minPoints: 500, color: '#7C3AED' },
];

const pointsForSpend = (spend) => Math.floor((Number(spend) || 0) / CFA_PER_POINT);

const tierForPoints = (points) => {
  let current = TIERS[0];
  TIERS.forEach((t) => { if (points >= t.minPoints) current = t; });
  return current;
};

const nextTierAfter = (points) => TIERS.find((t) => t.minPoints > points) || null;

module.exports = { CFA_PER_POINT, TIERS, pointsForSpend, tierForPoints, nextTierAfter };
