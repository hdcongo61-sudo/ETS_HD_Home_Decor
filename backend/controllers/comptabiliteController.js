// controllers/comptabiliteController.js
//
// "Cockpit financier" — consolidates the data the shop already captures
// (ventes, dépenses, paie, pertes stock, créances) into the deliverables a
// small-business accountant produces: compte de résultat, trésorerie,
// créances / dettes, bilan simplifié and a unified journal.
//
// Nothing here writes data — it only aggregates existing collections, so the
// figures always reconcile with the Ventes / Dépenses / Caisse modules.
const asyncHandler = require('express-async-handler');
const Sale = require('../models/saleModel');
const Expense = require('../models/expenseModel');
const Product = require('../models/productModel');
const Employee = require('../models/employeeModel');
const StockMovement = require('../models/stockMovementModel');
const { tenantFilter } = require('../utils/tenantQuery');

// Resolve the [start, end] window. Defaults to the current calendar month.
const resolvePeriod = (query) => {
  const now = new Date();
  let start = query.startDate ? new Date(query.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  let end = query.endDate ? new Date(query.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (Number.isNaN(start.getTime())) start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (Number.isNaN(end.getTime())) end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const round = (n) => Math.round(n || 0);

// @desc    Tableau de bord comptable consolidé (compte de résultat, trésorerie,
//          créances / dettes, bilan simplifié) pour une période.
// @route   GET /api/comptabilite/summary
// @access  Private (feature: comptabilite)
const getAccountingSummary = asyncHandler(async (req, res) => {
  const { start, end } = resolvePeriod(req.query);
  const tFilter = tenantFilter(req);

  const notCancelled = { status: { $ne: 'cancelled' } };

  // ── 1) COMPTE DE RÉSULTAT (encaissé / cash-basis, par date de paiement) ──
  // On reconnaît le chiffre d'affaires et la marge au rythme des paiements
  // RÉELLEMENT reçus : une vente payée à moitié ne compte que pour moitié.
  // Chaque paiement réalise sa part de marge : montant × (marge ÷ total vente).
  // Ainsi le CA du compte de résultat = les encaissements de la trésorerie.
  const [realizedAgg] = await Sale.aggregate([
    { $match: { ...tFilter, ...notCancelled } },
    {
      $addFields: {
        __ratio: {
          $cond: [{ $gt: ['$totalAmount', 0] },
            { $divide: [{ $ifNull: ['$profitData.totalProfit', 0] }, '$totalAmount'] }, 0],
        },
      },
    },
    { $unwind: '$payments' },
    { $addFields: { __d: { $ifNull: ['$payments.paymentDate', '$saleDate'] } } },
    { $match: { __d: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        chiffreAffaires: { $sum: '$payments.amount' },
        margeBrute: { $sum: { $multiply: ['$payments.amount', '$__ratio'] } },
        ventes: { $addToSet: '$_id' },
      },
    },
  ]);

  const chiffreAffaires = realizedAgg?.chiffreAffaires || 0;        // encaissé sur la période
  const margeBrute = realizedAgg?.margeBrute || 0;                  // marge réalisée (encaissée)
  const coutMarchandises = chiffreAffaires - margeBrute;            // coût réalisé correspondant
  const nbVentes = realizedAgg?.ventes?.length || 0;               // ventes encaissées sur la période

  // Dépenses d'exploitation, regroupées par catégorie (par date de dépense).
  const expensesByCategory = await Expense.aggregate([
    { $match: { ...tFilter, date: { $gte: start, $lte: end } } },
    { $group: { _id: { $ifNull: ['$category', 'Non catégorisé'] }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  const totalDepenses = expensesByCategory.reduce((s, c) => s + (c.total || 0), 0);

  // Pertes & casses (casse / vol / péremption / cadeau) — charges réelles non
  // saisies dans les dépenses, issues des mouvements de stock.
  const lossAgg = await StockMovement.aggregate([
    { $match: { ...tFilter, createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$reason', cost: { $sum: '$costImpact' } } },
  ]);
  const totalPertes = lossAgg.reduce((s, r) => s + (r.cost || 0), 0);

  const resultatNet = margeBrute - totalDepenses - totalPertes;

  // ── 2) TRÉSORERIE (cash-basis, par date de paiement) ────────────────────
  // Encaissé = paiements clients reçus sur la période (même base que le CA
  // du compte de résultat ci-dessus). Décaissé = dépenses payées.
  const encaissements = chiffreAffaires;
  const decaissements = totalDepenses;
  const fluxTresorerie = encaissements - decaissements;

  // ── 3) CRÉANCES CLIENTS (AR) — ventes non soldées, toutes périodes ──────
  const [arAgg] = await Sale.aggregate([
    { $match: { ...tFilter, ...notCancelled } },
    {
      $addFields: {
        __paye: { $sum: { $ifNull: ['$payments.amount', []] } },
      },
    },
    { $addFields: { __reste: { $subtract: ['$totalAmount', '$__paye'] } } },
    { $match: { __reste: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$__reste' }, count: { $sum: 1 } } },
  ]);
  const creancesClients = arAgg?.total || 0;
  const creancesCount = arAgg?.count || 0;

  // ── 4) BILAN SIMPLIFIÉ ──────────────────────────────────────────────────
  // Actif: stock (valeur au coût) + créances clients. Dettes fournisseurs
  // (AP) non encore suivies (module ravitaillement différé) → 0 pour l'instant.
  const [stockAgg] = await Product.aggregate([
    { $match: { ...tFilter, isActive: { $ne: false } } },
    {
      $group: {
        _id: null,
        valeurStock: { $sum: { $multiply: ['$stock', { $ifNull: ['$costPrice', 0] }] } },
        valeurVente: { $sum: { $multiply: ['$stock', { $ifNull: ['$price', 0] }] } },
        nbReferences: { $sum: 1 },
      },
    },
  ]);
  const valeurStock = stockAgg?.valeurStock || 0;
  const dettesFournisseurs = 0; // À venir avec le module Ravitaillement fournisseur.

  const totalActif = valeurStock + creancesClients;
  const totalPassif = dettesFournisseurs;
  const situationNette = totalActif - totalPassif;

  // ── 5) Masse salariale (informatif) — bulletins payés sur la période ────
  // Saisir les salaires comme dépense (catégorie « Salaires ») pour qu'ils
  // entrent dans le résultat ; ce bloc reste indicatif pour éviter le double
  // comptage avec les dépenses.
  const employees = await Employee.find(tFilter, 'paySlips').lean();
  let masseSalariale = 0;
  let nbBulletins = 0;
  for (const emp of employees) {
    for (const slip of emp.paySlips || []) {
      const d = slip.paymentDate ? new Date(slip.paymentDate) : null;
      if (slip.status === 'paid' && d && d >= start && d <= end) {
        masseSalariale += slip.netSalary || 0;
        nbBulletins += 1;
      }
    }
  }

  res.json({
    success: true,
    data: {
      periode: { start, end },
      compteResultat: {
        chiffreAffaires: round(chiffreAffaires),
        coutMarchandises: round(coutMarchandises),
        margeBrute: round(margeBrute),
        margeBrutePct: chiffreAffaires ? Number(((margeBrute / chiffreAffaires) * 100).toFixed(1)) : 0,
        depenses: round(totalDepenses),
        depensesParCategorie: expensesByCategory.map((c) => ({
          categorie: c._id,
          total: round(c.total),
          count: c.count,
        })),
        pertes: round(totalPertes),
        resultatNet: round(resultatNet),
        resultatNetPct: chiffreAffaires ? Number(((resultatNet / chiffreAffaires) * 100).toFixed(1)) : 0,
        nbVentes,
      },
      tresorerie: {
        encaissements: round(encaissements),
        decaissements: round(decaissements),
        flux: round(fluxTresorerie),
      },
      creances: {
        clients: round(creancesClients),
        nbFactures: creancesCount,
      },
      bilan: {
        actif: { stock: round(valeurStock), creancesClients: round(creancesClients), total: round(totalActif) },
        passif: { dettesFournisseurs: round(dettesFournisseurs), total: round(totalPassif) },
        situationNette: round(situationNette),
        nbReferences: stockAgg?.nbReferences || 0,
        valeurStockVente: round(stockAgg?.valeurVente || 0),
      },
      paie: {
        masseSalariale: round(masseSalariale),
        nbBulletins,
      },
    },
  });
});

// @desc    Journal comptable — flux chronologique unifié (ventes, encaissements,
//          dépenses) sur la période.
// @route   GET /api/comptabilite/journal
// @access  Private (feature: comptabilite)
const getJournal = asyncHandler(async (req, res) => {
  const { start, end } = resolvePeriod(req.query);
  const tFilter = tenantFilter(req);
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);

  const entries = [];

  // Ventes (produit / crédit)
  const sales = await Sale.find(
    { ...tFilter, status: { $ne: 'cancelled' }, saleDate: { $gte: start, $lte: end } },
    'saleType saleDate totalAmount client',
  )
    .populate('client', 'name')
    .sort({ saleDate: -1 })
    .limit(limit)
    .lean();
  for (const s of sales) {
    entries.push({
      date: s.saleDate,
      type: 'vente',
      libelle: `Vente — ${s.client?.name || 'Client'}`,
      credit: s.totalAmount || 0, // produit
      debit: 0,
    });
  }

  // Dépenses (charges)
  const expenses = await Expense.find(
    { ...tFilter, date: { $gte: start, $lte: end } },
    'description category amount date',
  )
    .sort({ date: -1 })
    .limit(limit)
    .lean();
  for (const e of expenses) {
    entries.push({
      date: e.date,
      type: 'depense',
      libelle: `${e.category || 'Dépense'} — ${e.description || ''}`.trim(),
      credit: 0,
      debit: e.amount || 0, // charge
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totals = entries.reduce(
    (acc, e) => ({ credit: acc.credit + e.credit, debit: acc.debit + e.debit }),
    { credit: 0, debit: 0 },
  );

  res.json({
    success: true,
    data: {
      periode: { start, end },
      entries: entries.slice(0, limit),
      totals: { credit: round(totals.credit), debit: round(totals.debit), solde: round(totals.credit - totals.debit) },
    },
  });
});

module.exports = { getAccountingSummary, getJournal };
