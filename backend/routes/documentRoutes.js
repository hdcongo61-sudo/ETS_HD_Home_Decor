const express = require('express');
const router = express.Router();
const {
  getDocuments,
  getDocumentYears,
  createDocument,
  deleteDocument,
} = require('../controllers/documentController');
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const { documentUpload } = require('../middlewares/uploadMiddleware');

router.route('/')
  .get(protect, requireTenant, admin, getDocuments)
  .post(protect, requireTenant, admin, documentUpload.single('file'), createDocument);

router.route('/years')
  .get(protect, requireTenant, admin, getDocumentYears);

router.route('/:id')
  .delete(protect, requireTenant, admin, deleteDocument);

module.exports = router;
