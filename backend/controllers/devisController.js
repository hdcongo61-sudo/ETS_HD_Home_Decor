const asyncHandler = require('express-async-handler');
const Devis = require('../models/devisModel');
const Proforma = require('../models/proformaModel');
const Product = require('../models/productModel');
const Client = require('../models/clientModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

const populateDevis = (query) =>
  query
    .populate('client', 'name email phone')
    .populate('products.product', 'name price stock image container warehouse')
    .populate('createdBy', 'name email')
    .populate('convertedProforma', '_id reference totalAmount status');

const buildReference = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = `${String(now.getTime()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  return `DEV-${date}-${suffix}`;
};

// Un devis draft/sent dont la validité est dépassée est considéré expiré
// (dérivé, pas stocké : l'état source reste modifiable tant qu'il n'est pas
// accepté/rejeté/converti).
const isExpired = (devis) =>
  ['draft', 'sent'].includes(devis.status) &&
  devis.validUntil &&
  new Date(devis.validUntil).getTime() < Date.now();

const withDerivedStatus = (devis) => {
  if (!devis) return devis;
  const doc = devis.toObject ? devis.toObject() : { ...devis };
  if (isExpired(doc)) doc.derivedExpired = true;
  return doc;
};

const normalizeProducts = async (req, products) => {
  if (!Array.isArray(products) || products.length === 0) {
    const error = new Error('Ajoutez au moins un produit au devis.');
    error.statusCode = 400;
    throw error;
  }

  const requested = products.map((item) => ({
    productId: String(item.product?._id || item.product || ''),
    quantity: Number(item.quantity),
    price: Number(item.price),
  }));
  const ids = [...new Set(requested.map((item) => item.productId).filter(Boolean))];
  const productDocuments = await Product.find({ ...tenantFilter(req), _id: { $in: ids } })
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

const getDevis = asyncHandler(async (req, res) => {
  const devis = await populateDevis(Devis.find(tenantFilter(req)).sort({ createdAt: -1 })).lean();
  res.json(devis.map(withDerivedStatus));
});

const getDevisById = asyncHandler(async (req, res) => {
  const devis = await populateDevis(Devis.findOne({ ...tenantFilter(req), _id: req.params.id })).lean();
  if (!devis) return res.status(404).json({ message: 'Devis introuvable.' });
  res.json(withDerivedStatus(devis));
});

const createDevis = asyncHandler(async (req, res) => {
  try {
    const client = await validateClient(req, req.body.client);
    const products = await normalizeProducts(req, req.body.products);
    const validUntil = new Date(req.body.validUntil);
    if (Number.isNaN(validUntil.getTime())) {
      return res.status(400).json({ message: 'Date de validité invalide.' });
    }

    const totalAmount = products.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const created = await Devis.create(
      applyTenant(req, {
        reference: buildReference(),
        locationId: req.locationId || null,
        client,
        products,
        totalAmount,
        note: String(req.body.note || '').trim(),
        validUntil,
        createdBy: req.user._id,
      })
    );
    const devis = await populateDevis(Devis.findById(created._id)).lean();
    res.status(201).json(withDerivedStatus(devis));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

const updateDevis = asyncHandler(async (req, res) => {
  try {
    const devis = await Devis.findOne({ ...tenantFilter(req), _id: req.params.id });
    if (!devis) return res.status(404).json({ message: 'Devis introuvable.' });
    if (!['draft', 'sent'].includes(devis.status)) {
      return res.status(400).json({ message: 'Seul un devis non converti peut être modifié.' });
    }

    if (req.body.client !== undefined) {
      devis.client = await validateClient(req, req.body.client);
    }
    if (req.body.products !== undefined) {
      devis.products = await normalizeProducts(req, req.body.products);
      devis.totalAmount = devis.products.reduce((sum, item) => sum + item.quantity * item.price, 0);
    }
    if (req.body.note !== undefined) devis.note = String(req.body.note || '').trim();
    if (req.body.validUntil !== undefined) {
      const validUntil = new Date(req.body.validUntil);
      if (Number.isNaN(validUntil.getTime())) {
        return res.status(400).json({ message: 'Date de validité invalide.' });
      }
      devis.validUntil = validUntil;
    }

    await devis.save();
    const updated = await populateDevis(Devis.findById(devis._id)).lean();
    res.json(withDerivedStatus(updated));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// Transitions d'état autorisées (pas de retour arrière après acceptation).
const ALLOWED_TRANSITIONS = {
  draft: ['sent', 'accepted', 'rejected', 'cancelled'],
  sent: ['accepted', 'rejected', 'cancelled'],
  accepted: [],
  rejected: [],
  converted: [],
  expired: [],
};

const updateStatus = asyncHandler(async (req, res) => {
  const devis = await Devis.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!devis) return res.status(404).json({ message: 'Devis introuvable.' });

  const next = String(req.body.status || '').trim();
  if (!ALLOWED_TRANSITIONS[devis.status]?.includes(next)) {
    return res.status(400).json({
      message: `Transition invalide (${devis.status} → ${next}).`,
    });
  }

  devis.status = next;
  if (next === 'converted') devis.convertedAt = new Date();
  await devis.save();

  const updated = await populateDevis(Devis.findById(devis._id)).lean();
  res.json(withDerivedStatus(updated));
});

// Convertit un devis accepté en facture proforma (prochaine étape du pipeline).
const convertToProforma = asyncHandler(async (req, res) => {
  const devis = await Devis.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!devis) return res.status(404).json({ message: 'Devis introuvable.' });
  if (devis.status === 'converted') {
    return res.status(400).json({ message: 'Ce devis a déjà été converti.' });
  }
  if (devis.status !== 'accepted') {
    return res.status(400).json({ message: 'Un devis doit être accepté avant conversion.' });
  }

  const validUntil = new Date(devis.validUntil);
  if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() < Date.now()) {
    // Validité dépassée : on prolonge la proforma de 15 jours pour ne pas
    // bloquer la conversion.
    validUntil.setTime(Date.now() + 15 * 24 * 60 * 60 * 1000);
  }

  const proforma = await Proforma.create(
    applyTenant(req, {
      reference: `PRO-${devis.reference.slice(4)}`,
      locationId: devis.locationId || null,
      client: devis.client,
      products: devis.products.map((item) => ({
        product: item.product,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount: devis.totalAmount,
      note: devis.note,
      validUntil,
      status: 'draft',
      createdBy: req.user._id,
    })
  );

  devis.status = 'converted';
  devis.convertedProforma = proforma._id;
  devis.convertedAt = new Date();
  await devis.save();

  const updated = await populateDevis(Devis.findById(devis._id)).lean();
  res.status(201).json({ devis: withDerivedStatus(updated), proforma });
});

const deleteDevis = asyncHandler(async (req, res) => {
  const devis = await Devis.findOne({ ...tenantFilter(req), _id: req.params.id });
  if (!devis) return res.status(404).json({ message: 'Devis introuvable.' });
  if (devis.status === 'converted') {
    return res.status(400).json({ message: 'Un devis converti ne peut pas être supprimé.' });
  }
  await devis.deleteOne();
  res.json({ message: 'Devis supprimé.' });
});

module.exports = {
  getDevis,
  getDevisById,
  createDevis,
  updateDevis,
  updateStatus,
  convertToProforma,
  deleteDevis,
};
