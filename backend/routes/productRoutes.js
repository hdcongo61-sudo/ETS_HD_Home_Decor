const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  duplicateProduct,
  updateProduct,
  bulkUpdateProducts,
  deleteProduct,
  getProductStats,
  getProductImages,
  getImageLibrary,
  getNeverSoldProducts,
  getSlowMovingProducts,
  createStockMovement,
  getStockMovements,
  getProductLossMap,
  deleteStockMovement,
  getProductDashboard, // Assurez-vous d'importer cette fonction
  getProductsBySupplier,
  getProductsByContainer,
  getProductsByWarehouse,
  getProductSalesHistory,
  importProducts
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');
const { requireFeature } = require('../middlewares/featureMiddleware');
const { FEATURE_KEYS } = require('../config/features');

router.route('/never-sold').get(protect, getNeverSoldProducts);
router.route('/slow-movers').get(protect, admin, getSlowMovingProducts);
router.route('/stock-movements').get(protect, admin, getStockMovements);
router.route('/loss-map').get(protect, admin, getProductLossMap);
router.route('/stock-movement').post(protect, admin, createStockMovement);
router.route('/stock-movement/:id').delete(protect, admin, deleteStockMovement);
// Route pour le tableau de bord des produits (DOIT ÊTRE AVANT LES ROUTES AVEC :id)
router.route('/dashboard')
  .get(protect, admin, getProductDashboard);

router.route('/by-supplier')
  .get(protect, admin, getProductsBySupplier);

router.route('/by-container')
  .get(protect, admin, getProductsByContainer);

router.route('/by-warehouse')
  .get(protect, admin, getProductsByWarehouse);

// Routes standard pour les produits
router.route('/')
  .get(protect, getProducts)
  .post(protect, admin, imageUpload.single('imageFile'), createProduct);

router.route('/import')
  .post(protect, admin, requireFeature(FEATURE_KEYS.PRODUCT_IMPORT), importProducts);

router.route('/bulk')
  .put(protect, admin, requireFeature(FEATURE_KEYS.BULK_EDIT), bulkUpdateProducts);

router.route('/:id/duplicate')
  .post(protect, admin, requireFeature(FEATURE_KEYS.PRODUCT_DUPLICATE), duplicateProduct);

router.route('/image-library')
  .get(protect, getImageLibrary);

router.route('/:id/stats')
  .get(protect,getProductStats);

router.route('/:id/images')
  .get(protect, getProductImages);

router.route('/:id/sales-history')
  .get(protect, getProductSalesHistory);

router.route('/:id')
  .get(protect, getProductById)
  .put(protect, admin, imageUpload.single('imageFile'), updateProduct)
  .delete(protect, admin, deleteProduct);




module.exports = router;
