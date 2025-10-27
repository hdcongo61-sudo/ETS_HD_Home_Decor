const express = require('express');
const router = express.Router();
const {
  getPublicKey,
  subscribe,
  unsubscribe
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/public-key', protect, getPublicKey);
router.post('/subscribe', protect, subscribe);
router.delete('/subscribe', protect, unsubscribe);

module.exports = router;
