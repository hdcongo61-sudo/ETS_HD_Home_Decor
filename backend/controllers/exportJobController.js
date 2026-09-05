/**
 * exportJobController — exports asynchrones (Phase 7.7).
 */
const asyncHandler = require('express-async-handler');
const exportJobService = require('../services/exportJobService');

// @route   POST /api/v2/exports
const createExport = asyncHandler(async (req, res) => {
  const job = await exportJobService.createAndRun({
    tenantId: req.tenantId,
    type: req.body.type,
    filters: req.body.filters || {},
    requesterId: req.user ? req.user._id : null,
  });
  res.status(202).json(job);
});

// @route   GET /api/v2/exports
const listExports = asyncHandler(async (req, res) => {
  const result = await exportJobService.listJobs({
    tenantId: req.tenantId,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(result);
});

// @route   GET /api/v2/exports/:id
const getExport = asyncHandler(async (req, res) => {
  const job = await exportJobService.getJob({
    tenantId: req.tenantId,
    jobId: req.params.id,
  });
  res.json(job);
});

// @route   GET /api/v2/exports/:id/download?token=...
// Accès par jeton de téléchargement (lien ouvrable sans en-tête Bearer).
const downloadExport = asyncHandler(async (req, res) => {
  const result = await exportJobService.download({
    jobId: req.params.id,
    token: req.query.token || null,
  });
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.send(result.content);
});

module.exports = { createExport, listExports, getExport, downloadExport };
