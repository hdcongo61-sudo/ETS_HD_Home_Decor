const express = require('express');
const {
  getProformas,
  getProformaById,
  createProforma,
  updateProforma,
  markProformaConverted,
  deleteProforma,
} = require('../controllers/proformaController');
const { protect, requireTenant, resolveLocation } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, requireTenant, getProformas)
  .post(protect, requireTenant, resolveLocation, createProforma);

router.put('/:id/convert', protect, requireTenant, markProformaConverted);

router.route('/:id')
  .get(protect, requireTenant, getProformaById)
  .put(protect, requireTenant, updateProforma)
  .delete(protect, requireTenant, deleteProforma);

module.exports = router;
