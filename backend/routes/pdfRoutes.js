const express = require('express');
const { exportClientsPdf } = require('../controllers/pdfController');
const router = express.Router();

router.get('/clients', exportClientsPdf);

module.exports = router;
