const express = require('express');
const {
  createTicket, getMyTickets, getMyUnread, getMyTicket, replyMyTicket,
  getAllTickets, getAdminUnread, getTicketAdmin, replyTicketAdmin, updateTicketAdmin,
} = require('../controllers/supportController');
const { protect, admin, superAdmin, requireTenant, protectAny, platformAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// ── Support / control plane — super-admin OU opérateur plateforme habilité ──
router.get('/admin/all', protectAny, platformAdmin, getAllTickets);
router.get('/admin/unread', protectAny, platformAdmin, getAdminUnread);
router.get('/admin/:id', protectAny, platformAdmin, getTicketAdmin);
router.post('/admin/:id/reply', protectAny, platformAdmin, replyTicketAdmin);
router.put('/admin/:id', protectAny, platformAdmin, updateTicketAdmin);

// ── Shop side (tenant admin) ──
router.post('/', protect, admin, requireTenant, createTicket);
router.get('/', protect, admin, requireTenant, getMyTickets);
router.get('/unread', protect, admin, requireTenant, getMyUnread);
router.get('/:id', protect, admin, requireTenant, getMyTicket);
router.post('/:id/reply', protect, admin, requireTenant, replyMyTicket);

module.exports = router;
