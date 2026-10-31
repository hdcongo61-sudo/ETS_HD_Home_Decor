const express = require('express');
const Product = require('../models/productModel');
const Sale = require('../models/saleModel');
const { tenantFilter } = require('../utils/tenantQuery');

const router = express.Router();

// API publique (lecture seule) — authentifiée par clé API (apiKeyAuth).
// Champs volontairement limités : aucune donnée sensible (coût, contacts).

// @route   GET /api/public/products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find(tenantFilter(req))
      .select('name sku barcode price stock category image slug isActive')
      .sort({ name: 1 })
      .limit(500)
      .lean();
    res.json({ count: products.length, products });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// @route   GET /api/public/sales
router.get('/sales', async (req, res) => {
  try {
    const sales = await Sale.find(tenantFilter(req))
      .select('reference clientName totalAmount saleDate status deliveryStatus')
      .sort({ saleDate: -1 })
      .limit(500)
      .lean();
    res.json({ count: sales.length, sales });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
