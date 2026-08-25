const Location = require('../models/locationModel');
const { tenantFilter } = require('../utils/tenantQuery');

// @desc    Liste des boutiques/entrepôts de l'organisation
// @route   GET /api/locations
// @access  Private (tenant)
exports.getLocations = async (req, res) => {
  try {
    const locations = await Location.find(tenantFilter(req)).sort({ name: 1 }).lean();
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer une boutique/entrepôt
// @route   POST /api/locations
// @access  Admin (tenant)
exports.createLocation = async (req, res) => {
  try {
    const { name, code, type, address, isSalesLocation, isStockLocation, isActive } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!cleanName || !cleanCode) {
      return res.status(400).json({ message: 'Nom et code de la boutique sont requis.' });
    }
    if (!['store', 'warehouse', 'office', 'transit'].includes(type || 'store')) {
      return res.status(400).json({ message: 'Type de boutique invalide.' });
    }
    const location = await Location.create({
      tenantId: req.tenantId,
      name: cleanName,
      code: cleanCode,
      type: type || 'store',
      address: typeof address === 'string' ? address.trim() : '',
      isSalesLocation: isSalesLocation !== false,
      isStockLocation: isStockLocation !== false,
      isActive: isActive !== false,
      createdBy: req.user ? req.user._id : null,
    });
    res.status(201).json(location);
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'Une boutique avec ce nom ou ce code existe déjà.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier une boutique/entrepôt
// @route   PUT /api/locations/:id
// @access  Admin (tenant)
exports.updateLocation = async (req, res) => {
  try {
    const location = await Location.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!location) return res.status(404).json({ message: 'Boutique introuvable.' });

    const { name, code, type, address, isSalesLocation, isStockLocation, isActive } = req.body || {};
    if (name !== undefined) location.name = String(name).trim();
    if (code !== undefined) location.code = String(code).trim().toUpperCase();
    if (type !== undefined) {
      if (!['store', 'warehouse', 'office', 'transit'].includes(type)) {
        return res.status(400).json({ message: 'Type de boutique invalide.' });
      }
      location.type = type;
    }
    if (address !== undefined) location.address = String(address).trim();
    if (isSalesLocation !== undefined) location.isSalesLocation = Boolean(isSalesLocation);
    if (isStockLocation !== undefined) location.isStockLocation = Boolean(isStockLocation);
    if (isActive !== undefined) location.isActive = Boolean(isActive);

    await location.save();
    res.json(location);
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'Une boutique avec ce nom ou ce code existe déjà.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer une boutique/entrepôt (sans données liées pour l'instant)
// @route   DELETE /api/locations/:id
// @access  Admin (tenant)
exports.deleteLocation = async (req, res) => {
  try {
    const location = await Location.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!location) return res.status(404).json({ message: 'Boutique introuvable.' });
    await Location.deleteOne({ _id: location._id });
    res.json({ message: 'Boutique supprimée.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
