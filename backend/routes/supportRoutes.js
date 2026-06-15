const express = require('express');
const {
  createTicket, getMyTickets, getMyUnread, getMyTicket, replyMyTicket,
  getAllTickets, getAdminUnread, getTicketAdmin, replyTicketAdmin, updateTicketAdmin,
} = require('../controllers/supportController');
const { protect, admin, superAdmin, requireTenant } = require('../middlewares/authMiddleware');

const router = express.Router();

// ── Super-admin (control plane) — declared before the shop /:id routes ──
router.get('/admin/all', protect, superAdmin, getAllTickets);
router.get('/admin/unread', protect, superAdmin, getAdminUnread);
router.get('/admin/:id', protect, superAdmin, getTicketAdmin);
router.post('/admin/:id/reply', protect, superAdmin, replyTicketAdmin);
router.put('/admin/:id', protect, superAdmin, updateTicketAdmin);

// ── Shop side (tenant admin) ──
router.post('/', protect, admin, requireTenant, createTicket);
router.get('/', protect, admin, requireTenant, getMyTickets);
router.get('/unread', protect, admin, requireTenant, getMyUnread);
router.get('/:id', protect, admin, requireTenant, getMyTicket);
router.post('/:id/reply', protect, admin, requireTenant, replyMyTicket);

module.exports = router;
