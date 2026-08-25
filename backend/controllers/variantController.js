const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');
const AttributeDefinition = require('../models/attributeDefinitionModel');
const { tenantFilter } = require('../utils/tenantQuery');

// Vérifie que les clés d'optionValues correspondent à des attributs variantAxis.
const validateOptionKeys = async (tenantId, optionValues = {}) => {
  const keys = Object.keys(optionValues || {});
  if (keys.length === 0) return { error: null, axes: {} };
  const defs = await AttributeDefinition.find({ tenantId, key: { $in: keys }, variantAxis: true }).lean();
  const known = new Map(defs.map((d) => [d.key, d]));
  for (const key of keys) {
    if (!known.has(key)) {
      return { error: `Attribut de variante inconnu ou non marqué variantAxis : ${key}`, axes: null };
    }
    const value = String(optionValues[key] || '').trim();
    if (!value) {
      return { error: `Valeur manquante pour l’attribut ${key}`, axes: null };
    }
    const def = known.get(key);
    if ((def.dataType === 'select' || def.dataType === 'multiselect') && def.options.length > 0 && !def.options.includes(value)) {
      return { error: `Valeur « ${value} » invalide pour ${def.label}`, axes: null };
    }
  }
  return { error: null, axes: known };
};

// @desc    Variantes d'un produit
// @route   GET /api/variants?productId=...
exports.getVariants = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) return res.status(400).json({ message: 'productId requis.' });
    const product = await Product.findOne({ ...tenantFilter(req), _id: productId }).select('_id').lean();
    if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
    const variants = await ProductVariant.find({ ...tenantFilter(req), productId }).sort({ createdAt: 1 }).lean();
    res.json(variants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer une variante
// @route   POST /api/variants
exports.createVariant = async (req, res) => {
  try {
    const { productId, sku, optionValues, barcodes, status, isDefault } = req.body || {};
    const product = await Product.findOne({ ...tenantFilter(req), _id: productId }).select('_id sku').lean();
    if (!product) return res.status(404).json({ message: 'Produit introuvable.' });

    const { error: keysError } = await validateOptionKeys(req.tenantId, optionValues);
    if (keysError) return res.status(400).json({ message: keysError });

    const cleanBarcodes = Array.isArray(barcodes)
      ? [...new Set(barcodes.map((b) => String(b).trim()).filter(Boolean))]
      : [];

    let variant;
    try {
      variant = await ProductVariant.create({
        tenantId: req.tenantId,
        productId: product._id,
        optionValues: optionValues || {},
        sku: typeof sku === 'string' ? sku.trim().toUpperCase() || undefined : undefined,
        barcodes: cleanBarcodes,
        status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
        isDefault: Boolean(isDefault),
        createdBy: req.user ? req.user._id : null,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'SKU ou variante par défaut en doublon.' });
      }
      throw error;
    }

    // Une seule variante par défaut par produit.
    if (variant.isDefault) {
      await ProductVariant.updateMany(
        { tenantId: req.tenantId, productId: product._id, _id: { $ne: variant._id } },
        { $set: { isDefault: false } }
      );
    }

    res.status(201).json(variant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier une variante
// @route   PUT /api/variants/:id
exports.updateVariant = async (req, res) => {
  try {
    const variant = await ProductVariant.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!variant) return res.status(404).json({ message: 'Variante introuvable.' });

    if (req.body.optionValues !== undefined) {
      const { error: keysError } = await validateOptionKeys(req.tenantId, req.body.optionValues);
      if (keysError) return res.status(400).json({ message: keysError });
      variant.optionValues = req.body.optionValues || {};
    }
    if (req.body.sku !== undefined) variant.sku = String(req.body.sku).trim().toUpperCase() || undefined;
    if (req.body.barcodes !== undefined) {
      variant.barcodes = [...new Set(req.body.barcodes.map((b) => String(b).trim()).filter(Boolean))];
    }
    if (req.body.status !== undefined) {
      if (!['active', 'inactive', 'archived'].includes(req.body.status)) {
        return res.status(400).json({ message: 'Statut invalide.' });
      }
      variant.status = req.body.status;
    }
    if (req.body.isDefault !== undefined) variant.isDefault = Boolean(req.body.isDefault);

    try {
      await variant.save();
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'SKU ou variante par défaut en doublon.' });
      }
      throw error;
    }

    if (variant.isDefault) {
      await ProductVariant.updateMany(
        { tenantId: req.tenantId, productId: variant.productId, _id: { $ne: variant._id } },
        { $set: { isDefault: false } }
      );
    }

    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer une variante (interdit si c'est la dernière du produit)
// @route   DELETE /api/variants/:id
exports.deleteVariant = async (req, res) => {
  try {
    const variant = await ProductVariant.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!variant) return res.status(404).json({ message: 'Variante introuvable.' });
    const count = await ProductVariant.countDocuments({ tenantId: req.tenantId, productId: variant.productId });
    if (count <= 1) {
      return res.status(400).json({ message: 'Impossible de supprimer la dernière variante du produit.' });
    }
    await ProductVariant.deleteOne({ _id: variant._id });
    res.json({ message: 'Variante supprimée.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
