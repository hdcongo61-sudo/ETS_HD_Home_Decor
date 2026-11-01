const asyncHandler = require('express-async-handler');
const FixedAsset = require('../models/fixedAssetModel');
const Account = require('../models/accountModel');
const JournalEntry = require('../models/journalEntryModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');
const { nextNumber } = require('../services/cashService');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const assetMetrics = (asset) => {
  const cost = Number(asset.cost) || 0;
  const salvageValue = Number(asset.salvageValue) || 0;
  const usefulLifeYears = Number(asset.usefulLifeYears) || 1;
  const depreciableBase = Math.max(0, cost - salvageValue);
  const annualDepreciation = depreciableBase / usefulLifeYears;
  const monthlyDepreciation = annualDepreciation / 12;
  const accumulatedDepreciation = Number(asset.accumulatedDepreciation) || 0;
  return {
    cost,
    salvageValue,
    usefulLifeYears,
    depreciableBase,
    annualDepreciation,
    monthlyDepreciation,
    accumulatedDepreciation,
    remainingBase: Math.max(0, depreciableBase - accumulatedDepreciation),
    netBookValue: round2(Math.max(salvageValue, cost - accumulatedDepreciation)),
  };
};

// Plan d'amortissement linéaire, première année proratisée au mois.
const buildSchedule = (asset) => {
  const metrics = assetMetrics(asset);
  const purchaseYear = new Date(asset.purchaseDate).getFullYear();
  const firstYearMonths = Math.max(1, 12 - new Date(asset.purchaseDate).getMonth());
  const rows = [];
  let remaining = metrics.depreciableBase;
  let accumulated = 0;
  let index = 0;

  while (remaining > 0.005 && index <= metrics.usefulLifeYears) {
    const year = purchaseYear + index;
    const full = index === 0 ? metrics.monthlyDepreciation * firstYearMonths : metrics.annualDepreciation;
    const depreciation = round2(Math.min(full, remaining));
    accumulated = round2(accumulated + depreciation);
    remaining = round2(remaining - depreciation);
    rows.push({
      year,
      depreciation,
      accumulated,
      netBookValue: round2(Math.max(metrics.salvageValue, metrics.cost - accumulated)),
    });
    index += 1;
  }
  return rows;
};

const sanitizeAsset = (asset) => {
  const doc = asset?.toObject ? asset.toObject() : asset || {};
  const metrics = assetMetrics(doc);
  return {
    ...doc,
    _id: doc._id?.toString?.() || doc._id,
    tenantId: doc.tenantId?.toString?.() || doc.tenantId,
    locationId: doc.locationId?.toString?.() || doc.locationId,
    createdBy: doc.createdBy?.toString?.() || doc.createdBy,
    ...metrics,
  };
};

// @desc    Liste des immobilisations
// @route   GET /api/assets
const getAssets = asyncHandler(async (req, res) => {
  const assets = await FixedAsset.find(tenantFilter(req)).sort({ purchaseDate: -1 }).lean();
  res.json(assets.map(sanitizeAsset));
});

// @desc    Détail + plan d'amortissement
// @route   GET /api/assets/:id
const getAssetById = asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findOne({ ...tenantFilter(req), _id: req.params.id }).lean();
  if (!asset) return res.status(404).json({ message: 'Immobilisation non trouvée.' });
  res.json({ ...sanitizeAsset(asset), schedule: buildSchedule(asset) });
});

// @desc    Créer une immobilisation
// @route   POST /api/assets
const createAsset = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const cost = Number(req.body.cost);
  if (!name) return res.status(400).json({ message: 'Le nom est requis' });
  if (!Number.isFinite(cost) || cost < 0) return res.status(400).json({ message: 'Coût invalide' });

  const asset = await FixedAsset.create(
    applyTenant(req, {
      name: name.slice(0, 120),
      category: String(req.body.category || '').trim().slice(0, 60),
      cost,
      purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : new Date(),
      usefulLifeYears: Math.max(1, Number(req.body.usefulLifeYears) || 5),
      salvageValue: Math.max(0, Number(req.body.salvageValue) || 0),
      method: 'straight_line',
      createdBy: req.user._id,
    })
  );

  const created = await FixedAsset.findById(asset._id).lean();
  res.status(201).json(sanitizeAsset(created));
});

