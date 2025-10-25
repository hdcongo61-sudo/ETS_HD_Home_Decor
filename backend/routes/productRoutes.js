const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getNeverSoldProducts,
  getProductDashboard, // Assurez-vous d'importer cette fonction
  getProductsBySupplier
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/never-sold').get(protect, getNeverSoldProducts);
// Route pour le tableau de bord des produits (DOIT ÊTRE AVANT LES ROUTES AVEC :id)
router.route('/dashboard')
  .get(protect, admin, getProductDashboard);

router.route('/by-supplier')
  .get(protect, admin, getProductsBySupplier);

// Routes standard pour les produits
router.route('/')
  .get(protect, getProducts)
  .post(protect, admin, createProduct);

router.route('/:id/stats')
  .get(protect,getProductStats);  

router.route('/:id')
  .get(protect, getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);




module.exports = router;
