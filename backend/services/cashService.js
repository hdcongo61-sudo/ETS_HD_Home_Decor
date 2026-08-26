/**
 * CashService — caisses et sessions (Phase 5.7) + numérotation (Phase 5.3).
 *
 * - `createRegister` : caisse attachée à une boutique ;
 * - `openSession` : une seule session ouverte par caisse ;
 * - `getSessionState` : expectedClosing = ouverture + encaissements cash
 *   (paiements `completed` liés) - dépenses cash liées ;
 * - `closeSession` : enregistre le compté, calcule l'écart, clôture ;
 * - `nextNumber` : séquence atomique tenant/boutique/type/période fiscale.
 */
const CashRegister = require('../models/cashRegisterModel');
const CashSession = require('../models/cashSessionModel');
const NumberSequence = require('../models/numberSequenceModel');
const Payment = require('../models/paymentModel');
const Expense = require('../models/expenseModel');
const Location = require('../models/locationModel');

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

async function createRegister({ tenantId, locationId, code, name, userId = null }) {
  const location = await Location.findOne({ tenantId, _id: locationId }).select('_id').lean();
  if (!location) throw conflict('Boutique introuvable dans cette organisation.');
  return CashRegister.create({
    tenantId,
    locationId,
    code: String(code || '').trim().toUpperCase(),
    name: String(name || '').trim(),
    createdBy: userId,
  });
}

async function openSession({ tenantId, registerId, openingFloat = 0, userId = null }) {
  const register = await CashRegister.findOne({ tenantId, _id: registerId, isActive: true }).lean();
  if (!register) throw notFound('Caisse introuvable dans cette organisation.');

  const alreadyOpen = await CashSession.findOne({ tenantId, registerId, status: 'open' }).lean();
  if (alreadyOpen) throw conflict('Une session est déjà ouverte sur cette caisse.');

  const amount = Number(openingFloat);
  if (!Number.isFinite(amount) || amount < 0) throw badRequest('Fond d\'ouverture invalide.');

  return CashSession.create({
    tenantId,
    locationId: register.locationId,
    registerId,
    status: 'open',
    openingFloat: round2(amount),
    openedBy: userId,
    openedAt: new Date(),
  });
}

async function getSessionState({ tenantId, sessionId }) {
  const session = await CashSession.findOne({ tenantId, _id: sessionId }).lean();
  if (!session) throw notFound('Session introuvable dans cette organisation.');

  const cashInRows = await Payment.aggregate([
    {
      $match: {
        tenantId, cashSessionId: session._id,
        method: 'cash', status: 'completed',
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const cashIn = cashInRows.length ? cashInRows[0].total : 0;

  const cashOutRows = await Expense.aggregate([
    {
      $match: {
        tenantId, cashSessionId: session._id, paymentMethod: 'cash',
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const cashOut = cashOutRows.length ? cashOutRows[0].total : 0;

  const expectedClosing = round2(session.openingFloat + cashIn - cashOut);
  return {
    session,
    cashIn: round2(cashIn),
    cashOut: round2(cashOut),
    expectedClosing,
    countedClosing: session.countedClosing,
    discrepancy: session.countedClosing === null || session.countedClosing === undefined
      ? null
      : round2(session.countedClosing - expectedClosing),
  };
}

async function closeSession({ tenantId, sessionId, countedClosing, userId = null }) {
  const session = await CashSession.findOne({ tenantId, _id: sessionId });
  if (!session) throw notFound('Session introuvable dans cette organisation.');
  if (session.status !== 'open') throw conflict(`Impossible de clôturer une session « ${session.status} ».`);

  const counted = Number(countedClosing);
  if (!Number.isFinite(counted) || counted < 0) throw badRequest('Montant compté invalide.');

  const state = await getSessionState({ tenantId, sessionId });
  session.status = 'closed';
  session.countedClosing = round2(counted);
  session.expectedClosing = state.expectedClosing;
  session.discrepancy = round2(counted - state.expectedClosing);
  session.closedBy = userId;
  session.closedAt = new Date();
  await session.save();
  return {
    session,
    cashIn: state.cashIn,
    cashOut: state.cashOut,
    expectedClosing: state.expectedClosing,
    discrepancy: session.discrepancy,
  };
}

async function nextNumber({ tenantId, locationId = null, docType, fiscalPeriod = null }) {
  const type = String(docType || '').trim().toUpperCase();
  if (!type) throw badRequest('Type de document requis (docType).');
  const period = fiscalPeriod || String(new Date().getFullYear());

  const sequence = await NumberSequence.findOneAndUpdate(
    { tenantId, locationId, docType: type, fiscalPeriod: period },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { number: sequence.seq, seq: sequence.seq, docType: type, fiscalPeriod: period, locationId };
}

module.exports = { createRegister, openSession, getSessionState, closeSession, nextNumber };
