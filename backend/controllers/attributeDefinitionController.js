const AttributeDefinition = require('../models/attributeDefinitionModel');
const { tenantFilter } = require('../utils/tenantQuery');

const normalizeOptions = (options) => {
  if (!Array.isArray(options)) return [];
  return [...new Set(options.map((o) => String(o).trim()).filter(Boolean))];
};

const validatePayload = (body = {}) => {
  const errors = [];
  const key = typeof body.key === 'string' ? body.key.trim().toLowerCase() : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const dataType = body.dataType || 'text';
  if (!key) errors.push('La clé de l’attribut est requise.');
  if (!/^[a-z0-9_-]{2,64}$/.test(key)) errors.push('Clé invalide (lettres minuscules, chiffres, - et _).');
  if (!label) errors.push('Le libellé de l’attribut est requis.');
  if (!['text', 'number', 'boolean', 'date', 'select', 'multiselect'].includes(dataType)) {
    errors.push('Type de données invalide.');
  }
  const options = normalizeOptions(body.options);
  if ((dataType === 'select' || dataType === 'multiselect') && options.length === 0) {
    errors.push('Les attributs select/multiselect exigent au moins une option.');
  }
  return { errors, key, label, dataType, options };
};

// @desc    Liste des attributs de l'organisation
// @route   GET /api/attribute-definitions
exports.getAttributeDefinitions = async (req, res) => {
  try {
    const items = await AttributeDefinition.find(tenantFilter(req)).sort({ sortOrder: 1, label: 1 }).lean();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer un attribut
// @route   POST /api/attribute-definitions
exports.createAttributeDefinition = async (req, res) => {
  try {
    const { errors, key, label, dataType, options } = validatePayload(req.body);
    if (errors.length) return res.status(400).json({ message: errors.join(' ') });

    const item = await AttributeDefinition.create({
      tenantId: req.tenantId,
      key,
      label,
      dataType,
      options,
      unitId: req.body.unitId || null,
      required: Boolean(req.body.required),
      searchable: Boolean(req.body.searchable),
      filterable: Boolean(req.body.filterable),
      variantAxis: Boolean(req.body.variantAxis),
      appliesToCategoryIds: Array.isArray(req.body.appliesToCategoryIds) ? req.body.appliesToCategoryIds : [],
      sortOrder: Number(req.body.sortOrder) || 0,
      isActive: req.body.isActive !== false,
      createdBy: req.user ? req.user._id : null,
    });
    res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Une définition avec cette clé existe déjà.' });
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier un attribut
// @route   PUT /api/attribute-definitions/:id
exports.updateAttributeDefinition = async (req, res) => {
  try {
    const existing = await AttributeDefinition.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!existing) return res.status(404).json({ message: 'Attribut introuvable.' });

    const { errors, key, label, dataType, options } = validatePayload({ ...existing.toObject(), ...req.body });
    if (errors.length) return res.status(400).json({ message: errors.join(' ') });

    existing.key = key;
    existing.label = label;
    existing.dataType = dataType;
    existing.options = options;
    if (req.body.unitId !== undefined) existing.unitId = req.body.unitId || null;
    if (req.body.required !== undefined) existing.required = Boolean(req.body.required);
    if (req.body.searchable !== undefined) existing.searchable = Boolean(req.body.searchable);
    if (req.body.filterable !== undefined) existing.filterable = Boolean(req.body.filterable);
    if (req.body.variantAxis !== undefined) existing.variantAxis = Boolean(req.body.variantAxis);
    if (req.body.appliesToCategoryIds !== undefined) existing.appliesToCategoryIds = Array.isArray(req.body.appliesToCategoryIds) ? req.body.appliesToCategoryIds : [];
    if (req.body.sortOrder !== undefined) existing.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.isActive !== undefined) existing.isActive = Boolean(req.body.isActive);

    await existing.save();
    res.json(existing);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Une définition avec cette clé existe déjà.' });
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer un attribut
// @route   DELETE /api/attribute-definitions/:id
exports.deleteAttributeDefinition = async (req, res) => {
  try {
    const existing = await AttributeDefinition.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!existing) return res.status(404).json({ message: 'Attribut introuvable.' });
    await AttributeDefinition.deleteOne({ _id: existing._id });
    res.json({ message: 'Attribut supprimé.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
