const express = require('express');
const router = express.Router();
const { protect, requireTenant, resolveLocation, requirePermission } = require('../middlewares/authMiddleware');
const { createRegister, openSession, getSessionState, closeSession, nextNumber } = require('../controllers/cashController');

// Caisses et sessions (Phase 5.7).
router.post('/cash-registers', protect, requireTenant, resolveLocation, requirePermission('cashier.manage'), createRegister);
router.post('/cash-sessions/open', protect, requireTenant, requirePermission('cashier.manage'), openSession);
router.get('/cash-sessions/:id/state', protect, requireTenant, getSessionState);
router.post('/cash-sessions/:id/close', protect, requireTenant, requirePermission('cashier.manage'), closeSession);

// Numérotation de documents (Phase 5.3).
router.post('/numbering/next', protect, requireTenant, resolveLocation, nextNumber);

module.exports = router;
