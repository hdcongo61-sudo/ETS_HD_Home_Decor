const asyncHandler = require('express-async-handler');
const Promotion = require('../models/promotionModel');
const { tenantFilter } = require('../utils/tenantQuery');

const roundMoney = (value) => Math.round(Number(value) || 0);

const normalizePromotionInput = (body = {}) => {
  const type = body.type === 'amount' ? 'amount' : 'percent';
  const value = Number(body.value);
  return {
    code: String(body.code || '').trim().toUpperCase().slice(0, 24),
    label: String(body.label || '').trim().slice(0, 80),
    type,
    value: Number.isFinite(value) && value >= 0 ? value : 0,
    scope: 'all',
    active: body.active !== false,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    maxUses: body.maxUses ? Math.max(0, Number(body.maxUses)) : null,
  };
};

const sanitizePromotion = (promotion) => {
  const doc = promotion?.toObject ? promotion.toObject() : promotion || {};
  return {
    ...doc,
    _id: doc._id?.toString?.() || doc._id,
    tenantId: doc.tenantId?.toString?.() || doc.tenantId,
    createdBy: doc.createdBy?.toString?.() || doc.createdBy,
  };
};

// @desc    Liste des promotions
// @route   GET /api/promotions
// @access  Private/Admin
const getPromotions = asyncHandler(async (req, res) => {
  const promotions = await Promotion.find(tenantFilter(req)).sort({ createdAt: -1 }).lean();
  res.json(promotions.map(sanitizePromotion));
});

// @desc    Créer une promotion
// @route   POST /api/promotions
// @access  Private/Admin
const createPromotion = asyncHandler(async (req, res) => {
  const input = normalizePromotionInput(req.body);
  if (!input.code) {
    return res.status(400).json({ message: 'Le code est requis' });
  }
  if (input.value <= 0) {
    return res.status(400).json({ message: 'La valeur de la remise doit être positive' });
  }

  const promotion = await Promotion.create({
    tenantId: req.tenantId || null,
    ...input,
    createdBy: req.user ? req.user._id : null,
  });
  res.status(201).json(sanitizePromotion(promotion));
});

// @desc    Modifier une promotion
// @route   PUT /api/promotions/:id
// @access  Private/Admin
const updatePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!promotion) {
    return res.status(404).json({ message: 'Promotion non trouvée' });
  }
  const input = normalizePromotionInput(req.body);
  if (!input.code) {
    return res.status(400).json({ message: 'Le code est requis' });
  }
  Object.assign(promotion, input);
  await promotion.save();
  res.json(sanitizePromotion(promotion));
});

// @desc    Supprimer une promotion
// @route   DELETE /api/promotions/:id
// @access  Private/Admin
const deletePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findOneAndDelete({ ...tenantFilter(req), _id: req.params.id });
  if (!promotion) {
    return res.status(404).json({ message: 'Promotion non trouvée' });
  }
  res.json({ message: 'Promotion supprimée' });
});

// @desc    Appliquer un code promo à un sous-total (aperçu)
// @route   POST /api/promotions/apply
// @access  Private
const applyPromotion = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const subtotal = Number(req.body.subtotal);
  if (!code) {
    return res.status(400).json({ message: 'Code promo requis' });
  }
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ message: 'Sous-total invalide' });
  }

  const promotion = await Promotion.findOne({ ...tenantFilter(req), code });
  if (!promotion) {
    return res.status(404).json({ message: 'Code promo inconnu' });
  }
  if (!promotion.active) {
    return res.status(400).json({ message: 'Ce code promo est désactivé' });
  }
  const now = new Date();
  if (promotion.startsAt && now < promotion.startsAt) {
    return res.status(400).json({ message: 'Ce code promo n’est pas encore valide' });
  }
  if (promotion.endsAt && now > promotion.endsAt) {
    return res.status(400).json({ message: 'Ce code promo a expiré' });
  }
  if (promotion.maxUses != null && promotion.usesCount >= promotion.maxUses) {
    return res.status(400).json({ message: 'Ce code promo a atteint sa limite d’utilisation' });
  }

  let discountAmount;
  if (promotion.type === 'amount') {
    discountAmount = Math.min(promotion.value, subtotal);
  } else {
    discountAmount = (subtotal * promotion.value) / 100;
  }
  discountAmount = roundMoney(discountAmount);
  const newTotal = roundMoney(Math.max(0, subtotal - discountAmount));

  res.json({
    promotion: sanitizePromotion(promotion),
    discountAmount,
    newTotal,
  });
});

module.exports = {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  applyPromotion,
};
