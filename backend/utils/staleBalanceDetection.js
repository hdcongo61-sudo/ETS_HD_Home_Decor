// Détection des ventes partiellement payées "en sommeil" — indépendante de
// tout rappel programmé à la main (contrairement à paymentReminder), pour que
// le recouvrement ne dépende pas de la discipline de saisie à la création.

const STALE_PARTIAL_PAYMENT_DAYS = 10;

const getLastPaymentTime = (sale) => {
  let last = null;
  (sale.payments || []).forEach((payment) => {
    const time = new Date(payment.paymentDate || payment.createdAt).getTime();
    if (Number.isFinite(time) && (last === null || time > last)) last = time;
  });
  return last;
};

// sales: ventes déjà filtrées status === 'partially_paid', avec balance/totalPaid
// calculés (voir processReminders dans saleController). now: Date, injectable pour les tests.
const findStalePartialSales = (sales, now = new Date(), minDays = STALE_PARTIAL_PAYMENT_DAYS) => {
  const nowTime = now.getTime();
  return sales
    .map((sale) => {
      const lastPaymentTime = getLastPaymentTime(sale);
      const daysSincePayment = lastPaymentTime
        ? Math.floor((nowTime - lastPaymentTime) / (24 * 60 * 60 * 1000))
        : null;
      return { ...sale, daysSincePayment };
    })
    .filter((sale) => sale.balance > 0 && sale.daysSincePayment !== null && sale.daysSincePayment >= minDays)
    .sort((a, b) => b.daysSincePayment - a.daysSincePayment);
};

module.exports = { STALE_PARTIAL_PAYMENT_DAYS, getLastPaymentTime, findStalePartialSales };
