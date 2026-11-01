const express = require('express');
const {
  getDevis,
  getDevisById,
  createDevis,
  updateDevis,
  updateStatus,
  convertToProforma,
  deleteDevis,
} = require('../controllers/devisController');
const { protect, requireTenant, resolveLocation } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, requireTenant, getDevis)
  .post(protect, requireTenant, resolveLocation, createDevis);

router.put('/:id/status', protect, requireTenant, updateStatus);
router.post('/:id/convert', protect, requireTenant, convertToProforma);

router.route('/:id')
  .get(protect, requireTenant, getDevisById)
  .put(protect, requireTenant, updateDevis)
  .delete(protect, requireTenant, deleteDevis);

module.exports = router;
