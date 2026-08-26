/**
 * reportController — reporting paginé côté serveur (Phase 7.6).
 */
const asyncHandler = require('express-async-handler');
const reportService = require('../services/reportService');

// @route   GET /api/v2/reports/sales
const salesReport = asyncHandler(async (req, res) => {
  const report = await reportService.salesReport({
    tenantId: req.tenantId,
    locationId: req.query.locationId || null,
    from: req.query.from || null,
    to: req.query.to || null,
    groupBy: req.query.groupBy || 'day',
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ report, generatedAt: new Date() });
});

// @route   GET /api/v2/reports/inventory
const inventoryReport = asyncHandler(async (req, res) => {
  const report = await reportService.inventoryReport({
    tenantId: req.tenantId,
    locationId: req.locationId || req.query.locationId || null,
    page: req.query.page,
    limit: req.query.limit,
    minStockOnly: req.query.minStockOnly === 'true',
  });
  res.json({ report, generatedAt: new Date() });
});

module.exports = { salesReport, inventoryReport };
