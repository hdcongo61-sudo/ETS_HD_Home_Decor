const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation } = require('../middlewares/authMiddleware');
const { getSuggestions } = require('../controllers/replenishmentController');

// Suggestions de réapprovisionnement (Phase 6.7) — consultatif.
router.get('/purchasing/replenishment-suggestions', protect, requireTenant, resolveLocation, getSuggestions);

module.exports = router;
