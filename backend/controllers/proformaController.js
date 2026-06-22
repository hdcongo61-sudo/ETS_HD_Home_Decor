const asyncHandler = require('express-async-handler');
const Proforma = require('../models/proformaModel');
const Product = require('../models/productModel');
const Client = require('../models/clientModel');
const Sale = require('../models/saleModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

const populateProforma = (query) =>
  query
    .populate('client', 'name email phone address')
    .populate('products.product', 'name price stock image container warehouse')
    .populate('createdBy', 'name email')
    .populate('convertedSale', '_id saleDate totalAmount status');

const buildReference = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = `${String(now.getTime()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  return `PRO-${date}-${suffix}`;
};

const normalizeProducts = async (req, products) => {
  if (!Array.isArray(products) || products.length === 0) {
    const error = new Error('Ajoutez au moins un produit à la proforma.');
    error.statusCode = 400;
    throw error;
  }

  const requested = products.map((item) => ({
    productId: String(item.product?._id || item.product || ''),
    quantity: Number(item.quantity),
    price: Number(item.price),
  }));
  const ids = [...new Set(requested.map((item) => item.productId).filter(Boolean))];
  const productDocuments = await Product.find({
    ...tenantFilter(req),
    _id: { $in: ids },
  })
    .select('_id name')
    .lean();
  const productMap = new Map(productDocuments.map((product) => [String(product._id), product]));

  return requested.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      const error = new Error('Un produit sélectionné est introuvable.');
      error.statusCode = 404;
      throw error;
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      const error = new Error(`Quantité invalide pour ${product.name}.`);
      error.statusCode = 400;
      throw error;
    }
    if (!Number.isFinite(item.price) || item.price < 0) {
      const error = new Error(`Prix invalide pour ${product.name}.`);
      error.statusCode = 400;
      throw error;
    }
    return {
      product: product._id,
      productName: product.name,
      quantity: item.quantity,
      price: item.price,
    };
  });
};

const validateClient = async (req, clientId) => {
  const client = await Client.findOne({ ...tenantFilter(req), _id: clientId }).select('_id');
  if (!client) {
    const error = new Error('Client introuvable.');
    error.statusCode = 404;
    throw error;
  }
  return client._id;
};

const getProformas = asyncHandler(async (req, res) => {
  const proformas = await populateProforma(
    Proforma.find(tenantFilter(req)).sort({ createdAt: -1 })
  ).lean();
  res.json(proformas);
});

const getProformaById = asyncHandler(async (req, res) => {
  const proforma = await populateProforma(
    Proforma.findOne({ ...tenantFilter(req), _id: req.params.id })
  ).lean();
  if (!proforma) return res.status(404).json({ message: 'Proforma introuvable.' });
  res.json(proforma);
});

const createProforma = asyncHandler(async (req, res) => {
  try {
    const client = await validateClient(req, req.body.client);
    const products = await normalizeProducts(req, req.body.products);
    const validUntil = new Date(req.body.validUntil);
    if (Number.isNaN(validUntil.getTime())) {
      return res.status(400).json({ message: 'Date de validité invalide.' });
    }

    const totalAmount = products.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const created = await Proforma.create(
      applyTenant(req, {
        reference: buildReference(),
        client,
        products,
        totalAmount,
        note: String(req.body.note || '').trim(),
        validUntil,
        createdBy: req.user._id,
      })
    );
    const proforma = await populateProforma(Proforma.findById(created._id)).lean();
    res.status(201).json(proforma);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

const updateProforma = asyncHandler(async (req, res) => {
  try {
    const proforma = await Proforma.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!proforma) return res.status(404).json({ message: 'Proforma introuvable.' });
    if (proforma.status === 'converted') {
      return res.status(400).json({ message: 'Une proforma convertie ne peut plus être modifiée.' });
    }

    if (req.body.client !== undefined) {
      proforma.client = await validateClient(req, req.body.client);
    }
    if (req.body.products !== undefined) {
      proforma.products = await normalizeProducts(req, req.body.products);
      proforma.totalAmount = proforma.products.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );
    }
    if (req.body.note !== undefined) proforma.note = String(req.body.note || '').trim();
    if (req.body.validUntil !== undefined) {
      const validUntil = new Date(req.body.validUntil);
      if (Number.isNaN(validUntil.getTime())) {
        return res.status(400).json({ message: 'Date de validité invalide.' });
      }
      proforma.validUntil = validUntil;
    }
    if (['draft', 'sent', 'cancelled'].includes(req.body.status)) {
      proforma.status = req.body.status;
    }

    await proforma.save();
    const updated = await populateProforma(Proforma.findById(proforma._id)).lean();
    res.json(updated);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

const markProformaConverted = asyncHandler(async (req, res) => {
  const proforma = await Proforma.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!proforma) return res.status(404).json({ message: 'Proforma introuvable.' });
  if (proforma.status === 'converted') {
    return res.status(400).json({ message: 'Cette proforma a déjà été convertie.' });
  }

  const sale = await Sale.findOne({ ...tenantFilter(req), _id: req.body.saleId }).select('_id');
  if (!sale) return res.status(404).json({ message: 'Vente convertie introuvable.' });

  proforma.status = 'converted';
  proforma.convertedSale = sale._id;
  proforma.convertedAt = new Date();
  await proforma.save();

  const updated = await populateProforma(Proforma.findById(proforma._id)).lean();
  res.json(updated);
});

const deleteProforma = asyncHandler(async (req, res) => {
  const proforma = await Proforma.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!proforma) return res.status(404).json({ message: 'Proforma introuvable.' });
  if (proforma.status === 'converted') {
    return res.status(400).json({ message: 'Une proforma convertie ne peut pas être supprimée.' });
  }
  await proforma.deleteOne();
  res.json({ message: 'Proforma supprimée.' });
});

module.exports = {
  getProformas,
  getProformaById,
  createProforma,
  updateProforma,
  markProformaConverted,
  deleteProforma,
};
