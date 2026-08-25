const express = require('express');
const router = express.Router();
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const {
  getUnits, createUnit, updateUnit, deleteUnit,
  getConversions, createConversion, deleteConversion,
} = require('../controllers/unitController');

// Unités
router
  .route('/')
  .get(protect, requireTenant, getUnits)
  .post(protect, requireTenant, admin, createUnit);

// Conversions — déclarées AVANT /:id pour éviter les collisions de chemin.
router.get('/conversions', protect, requireTenant, getConversions);
router.post('/conversions', protect, requireTenant, admin, createConversion);
router.delete('/conversions/:id', protect, requireTenant, admin, deleteConversion);

router
  .route('/:id')
  .put(protect, requireTenant, admin, updateUnit)
  .delete(protect, requireTenant, admin, deleteUnit);

module.exports = router;
