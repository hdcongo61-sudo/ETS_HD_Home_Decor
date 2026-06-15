const express = require('express');
const { exportClientsPdf, generateBrochurePdf, generateDocPdf, getDocContent, saveDocContent } = require('../controllers/pdfController');
const { protect, admin, superAdmin } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/clients', protect, admin, exportClientsPdf);
router.get('/brochure', protect, admin, generateBrochurePdf);
// Documents éditeur (flyer / guide / formation) — super-admin uniquement
router.get('/doc/:type/content', protect, superAdmin, getDocContent);
router.put('/doc/:type/content', protect, superAdmin, saveDocContent);
router.get('/doc/:type', protect, superAdmin, generateDocPdf);

module.exports = router;
