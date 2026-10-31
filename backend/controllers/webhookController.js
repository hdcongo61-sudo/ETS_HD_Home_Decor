const asyncHandler = require('express-async-handler');
const Webhook = require('../models/webhookModel');
const { tenantFilter } = require('../utils/tenantQuery');
const { VALID_EVENTS } = require('../services/webhookService');

const isHttpUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const sanitizeWebhook = (webhook) => {
  const doc = webhook?.toObject ? webhook.toObject() : webhook || {};
  return {
    _id: doc._id?.toString?.() || doc._id,
    tenantId: doc.tenantId?.toString?.() || doc.tenantId,
    url: doc.url,
    events: doc.events || [],
    active: doc.active,
    lastStatus: doc.lastStatus,
    lastAttemptAt: doc.lastAttemptAt,
    createdAt: doc.createdAt,
  };
};

// @desc    Liste des webhooks de la boutique
// @route   GET /api/v2/webhooks
const listWebhooks = asyncHandler(async (req, res) => {
  const webhooks = await Webhook.find(tenantFilter(req)).sort({ createdAt: -1 }).lean();
  res.json(webhooks.map(sanitizeWebhook));
});

// @desc    Enregistrer un webhook
// @route   POST /api/v2/webhooks
const createWebhook = asyncHandler(async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (!isHttpUrl(url)) {
    return res.status(400).json({ message: "URL invalide (doit commencer par http:// ou https://)." });
  }

  const events = Array.isArray(req.body.events)
    ? req.body.events.filter((event) => VALID_EVENTS.includes(event))
    : ['sale.created'];
  if (events.length === 0) {
    return res.status(400).json({ message: 'Aucun événement valide sélectionné.' });
  }

  const webhook = await Webhook.create({
    tenantId: req.tenantId || null,
    url,
    events,
    secret: String(req.body.secret || ''),
    active: req.body.active !== false,
    createdBy: req.user ? req.user._id : null,
  });

  res.status(201).json(sanitizeWebhook(webhook));
});

// @desc    Supprimer un webhook
// @route   DELETE /api/v2/webhooks/:id
const deleteWebhook = asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOneAndDelete({ ...tenantFilter(req), _id: req.params.id });
  if (!webhook) {
    return res.status(404).json({ message: 'Webhook non trouvé' });
  }
  res.json({ message: 'Webhook supprimé' });
});

module.exports = { listWebhooks, createWebhook, deleteWebhook };
