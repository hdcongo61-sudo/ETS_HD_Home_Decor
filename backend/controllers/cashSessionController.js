const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const CashSession = require('../models/cashSessionModel');
const Sale = require('../models/saleModel');
const Expense = require('../models/expenseModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

/**
 * Aggregate the money that flowed through the drawer during [start, end].
 * Cash collected comes from sale payments with method 'cash'; mobile money &
 * credit are tracked for the Z-report. Cash expenses reduce the drawer.
 */
const computeSessionTotals = async (req, start, end) => {
  const tf = tenantFilter(req);

  const [paymentAgg, expenseAgg] = await Promise.all([
    Sale.aggregate([
      { $match: { ...tf, status: { $ne: 'cancelled' } } },
      { $unwind: '$payments' },
      { $match: { 'payments.paymentDate': { $gte: start, $lte: end } } },
      { $group: { _id: '$payments.method', amount: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { ...tf, paymentMethod: 'cash', date: { $gte: start, $lte: end } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const byMethod = Object.fromEntries(paymentAgg.map((p) => [p._id || 'cash', p]));
  const cashCollected = byMethod.cash?.amount || 0;
  const mobileMoneyCollected = byMethod.MobileMoney?.amount || 0;
  const creditCollected = byMethod.credit?.amount || 0;
  const paymentsCount = paymentAgg.reduce((s, p) => s + p.count, 0);
  const cashExpenses = expenseAgg[0]?.amount || 0;
  const expensesCount = expenseAgg[0]?.count || 0;

  return {
    cashCollected: Math.round(cashCollected),
    mobileMoneyCollected: Math.round(mobileMoneyCollected),
    creditCollected: Math.round(creditCollected),
    totalCollected: Math.round(cashCollected + mobileMoneyCollected + creditCollected),
    cashExpenses: Math.round(cashExpenses),
    paymentsCount,
    expensesCount,
  };
};

// ── Get the current OPEN session (with live totals) ──
// GET /api/cash-sessions/current
const getCurrentSession = asyncHandler(async (req, res) => {
  const session = await CashSession.findOne({ ...tenantFilter(req), status: 'open' }).lean();
  if (!session) return res.json(null);

  const totals = await computeSessionTotals(req, new Date(session.openedAt), new Date());
  const expectedCash = Math.round((session.openingFloat || 0) + totals.cashCollected - totals.cashExpenses);

  res.json({ ...session, totals, expectedCash, live: true });
});

// ── Open a new session ──
// POST /api/cash-sessions/open  { openingFloat, openingNote }
const openSession = asyncHandler(async (req, res) => {
  const existing = await CashSession.findOne({ ...tenantFilter(req), status: 'open' });
  if (existing) {
    res.status(400);
    throw new Error('Une session de caisse est déjà ouverte. Clôturez-la avant d\'en ouvrir une nouvelle.');
  }

  const openingFloat = Math.max(0, Number(req.body.openingFloat) || 0);
  const session = await CashSession.create(applyTenant(req, {
    status: 'open',
    openedBy: req.user._id,
    openedByName: req.user.name || '',
    openedAt: new Date(),
    openingFloat,
    openingNote: String(req.body.openingNote || '').trim(),
  }));

  res.status(201).json(session);
});

// ── Close the open session ──
// POST /api/cash-sessions/:id/close  { countedCash, closingNote }
const closeSession = asyncHandler(async (req, res) => {
  const session = await CashSession.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!session) {
    res.status(404);
    throw new Error('Session introuvable.');
  }
  if (session.status === 'closed') {
    res.status(400);
    throw new Error('Cette session est déjà clôturée.');
  }

  const closedAt = new Date();
  const totals = await computeSessionTotals(req, new Date(session.openedAt), closedAt);
  const expectedCash = Math.round((session.openingFloat || 0) + totals.cashCollected - totals.cashExpenses);
  const countedCash = Math.max(0, Number(req.body.countedCash) || 0);

  session.status = 'closed';
  session.closedBy = req.user._id;
  session.closedByName = req.user.name || '';
  session.closedAt = closedAt;
  session.countedCash = countedCash;
  session.expectedCash = expectedCash;
  session.discrepancy = countedCash - expectedCash;
  session.closingNote = String(req.body.closingNote || '').trim();
  session.totals = totals;

  await session.save();
  res.json(session);
});

// ── Session history ──
// GET /api/cash-sessions?limit=50
const getSessions = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const sessions = await CashSession.find({ ...tenantFilter(req), status: 'closed' })
    .sort({ closedAt: -1 })
    .limit(limit)
    .lean();
  res.json(sessions);
});

// ── Single session (Z-report) ──
// GET /api/cash-sessions/:id
const getSessionById = asyncHandler(async (req, res) => {
  const session = await CashSession.findOne({ ...tenantFilter(req), _id: req.params.id }).lean();
  if (!session) {
    res.status(404);
    throw new Error('Session introuvable.');
  }
  // For an open session, attach live totals; closed ones use the frozen snapshot.
  if (session.status === 'open') {
    const totals = await computeSessionTotals(req, new Date(session.openedAt), new Date());
    session.totals = totals;
    session.expectedCash = Math.round((session.openingFloat || 0) + totals.cashCollected - totals.cashExpenses);
  }
  res.json(session);
});

module.exports = {
  getCurrentSession,
  openSession,
  closeSession,
  getSessions,
  getSessionById,
};
