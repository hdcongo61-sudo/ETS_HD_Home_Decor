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
const { protect, admin, requireTenant, resolveLocation } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');
const { requireFeature } = require('../middlewares/featureMiddleware');
const { FEATURE_KEYS } = require('../config/features');
const { deprecate } = require('../middlewares/deprecation');
const { DEPRECATIONS } = require('../config/deprecations');

router.route('/never-sold').get(protect, requireTenant, getNeverSoldProducts);
router.route('/slow-movers').get(protect, requireTenant, admin, getSlowMovingProducts);
router.route('/stock-movements').get(protect, requireTenant, admin, getStockMovements);
router.route('/loss-map').get(protect, requireTenant, admin, getProductLossMap);
router.route('/stock-movement').post(protect, requireTenant, admin, resolveLocation, deprecate(DEPRECATIONS[1]), createStockMovement);
router.route('/stock-movement/:id').delete(protect, requireTenant, admin, deleteStockMovement);
// Route pour le tableau de bord des produits (DOIT ÊTRE AVANT LES ROUTES AVEC :id)
router.route('/dashboard')
  .get(protect, requireTenant, admin, getProductDashboard);

router.route('/by-supplier')
  .get(protect, requireTenant, admin, getProductsBySupplier);

router.route('/by-container')
  .get(protect, requireTenant, admin, getProductsByContainer);

router.route('/by-warehouse')
  .get(protect, requireTenant, admin, getProductsByWarehouse);

// Routes standard pour les produits
router.route('/')
  .get(protect, requireTenant, getProducts)
  .post(protect, requireTenant, admin, imageUpload.single('imageFile'), createProduct);

router.route('/import')
  .post(protect, requireTenant, admin, requireFeature(FEATURE_KEYS.PRODUCT_IMPORT), deprecate(DEPRECATIONS[0]), importProducts);

router.route('/bulk')
  .put(protect, requireTenant, admin, requireFeature(FEATURE_KEYS.BULK_EDIT), bulkUpdateProducts);

router.route('/:id/duplicate')
  .post(protect, requireTenant, admin, requireFeature(FEATURE_KEYS.PRODUCT_DUPLICATE), duplicateProduct);

router.route('/image-library')
  .get(protect, requireTenant, getImageLibrary);

router.route('/:id/stats')
  .get(protect, requireTenant, getProductStats);

router.route('/:id/images')
  .get(protect, requireTenant, getProductImages);

router.route('/:id/sales-history')
  .get(protect, requireTenant, getProductSalesHistory);

router.route('/:id')
  .get(protect, requireTenant, getProductById)
  .put(protect, requireTenant, admin, imageUpload.single('imageFile'), updateProduct)
  .delete(protect, requireTenant, admin, deleteProduct);




module.exports = router;
