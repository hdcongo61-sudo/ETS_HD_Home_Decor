const asyncHandler = require('express-async-handler');
const Account = require('../models/accountModel');
const JournalEntry = require('../models/journalEntryModel');
const { tenantFilter } = require('../utils/tenantQuery');
const { nextNumber } = require('../services/cashService');

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

const ACCOUNT_TYPES = {
  asset: 'Actif',
  liability: 'Passif',
  equity: 'Capitaux propres',
  revenue: 'Produits',
  expense: 'Charges',
};

const STANDARD_CHART = [
  { code: '101', name: 'Capital', type: 'equity' },
  { code: '215', name: 'Matériel & équipements', type: 'asset' },
  { code: '401', name: 'Fournisseurs', type: 'liability' },
  { code: '411', name: 'Clients', type: 'asset' },
  { code: '512', name: 'Banque', type: 'asset' },
  { code: '530', name: 'Caisse', type: 'asset' },
  { code: '607', name: 'Achats de marchandises', type: 'expense' },
  { code: '611', name: 'Services extérieurs', type: 'expense' },
  { code: '641', name: 'Charges de personnel', type: 'expense' },
  { code: '661', name: 'Charges financières', type: 'expense' },
  { code: '681', name: 'Dotations aux amortissements', type: 'expense' },
  { code: '281', name: 'Amortissements des immobilisations', type: 'asset' },
  { code: '701', name: 'Ventes de marchandises', type: 'revenue' },
  { code: '707', name: 'Services vendus', type: 'revenue' },
];

const sanitizeAccount = (account) => {
  const doc = account?.toObject ? account.toObject() : account || {};
  return {
    ...doc,
    _id: doc._id?.toString?.() || doc._id,
    tenantId: doc.tenantId?.toString?.() || doc.tenantId,
    parent: doc.parent?.toString?.() || doc.parent,
    createdBy: doc.createdBy?.toString?.() || doc.createdBy,
    typeLabel: ACCOUNT_TYPES[doc.type] || doc.type,
  };
};

// @desc    Liste du plan comptable
// @route   GET /api/ledger/accounts
const getAccounts = asyncHandler(async (req, res) => {
  const accounts = await Account.find(tenantFilter(req)).sort({ code: 1 }).lean();
  res.json(accounts.map(sanitizeAccount));
});

// @desc    Créer un compte
// @route   POST /api/ledger/accounts
const createAccount = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim();
  const name = String(req.body.name || '').trim();
  const type = String(req.body.type || '').trim();
  if (!code || !name) {
    return res.status(400).json({ message: 'Le code et le libellé sont requis' });
  }
  if (!ACCOUNT_TYPES[type]) {
    return res.status(400).json({ message: 'Type de compte invalide' });
  }

  const duplicate = await Account.findOne({ ...tenantFilter(req), code });
  if (duplicate) {
    return res.status(409).json({ message: `Le code ${code} existe déjà` });
  }

  const account = await Account.create({
    tenantId: req.tenantId || null,
    code: code.slice(0, 20),
    name: name.slice(0, 120),
    type,
    parent: req.body.parent || null,
    active: req.body.active !== false,
    createdBy: req.user ? req.user._id : null,
  });

  res.status(201).json(sanitizeAccount(account));
});

// @desc    Modifier un compte
// @route   PUT /api/ledger/accounts/:id
const updateAccount = asyncHandler(async (req, res) => {
  const account = await Account.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!account) {
    return res.status(404).json({ message: 'Compte non trouvé' });
  }

  if (req.body.name !== undefined) account.name = String(req.body.name).trim().slice(0, 120);
  if (req.body.type !== undefined) {
    const type = String(req.body.type).trim();
    if (!ACCOUNT_TYPES[type]) {
      return res.status(400).json({ message: 'Type de compte invalide' });
    }
    account.type = type;
  }
  if (req.body.parent !== undefined) account.parent = req.body.parent || null;
  if (req.body.active !== undefined) account.active = Boolean(req.body.active);

  await account.save();
  res.json(sanitizeAccount(account));
});

// @desc    Initialiser le plan comptable standard (si vide)
// @route   POST /api/ledger/accounts/seed
const seedAccounts = asyncHandler(async (req, res) => {
  const existing = await Account.findOne(tenantFilter(req)).select('_id').lean();
  if (existing) {
    return res.status(409).json({ message: 'Un plan comptable existe déjà' });
  }

  const created = await Account.insertMany(
    STANDARD_CHART.map((account) => ({
      tenantId: req.tenantId || null,
      code: account.code,
      name: account.name,
      type: account.type,
      active: true,
      createdBy: req.user ? req.user._id : null,
    }))
  );

  res.status(201).json({ count: created.length, accounts: created.map(sanitizeAccount) });
});

// @desc    Liste des écritures du journal
// @route   GET /api/ledger/entries
const getJournalEntries = asyncHandler(async (req, res) => {
  const filter = tenantFilter(req);
  const accountId = req.query.account ? String(req.query.account) : null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

  if (accountId) {
    filter['lines.account'] = accountId;
  }
  if (req.query.start || req.query.end) {
    filter.date = {};
    if (req.query.start) filter.date.$gte = new Date(req.query.start);
    if (req.query.end) filter.date.$lte = new Date(req.query.end);
  }

  const entries = await JournalEntry.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate('lines.account', 'code name type')
    .lean();

  const total = await JournalEntry.countDocuments(filter);

  res.json({
    entries,
    total,
    limit,
  });
});

