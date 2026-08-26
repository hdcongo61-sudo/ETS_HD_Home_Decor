/**
 * ReplenishmentController — suggestions de réappro (Phase 6.7).
 */
const asyncHandler = require('express-async-handler');
const replenishmentService = require('../services/replenishmentService');

// @route   GET /api/v2/purchasing/replenishment-suggestions
const getSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await replenishmentService.getSuggestions({
    tenantId: req.tenantId,
    locationId: req.locationId || req.query.locationId,
  });
  res.json({ suggestions, generatedAt: new Date() });
});

module.exports = { getSuggestions };
