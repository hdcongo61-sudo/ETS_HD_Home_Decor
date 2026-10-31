const express = require('express');
const { protect, requireTenant, admin } = require('../middlewares/authMiddleware');
const { listWebhooks, createWebhook, deleteWebhook } = require('../controllers/webhookController');

const router = express.Router();

router.route('/webhooks')
  .get(protect, requireTenant, admin, listWebhooks)
  .post(protect, requireTenant, admin, createWebhook);
router.route('/webhooks/:id')
  .delete(protect, requireTenant, admin, deleteWebhook);

module.exports = router;