// @desc    Créer une écriture (validation partie double)
// @route   POST /api/ledger/entries
const createJournalEntry = asyncHandler(async (req, res) => {
  const rawLines = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (rawLines.length < 2) {
    return res.status(400).json({ message: 'Une écriture doit contenir au moins deux lignes' });
  }

  const accountIds = [...new Set(rawLines.map((line) => line.account).filter(Boolean))];
  const accounts = await Account.find({ ...tenantFilter(req), _id: { $in: accountIds } }).lean();
  const accountMap = new Map(accounts.map((account) => [String(account._id), account]));

  const lines = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const raw of rawLines) {
    const accountId = String(raw.account || '');
    const account = accountMap.get(accountId);
    if (!account) {
      return res.status(400).json({ message: 'Compte introuvable dans cette boutique' });
    }

    const debit = round(raw.debit);
    const credit = round(raw.credit);
    if (debit < 0 || credit < 0) {
      return res.status(400).json({ message: 'Les montants ne peuvent pas être négatifs' });
    }
    if ((debit > 0) === (credit > 0)) {
      return res.status(400).json({ message: 'Chaque ligne doit porter un débit OU un crédit' });
    }

    totalDebit = round(totalDebit + debit);
    totalCredit = round(totalCredit + credit);

    lines.push({
      account: accountId,
      description: String(raw.description || '').trim().slice(0, 200),
      debit,
      credit,
    });
  }

  if (totalDebit <= 0 || totalCredit <= 0) {
    return res.status(400).json({ message: 'Le total de l’écriture doit être positif' });
  }
  if (round(totalDebit - totalCredit) !== 0) {
    return res.status(400).json({
      message: `Écriture non équilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}`,
    });
  }

  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ message: 'Date invalide' });
  }

  let entryNumber = null;
  try {
    const sequence = await nextNumber({
      tenantId: req.tenantId,
      locationId: req.locationId || null,
      docType: 'ECRITURE',
      fiscalPeriod: String(date.getFullYear()),
    });
    entryNumber = `EC-${sequence.fiscalPeriod}-${String(sequence.seq).padStart(4, '0')}`;
  } catch (error) {
    console.error('⚠️ Échec de génération de référence d’écriture:', error.message);
  }

  const entry = await JournalEntry.create({
    tenantId: req.tenantId || null,
    entryNumber,
    date,
    description: String(req.body.description || '').trim().slice(0, 300),
    sourceType: 'manual',
    sourceId: null,
    lines,
    createdBy: req.user ? req.user._id : null,
  });

  res.status(201).json(entry);
});

// @desc    Supprimer une écriture manuelle
// @route   DELETE /api/ledger/entries/:id
const deleteJournalEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOneAndDelete({ ...tenantFilter(req), _id: req.params.id });
  if (!entry) {
    return res.status(404).json({ message: 'Écriture non trouvée' });
  }
  res.json({ message: 'Écriture supprimée' });
});

// @desc    Balance comptable (somme des débits/crédits par compte)
// @route   GET /api/ledger/trial-balance
const getTrialBalance = asyncHandler(async (req, res) => {
  const match = tenantFilter(req);
  if (req.query.start || req.query.end) {
    match.date = {};
    if (req.query.start) match.date.$gte = new Date(req.query.start);
    if (req.query.end) match.date.$lte = new Date(req.query.end);
  }

  const [rows] = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.account',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: '_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        accountId: '$_id',
        code: '$account.code',
        name: '$account.name',
        type: '$account.type',
        debit: { $round: ['$debit', 2] },
        credit: { $round: ['$credit', 2] },
      },
    },
    { $sort: { code: 1 } },
  ]);

  let totalDebit = 0;
  let totalCredit = 0;
  const balanceRows = rows.map((row) => {
    totalDebit = round(totalDebit + row.debit);
    totalCredit = round(totalCredit + row.credit);
    return {
      ...row,
      balance: round(row.debit - row.credit),
    };
  });

  res.json({
    rows: balanceRows,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      balanced: round(totalDebit - totalCredit) === 0,
    },
  });
});

// @desc    Grand livre d'un compte (historique + solde courant)
// @route   GET /api/ledger/accounts/:id/ledger
const getAccountLedger = asyncHandler(async (req, res) => {
  const account = await Account.findOne({ ...tenantFilter(req), _id: req.params.id }).lean();
  if (!account) {
    return res.status(404).json({ message: 'Compte non trouvé' });
  }

  const entries = await JournalEntry.find({
    ...tenantFilter(req),
    'lines.account': req.params.id,
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  let runningBalance = 0;
  const rows = [];
  for (const entry of entries) {
    const line = (entry.lines || []).find((l) => String(l.account) === String(req.params.id));
    if (!line) continue;
    runningBalance = round(runningBalance + line.debit - line.credit);
    rows.push({
      entryId: entry._id,
      entryNumber: entry.entryNumber,
      date: entry.date,
      description: line.description || entry.description,
      debit: line.debit,
      credit: line.credit,
      runningBalance,
    });
  }

  res.json({
    account: sanitizeAccount(account),
    rows,
    closingBalance: runningBalance,
  });
});

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  seedAccounts,
  getJournalEntries,
  createJournalEntry,
  deleteJournalEntry,
  getTrialBalance,
  getAccountLedger,
};
