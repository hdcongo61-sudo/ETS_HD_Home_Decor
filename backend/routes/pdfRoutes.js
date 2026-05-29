const express = require('express');
const { exportClientsPdf } = require('../controllers/pdfController');
const { protect, admin } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/clients', protect, admin, exportClientsPdf);

module.exports = router;
