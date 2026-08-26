/**
 * cutoverController — drapeaux de bascule et rapport de réconciliation
 * final (Phases 8.2 + 8.7).
 */
const asyncHandler = require('express-async-handler');
const featureFlagService = require('../services/featureFlagService');
const reconciliationService = require('../services/reconciliationService');
const { DEPRECATIONS } = require('../config/deprecations');

// @route   GET /api/v2/deprecations
const getDeprecations = asyncHandler(async (req, res) => {
  res.json({ deprecations: DEPRECATIONS, generatedAt: new Date() });
});

// @route   GET /api/v2/flags
const getFlags = asyncHandler(async (req, res) => {
  const result = await featureFlagService.getFlags({ tenantId: req.tenantId });
  res.json(result);
});

// @route   PUT /api/v2/flags/:key
const setFlag = asyncHandler(async (req, res) => {
  const flag = await featureFlagService.setFlag({
    tenantId: req.tenantId,
    key: req.params.key,
    value: req.body.value,
    userId: req.user ? req.user._id : null,
  });
  res.json(flag);
});

// @route   POST /api/v2/cutover/report
const archiveReport = asyncHandler(async (req, res) => {
  const result = await reconciliationService.archiveReport({
    tenantId: req.tenantId,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(result);
});

// @route   GET /api/v2/cutover/reports
const listReports = asyncHandler(async (req, res) => {
  const reports = await reconciliationService.listReports({ tenantId: req.tenantId });
  res.json(reports);
});

// @route   GET /api/v2/cutover/reports/:id
const getReport = asyncHandler(async (req, res) => {
  const report = await reconciliationService.getReport({
    tenantId: req.tenantId,
    reportId: req.params.id,
  });
  res.json(report);
});

module.exports = { getFlags, setFlag, archiveReport, listReports, getReport, getDeprecations };