// @desc    Modifier une immobilisation
// @route   PUT /api/assets/:id
const updateAsset = asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!asset) return res.status(404).json({ message: 'Immobilisation non trouvée.' });

  if (req.body.name !== undefined) asset.name = String(req.body.name).trim().slice(0, 120);
  if (req.body.category !== undefined) asset.category = String(req.body.category).trim().slice(0, 60);
  if (req.body.cost !== undefined) asset.cost = Math.max(0, Number(req.body.cost) || 0);
  if (req.body.purchaseDate !== undefined) asset.purchaseDate = new Date(req.body.purchaseDate);
  if (req.body.usefulLifeYears !== undefined) asset.usefulLifeYears = Math.max(1, Number(req.body.usefulLifeYears) || 1);
  if (req.body.salvageValue !== undefined) asset.salvageValue = Math.max(0, Number(req.body.salvageValue) || 0);
  if (req.body.status !== undefined && ['active', 'disposed'].includes(req.body.status)) {
    asset.status = req.body.status;
  }

  await asset.save();
  const updated = await FixedAsset.findById(asset._id).lean();
  res.json(sanitizeAsset(updated));
});

// @desc    Supprimer une immobilisation (sans écriture d'amortissement)
// @route   DELETE /api/assets/:id
const deleteAsset = asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findOneAndDelete({ ...tenantFilter(req), _id: req.params.id });
  if (!asset) return res.status(404).json({ message: 'Immobilisation non trouvée.' });
  res.json({ message: 'Immobilisation supprimée.' });
});

// @desc    Comptabiliser l'amortissement d'un exercice dans le grand livre
// @route   POST /api/assets/:id/depreciate
const postDepreciation = asyncHandler(async (req, res) => {
  const asset = await FixedAsset.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!asset) return res.status(404).json({ message: 'Immobilisation non trouvée.' });

  const year = Number(req.body.year) || new Date().getFullYear();
  const schedule = buildSchedule(asset);
  const row = schedule.find((item) => item.year === year);
  if (!row) {
    return res.status(400).json({ message: `Aucun amortissement prévu pour l'exercice ${year}.` });
  }
  if (row.depreciation <= 0) {
    return res.status(400).json({ message: 'Amortissement déjà entièrement constaté.' });
  }

  // Comptes cibles (681 dotations, 281 amortissements cumulés).
  const ensureAccount = async (code, name, type) => {
    let account = await Account.findOne({ ...tenantFilter(req), code }).lean();
    if (!account) {
      account = await Account.create({
        tenantId: req.tenantId || null,
        code,
        name,
        type,
        active: true,
        createdBy: req.user ? req.user._id : null,
      });
    }
    return account;
  };
  const expenseAccount = await ensureAccount('681', 'Dotations aux amortissements', 'expense');
  const contraAccount = await ensureAccount('281', 'Amortissements des immobilisations', 'asset');

  let entryNumber = null;
  try {
    const sequence = await nextNumber({
      tenantId: req.tenantId,
      locationId: req.locationId || null,
      docType: 'ECRITURE',
      fiscalPeriod: String(year),
    });
    entryNumber = `EC-${sequence.fiscalPeriod}-${String(sequence.seq).padStart(4, '0')}`;
  } catch (error) {
    console.error('⚠️ Échec de génération de référence d’écriture:', error.message);
  }

  const entry = await JournalEntry.create({
    tenantId: req.tenantId || null,
    entryNumber,
    date: new Date(year, 11, 31),
    description: `Amortissement ${asset.name} — exercice ${year}`,
    sourceType: 'depreciation',
    sourceId: asset._id,
    lines: [
      { account: expenseAccount._id, debit: row.depreciation, credit: 0 },
      { account: contraAccount._id, debit: 0, credit: row.depreciation },
    ],
    createdBy: req.user ? req.user._id : null,
  });

  asset.accumulatedDepreciation = round2((Number(asset.accumulatedDepreciation) || 0) + row.depreciation);
  asset.lastDepreciationAt = new Date(year, 11, 31);
  await asset.save();

  const updated = await FixedAsset.findById(asset._id).lean();
  res.status(201).json({ asset: sanitizeAsset(updated), entry });
});

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  postDepreciation,
};
