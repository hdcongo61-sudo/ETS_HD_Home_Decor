/**
 * importController — imports en étapes (Phase 7.8).
 */
const asyncHandler = require('express-async-handler');
const importService = require('../services/importService');

// @route   POST /api/v2/imports/products
const uploadProducts = asyncHandler(async (req, res) => {
  const job = await importService.uploadProducts({
    tenantId: req.tenantId,
    rows: req.body.rows || null,
    csv: req.body.csv || null,
    fileName: req.body.fileName || '',
    requesterId: req.user ? req.user._id : null,
  });
  res.status(201).json(job);
});

// @route   GET /api/v2/imports
const listImports = asyncHandler(async (req, res) => {
  const result = await importService.listImports({
    tenantId: req.tenantId,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(result);
});

// @route   GET /api/v2/imports/:id
const getImport = asyncHandler(async (req, res) => {
  const job = await importService.getImport({
    tenantId: req.tenantId,
    importId: req.params.id,
  });
  res.json(job);
});

// @route   POST /api/v2/imports/:id/confirm
const confirmImport = asyncHandler(async (req, res) => {
  const job = await importService.confirmImport({
    tenantId: req.tenantId,
    importId: req.params.id,
    userId: req.user ? req.user._id : null,
  });
  res.json(job);
});

// @route   POST /api/v2/imports/:id/run
const startImport = asyncHandler(async (req, res) => {
  const job = await importService.startImport({
    tenantId: req.tenantId,
    importId: req.params.id,
    userId: req.user ? req.user._id : null,
  });
  res.status(202).json(job);
});

module.exports = { uploadProducts, listImports, getImport, confirmImport, startImport };
