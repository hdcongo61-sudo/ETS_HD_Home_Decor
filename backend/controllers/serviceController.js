const asyncHandler = require('express-async-handler');
const Service = require('../models/serviceModel');
const { tenantFilter } = require('../utils/tenantQuery');

const sanitizeService = (service) => {
  const doc = service?.toObject ? service.toObject() : service || {};
  return {
    ...doc,
    _id: doc._id?.toString?.() || doc._id,
    tenantId: doc.tenantId?.toString?.() || doc.tenantId,
    createdBy: doc.createdBy?.toString?.() || doc.createdBy,
  };
};

// @desc    Liste des services
// @route   GET /api/services
const getServices = asyncHandler(async (req, res) => {
  const services = await Service.find(tenantFilter(req)).sort({ name: 1 }).lean();
  res.json(services.map(sanitizeService));
});

// @desc    Créer un service
// @route   POST /api/services
const createService = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ message: 'Le nom du service est requis' });
  }
  const price = Number(req.body.price);
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ message: 'Prix invalide' });
  }

  const service = await Service.create({
    tenantId: req.tenantId || null,
    name: name.slice(0, 120),
    description: String(req.body.description || '').trim().slice(0, 500),
    price,
    category: String(req.body.category || '').trim().slice(0, 60),
    durationMinutes: req.body.durationMinutes ? Math.max(0, Number(req.body.durationMinutes)) : null,
    active: req.body.active !== false,
    createdBy: req.user ? req.user._id : null,
  });

  res.status(201).json(sanitizeService(service));
});

// @desc    Modifier un service
// @route   PUT /api/services/:id
const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!service) {
    return res.status(404).json({ message: 'Service non trouvé' });
  }

  if (req.body.name !== undefined) service.name = String(req.body.name).trim().slice(0, 120);
  if (req.body.description !== undefined) service.description = String(req.body.description).trim().slice(0, 500);
  if (req.body.price !== undefined) {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'Prix invalide' });
    }
    service.price = price;
  }
  if (req.body.category !== undefined) service.category = String(req.body.category).trim().slice(0, 60);
  if (req.body.durationMinutes !== undefined) {
    service.durationMinutes = req.body.durationMinutes ? Math.max(0, Number(req.body.durationMinutes)) : null;
  }
  if (req.body.active !== undefined) service.active = Boolean(req.body.active);

  await service.save();
  res.json(sanitizeService(service));
});

// @desc    Supprimer un service
// @route   DELETE /api/services/:id
const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findOneAndDelete({ ...tenantFilter(req), _id: req.params.id });
  if (!service) {
    return res.status(404).json({ message: 'Service non trouvé' });
  }
  res.json({ message: 'Service supprimé' });
});

module.exports = { getServices, createService, updateService, deleteService };
