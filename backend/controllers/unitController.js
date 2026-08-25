const UnitOfMeasure = require('../models/unitOfMeasureModel');
const UnitConversion = require('../models/unitConversionModel');
const { tenantFilter } = require('../utils/tenantQuery');

const KEY_REGEX = /^[a-z0-9_-]{2,32}$/;
const CLASSES = ['count', 'length', 'weight', 'volume', 'area', 'other'];

// ── Unités ──
exports.getUnits = async (req, res) => {
  try {
    const items = await UnitOfMeasure.find(tenantFilter(req)).sort({ name: 1 }).lean();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUnit = async (req, res) => {
  try {
    const { key, name, symbol, unitClass, decimals } = req.body || {};
    const cleanKey = typeof key === 'string' ? key.trim().toLowerCase() : '';
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanKey || !KEY_REGEX.test(cleanKey)) {
      return res.status(400).json({ message: 'Clé invalide (lettres minuscules, chiffres, - et _).' });
    }
    if (!cleanName) return res.status(400).json({ message: 'Le nom de l’unité est requis.' });
    if (unitClass !== undefined && !CLASSES.includes(unitClass)) {
      return res.status(400).json({ message: 'Classe d’unité invalide.' });
    }
    const unit = await UnitOfMeasure.create({
      tenantId: req.tenantId,
      key: cleanKey,
      name: cleanName,
      symbol: typeof symbol === 'string' ? symbol.trim() : '',
      unitClass: unitClass || 'other',
      decimals: Number.isInteger(Number(decimals)) ? Math.min(4, Math.max(0, Number(decimals))) : 0,
      isActive: req.body.isActive !== false,
    });
    res.status(201).json(unit);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Une unité avec cette clé existe déjà.' });
    res.status(500).json({ message: error.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const unit = await UnitOfMeasure.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!unit) return res.status(404).json({ message: 'Unité introuvable.' });
    if (req.body.key !== undefined) {
      const cleanKey = String(req.body.key).trim().toLowerCase();
      if (!KEY_REGEX.test(cleanKey)) return res.status(400).json({ message: 'Clé invalide.' });
      unit.key = cleanKey;
    }
    if (req.body.name !== undefined) unit.name = String(req.body.name).trim();
    if (req.body.symbol !== undefined) unit.symbol = String(req.body.symbol).trim();
    if (req.body.unitClass !== undefined) {
      if (!CLASSES.includes(req.body.unitClass)) return res.status(400).json({ message: 'Classe d’unité invalide.' });
      unit.unitClass = req.body.unitClass;
    }
    if (req.body.decimals !== undefined) unit.decimals = Math.min(4, Math.max(0, Number(req.body.decimals) || 0));
    if (req.body.isActive !== undefined) unit.isActive = Boolean(req.body.isActive);
    await unit.save();
    res.json(unit);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Une unité avec cette clé existe déjà.' });
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    const unit = await UnitOfMeasure.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!unit) return res.status(404).json({ message: 'Unité introuvable.' });
    const used = await UnitConversion.countDocuments({
      tenantId: req.tenantId,
      $or: [{ fromUnitId: unit._id }, { toUnitId: unit._id }],
    });
    if (used > 0) {
      return res.status(400).json({ message: 'Supprimez d’abord les conversions liées à cette unité.' });
    }
    await UnitOfMeasure.deleteOne({ _id: unit._id });
    res.json({ message: 'Unité supprimée.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Conversions ──
exports.getConversions = async (req, res) => {
  try {
    const items = await UnitConversion.find(tenantFilter(req))
      .populate('fromUnitId', 'key name symbol')
      .populate('toUnitId', 'key name symbol')
      .sort({ createdAt: 1 })
      .lean();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createConversion = async (req, res) => {
  try {
    const { fromUnitId, toUnitId, factor, productId } = req.body || {};
    const numericFactor = Number(factor);
    if (!Number.isFinite(numericFactor) || numericFactor <= 0) {
      return res.status(400).json({ message: 'Le facteur doit être un nombre strictement positif.' });
    }
    if (String(fromUnitId) === String(toUnitId)) {
      return res.status(400).json({ message: 'Les unités source et cible doivent différer.' });
    }
    const units = await UnitOfMeasure.find({
      ...tenantFilter(req),
      _id: { $in: [fromUnitId, toUnitId].filter(Boolean) },
    }).select('_id').lean();
    if (units.length !== 2) return res.status(404).json({ message: 'Unités introuvables.' });
    const conversion = await UnitConversion.create({
      tenantId: req.tenantId,
      fromUnitId,
      toUnitId,
      factor: numericFactor,
      productId: productId || null,
    });
    res.status(201).json(conversion);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Cette conversion existe déjà.' });
    res.status(500).json({ message: error.message });
  }
};

exports.deleteConversion = async (req, res) => {
  try {
    const conversion = await UnitConversion.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!conversion) return res.status(404).json({ message: 'Conversion introuvable.' });
    await UnitConversion.deleteOne({ _id: conversion._id });
    res.json({ message: 'Conversion supprimée.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
