const express = require('express');
const {
  getProformas,
  getProformaById,
  createProforma,
  updateProforma,
  markProformaConverted,
  deleteProforma,
} = require('../controllers/proformaController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get(protect, getProformas)
  .post(protect, createProforma);

router.put('/:id/convert', protect, markProformaConverted);

router.route('/:id')
  .get(protect, getProformaById)
  .put(protect, updateProforma)
  .delete(protect, deleteProforma);

module.exports = router;
