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
  getProductsBySupplier,
  getProductSalesHistory
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');

router.route('/never-sold').get(protect, getNeverSoldProducts);
// Route pour le tableau de bord des produits (DOIT ÊTRE AVANT LES ROUTES AVEC :id)
router.route('/dashboard')
  .get(protect, admin, getProductDashboard);

router.route('/by-supplier')
  .get(protect, admin, getProductsBySupplier);

// Routes standard pour les produits
router.route('/')
  .get(protect, getProducts)
  .post(protect, admin, imageUpload.single('imageFile'), createProduct);

router.route('/:id/stats')
  .get(protect,getProductStats);  

router.route('/:id/sales-history')
  .get(protect, getProductSalesHistory);

router.route('/:id')
  .get(protect, getProductById)
  .put(protect, admin, imageUpload.single('imageFile'), updateProduct)
  .delete(protect, admin, deleteProduct);




module.exports = router;
