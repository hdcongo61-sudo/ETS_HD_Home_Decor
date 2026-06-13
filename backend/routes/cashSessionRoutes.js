const express = require('express');
const router = express.Router();
const { protect, requireTenant } = require('../middlewares/authMiddleware');
const {
  getCurrentSession,
  openSession,
  closeSession,
  getSessions,
  getSessionById,
} = require('../controllers/cashSessionController');

// All routes require an authenticated user inside a tenant.
router.use(protect, requireTenant);

router.get('/current', getCurrentSession);
router.get('/', getSessions);
router.post('/open', openSession);
router.get('/:id', getSessionById);
router.post('/:id/close', closeSession);

module.exports = router;
