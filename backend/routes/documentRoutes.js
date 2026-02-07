const express = require('express');
const router = express.Router();
const {
  getDocuments,
  getDocumentYears,
  createDocument,
  deleteDocument,
} = require('../controllers/documentController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { documentUpload } = require('../middlewares/uploadMiddleware');

router.route('/')
  .get(protect, admin, getDocuments)
  .post(protect, admin, documentUpload.single('file'), createDocument);

router.route('/years')
  .get(protect, admin, getDocumentYears);

router.route('/:id')
  .delete(protect, admin, deleteDocument);

module.exports = router;
