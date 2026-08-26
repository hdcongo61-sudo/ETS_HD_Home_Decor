/**
 * PaymentService — paiements v2 (Phase 5.4).
 *
 * - `recordPayment` : crée le document Payment (double-écriture), idempotent
 *   par clé, avec garde anti-sur-paiement (sauf politique de crédit client).
 * - `reversePayment` : marque le paiement `reversed` (append-only), idempotent.
 *
 * Le tableau embarqué `sale.payments` reste géré par le contrôleur legacy ;
 * ces commandes n'écrivent QUE dans la collection dédiée.
 */
const Payment = require('../models/paymentModel');

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

/**
 * allowedRemaining  : solde restant de la vente (montant total - déjà payé).
 * allowCredit        : vrai si l'organisation accepte le prépaiement/crédit.
 * externalSession    : session Mongo optionnelle (la commande ne commite pas).
 */
async function recordPayment({
  tenantId, locationId = null, saleId, amount, method = 'cash', currency = 'XOF',
  status = 'completed', externalReference = null, idempotencyKey = null,
  cashSessionId = null, paidAt = null, receivedBy = null, note = '',
  allowedRemaining = null, allowCredit = false,
}, externalSession = null) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw badRequest('Montant de paiement invalide.');

  if (idempotencyKey) {
    const existing = await Payment.findOne({ tenantId, idempotencyKey })
      .session(externalSession).lean();
    if (existing) return { alreadyApplied: true, payment: existing };
  }

  if (allowedRemaining !== null && Number.isFinite(allowedRemaining)) {
    const overpay = value - Number(allowedRemaining);
    if (!allowCredit && overpay > 0.005) {
      throw conflict(`Le montant dépasse le solde restant (${Number(allowedRemaining).toFixed(2)} CFA). Utilisez le crédit client pour un prépaiement.`);
    }
  }

  const [payment] = await Payment.create([{
    tenantId,
    locationId,
    saleId,
    amount: value,
    currency,
    method,
    status,
    externalReference,
    idempotencyKey,
    cashSessionId,
    paidAt: paidAt || new Date(),
    receivedBy,
    note: String(note || '').slice(0, 300),
  }], externalSession ? { session: externalSession } : {});

  return { alreadyApplied: false, payment };
}

async function reversePayment({ tenantId, paymentId, reversalReason = '', reversedBy = null }, externalSession = null) {
  const payment = await Payment.findOne({ tenantId, _id: paymentId }).session(externalSession);
  if (!payment) {
    const err = new Error('Paiement introuvable dans cette organisation.');
    err.statusCode = 404;
    throw err;
  }
  if (payment.status === 'reversed') return { alreadyApplied: true, payment };

  payment.status = 'reversed';
  payment.reversalReason = String(reversalReason || '').slice(0, 300);
  payment.reversedBy = reversedBy;
  payment.reversedAt = new Date();
  await payment.save(externalSession ? { session: externalSession } : {});
  return { alreadyApplied: false, payment };
}

module.exports = { recordPayment, reversePayment };
