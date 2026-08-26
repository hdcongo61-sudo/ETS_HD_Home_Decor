/**
 * supplierController — fournisseurs et références d'achat (Phases 6.1-6.2).
 */
const asyncHandler = require('express-async-handler');
const Supplier = require('../models/supplierModel');
const supplierService = require('../services/supplierService');

const asyncRoute = (fn) => asyncHandler(fn);

// @route   GET /api/v2/suppliers
const getSuppliers = asyncRoute(async (req, res) => {
  const { status, search } = req.query;
  const filter = { tenantId: req.tenantId };
  if (status) filter.status = status;
  if (search) filter.name = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean();
  res.json(suppliers);
});

// @route   GET /api/v2/suppliers/:id
const getSupplier = asyncRoute(async (req, res) => {
  const supplier = await Supplier.findOne({ tenantId: req.tenantId, _id: req.params.id }).lean();
  if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable dans cette organisation.' });
  res.json(supplier);
});

// @route   POST /api/v2/suppliers
const createSupplier = asyncRoute(async (req, res) => {
  const supplier = await supplierService.createSupplier({
    tenantId: req.tenantId,
    data: req.body,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(supplier);
});

// @route   PUT /api/v2/suppliers/:id
const updateSupplier = asyncRoute(async (req, res) => {
  const supplier = await supplierService.updateSupplier({
    tenantId: req.tenantId,
    supplierId: req.params.id,
    data: req.body,
    userId: req.user ? req.user._id : null,
  });
  res.json(supplier);
});

// @route   GET /api/v2/supplier-products
const getSupplierProducts = asyncRoute(async (req, res) => {
  const links = await supplierService.listSupplierProducts({
    tenantId: req.tenantId,
    supplierId: req.query.supplierId || null,
    productId: req.query.productId || null,
  });
  res.json(links);
});

// @route   POST /api/v2/supplier-products
const createSupplierProduct = asyncRoute(async (req, res) => {
  const link = await supplierService.createSupplierProduct({
    tenantId: req.tenantId,
    data: req.body,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(link);
});

// @route   PUT /api/v2/supplier-products/:id
const updateSupplierProduct = asyncRoute(async (req, res) => {
  const link = await supplierService.updateSupplierProduct({
    tenantId: req.tenantId,
    supplierProductId: req.params.id,
    data: req.body,
    userId: req.user ? req.user._id : null,
  });
  res.json(link);
});

// @route   DELETE /api/v2/supplier-products/:id
const deleteSupplierProduct = asyncRoute(async (req, res) => {
  const result = await supplierService.deleteSupplierProduct({
    tenantId: req.tenantId,
    supplierProductId: req.params.id,
  });
  res.json(result);
});

module.exports = {
  getSuppliers, getSupplier, createSupplier, updateSupplier,
  getSupplierProducts, createSupplierProduct, updateSupplierProduct, deleteSupplierProduct,
};
