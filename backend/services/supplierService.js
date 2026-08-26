/**
 * SupplierService — fournisseurs et références d'achat (Phases 6.1-6.2).
 */
const Supplier = require('../models/supplierModel');
const SupplierProduct = require('../models/supplierProductModel');
const Product = require('../models/productModel');
const Location = require('../models/locationModel');
// Enregistre le modèle pour le populate de `purchaseUnitId`.
require('../models/unitOfMeasureModel');

const normalizeName = (name) =>
  String(name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

const isDuplicateKey = (error) => error && error.code === 11000;

async function createSupplier({ tenantId, data, userId = null }) {
  const name = String(data.name || '').trim();
  if (!name) throw badRequest('Le nom du fournisseur est requis.');

  try {
    return await Supplier.create({
      tenantId,
      name,
      normalizedName: normalizeName(name),
      code: String(data.code || '').trim().toUpperCase(),
      legalName: String(data.legalName || '').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim().toLowerCase(),
      contacts: Array.isArray(data.contacts) ? data.contacts : [],
      addresses: Array.isArray(data.addresses) ? data.addresses : [],
      currency: String(data.currency || 'XOF').toUpperCase(),
      paymentTerms: String(data.paymentTerms || '').trim(),
      leadTimeDays: Number(data.leadTimeDays) || 0,
      taxId: String(data.taxId || '').trim(),
      status: data.status === 'inactive' ? 'inactive' : 'active',
      notes: String(data.notes || '').trim(),
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('Un fournisseur portant ce nom existe déjà dans cette organisation.');
    throw error;
  }
}

async function updateSupplier({ tenantId, supplierId, data, userId = null }) {
  const supplier = await Supplier.findOne({ tenantId, _id: supplierId });
  if (!supplier) throw notFound('Fournisseur introuvable dans cette organisation.');

  const patch = {};
  const allowed = [
    'name', 'code', 'legalName', 'phone', 'email', 'contacts', 'addresses',
    'currency', 'paymentTerms', 'leadTimeDays', 'taxId', 'status', 'notes',
  ];
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    if (['name', 'code', 'legalName', 'phone', 'taxId', 'notes', 'paymentTerms'].includes(key)) {
      patch[key] = String(data[key]).trim();
    } else if (key === 'email') {
      patch[key] = String(data[key]).trim().toLowerCase();
    } else if (key === 'currency') {
      patch[key] = String(data[key]).toUpperCase();
    } else if (key === 'leadTimeDays') {
      patch[key] = Number(data[key]) || 0;
    } else if (key === 'status') {
      patch[key] = data[key] === 'inactive' ? 'inactive' : 'active';
    } else {
      patch[key] = data[key];
    }
  }
  if (patch.name !== undefined) patch.normalizedName = normalizeName(patch.name);
  patch.updatedBy = userId;

  try {
    Object.assign(supplier, patch);
    await supplier.save();
    return supplier;
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('Un fournisseur portant ce nom existe déjà dans cette organisation.');
    throw error;
  }
}

async function createSupplierProduct({ tenantId, data, userId = null }) {
  const supplier = await Supplier.findOne({ tenantId, _id: data.supplierId }).select('_id').lean();
  if (!supplier) throw conflict('Fournisseur introuvable dans cette organisation.');
  const product = await Product.findOne({ tenantId, _id: data.productId }).select('_id').lean();
  if (!product) throw conflict('Produit introuvable dans cette organisation.');

  try {
    return await SupplierProduct.create({
      tenantId,
      supplierId: data.supplierId,
      productId: data.productId,
      variantId: data.variantId || null,
      supplierSku: String(data.supplierSku || '').trim(),
      purchaseUnitId: data.purchaseUnitId || null,
      conversionToBase: Number(data.conversionToBase) || 1,
      lastCost: Number(data.lastCost) || 0,
      currency: String(data.currency || 'XOF').toUpperCase(),
      minimumOrderQuantity: Math.max(1, Number(data.minimumOrderQuantity) || 1),
      leadTimeDays: Number(data.leadTimeDays) || 0,
      preferred: Boolean(data.preferred),
      active: data.active === false ? false : true,
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('Cette référence d\'achat existe déjà.');
    throw error;
  }
}

async function updateSupplierProduct({ tenantId, supplierProductId, data, userId = null }) {
  const link = await SupplierProduct.findOne({ tenantId, _id: supplierProductId });
  if (!link) throw notFound('Référence d\'achat introuvable dans cette organisation.');

  const patch = { updatedBy: userId };
  const stringKeys = ['supplierSku', 'currency'];
  const numberKeys = ['lastCost', 'conversionToBase', 'minimumOrderQuantity', 'leadTimeDays'];
  const boolKeys = ['preferred', 'active'];
  for (const key of stringKeys) {
    if (data[key] !== undefined) patch[key] = key === 'currency' ? String(data[key]).toUpperCase() : String(data[key]).trim();
  }
  for (const key of numberKeys) {
    if (data[key] !== undefined) patch[key] = Number(data[key]) || 0;
  }
  for (const key of boolKeys) {
    if (data[key] !== undefined) patch[key] = Boolean(data[key]);
  }
  if (data.purchaseUnitId !== undefined) patch.purchaseUnitId = data.purchaseUnitId || null;
  if (data.variantId !== undefined) patch.variantId = data.variantId || null;

  Object.assign(link, patch);
  await link.save();
  return link;
}

async function deleteSupplierProduct({ tenantId, supplierProductId }) {
  const link = await SupplierProduct.findOne({ tenantId, _id: supplierProductId });
  if (!link) throw notFound('Référence d\'achat introuvable dans cette organisation.');
  await SupplierProduct.deleteOne({ _id: link._id });
  return { deleted: true };
}

async function listSupplierProducts({ tenantId, supplierId = null, productId = null }) {
  const filter = { tenantId };
  if (supplierId) filter.supplierId = supplierId;
  if (productId) filter.productId = productId;
  return SupplierProduct.find(filter)
    .populate('supplierId', 'name code')
    .populate('productId', 'name sku')
    .populate('purchaseUnitId', 'name symbol key')
    .sort({ preferred: -1, updatedAt: -1 })
    .lean();
}

module.exports = {
  createSupplier, updateSupplier,
  createSupplierProduct, updateSupplierProduct, deleteSupplierProduct, listSupplierProducts,
};
