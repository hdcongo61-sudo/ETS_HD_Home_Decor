const SupportTicket = require('../models/supportTicketModel');

const CATEGORIES = SupportTicket.CATEGORIES;

// Shape a ticket for list views (no full thread, just a preview).
const toSummary = (t) => {
  const last = t.messages && t.messages.length ? t.messages[t.messages.length - 1] : null;
  return {
    _id: t._id,
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    category: t.category,
    subject: t.subject,
    status: t.status,
    messageCount: t.messages ? t.messages.length : 0,
    lastMessage: last ? { sender: last.sender, body: last.body, createdAt: last.createdAt } : null,
    unreadForShop: t.unreadForShop,
    unreadForSupport: t.unreadForSupport,
    lastMessageAt: t.lastMessageAt,
    createdAt: t.createdAt,
  };
};

/* ───────────────────────── SHOP SIDE (admin) ───────────────────────── */

// @desc  Open a new ticket. @route POST /api/support  (admin, tenant)
exports.createTicket = async (req, res) => {
  try {
    const { category, subject, message } = req.body || {};
    if (!subject || !String(subject).trim()) return res.status(400).json({ message: 'Le sujet est requis.' });
    if (!message || !String(message).trim()) return res.status(400).json({ message: 'Le message est requis.' });
    const cat = CATEGORIES.includes(category) ? category : 'question';

    const ticket = await SupportTicket.create({
      tenantId: req.tenantId,
      tenantName: req.tenant?.name || '',
      category: cat,
      subject: String(subject).trim().slice(0, 200),
      status: 'open',
      messages: [{
        sender: 'shop',
        user: req.user._id,
        authorName: req.user.name || '',
        body: String(message).trim().slice(0, 5000),
      }],
      unreadForSupport: 1,
      unreadForShop: 0,
      lastMessageAt: new Date(),
    });
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Erreur création ticket:', error);
    res.status(500).json({ message: 'Erreur lors de la création du message.' });
  }
};

// @desc  List my shop's tickets. @route GET /api/support
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find().sort({ lastMessageAt: -1 }).lean();
    res.json(tickets.map(toSummary));
  } catch (error) {
    console.error('Erreur liste tickets:', error);
    res.status(500).json({ message: 'Erreur lors du chargement des messages.' });
  }
};

// @desc  Unread support replies for the nav badge. @route GET /api/support/unread
exports.getMyUnread = async (req, res) => {
  try {
    const rows = await SupportTicket.find({ unreadForShop: { $gt: 0 } }).select('unreadForShop').lean();
    const unread = rows.reduce((s, t) => s + (t.unreadForShop || 0), 0);
    res.json({ unread, tickets: rows.length });
  } catch (error) {
    res.json({ unread: 0, tickets: 0 });
  }
};

// @desc  Get one ticket (own) and mark support replies as read. @route GET /api/support/:id
exports.getMyTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Message introuvable.' });
    if (ticket.unreadForShop > 0) { ticket.unreadForShop = 0; await ticket.save(); }
    res.json(ticket);
  } catch (error) {
    console.error('Erreur lecture ticket:', error);
    res.status(500).json({ message: 'Erreur lors du chargement du message.' });
  }
};

// @desc  Reply to my ticket. @route POST /api/support/:id/reply
exports.replyMyTicket = async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !String(message).trim()) return res.status(400).json({ message: 'Le message est requis.' });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Message introuvable.' });
    ticket.messages.push({
      sender: 'shop', user: req.user._id, authorName: req.user.name || '',
      body: String(message).trim().slice(0, 5000),
    });
    ticket.unreadForSupport += 1;
    ticket.unreadForShop = 0;
    ticket.status = 'open';
    ticket.lastMessageAt = new Date();
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Erreur réponse ticket:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message.' });
  }
};

/* ─────────────────────── SUPER-ADMIN SIDE ─────────────────────── */
// These run with a null tenant context → the guard sees every shop's tickets.

// @desc  List all tickets across shops. @route GET /api/support/admin/all
exports.getAllTickets = async (req, res) => {
  try {
    const { status, category, q } = req.query;
    const filter = {};
    if (status && SupportTicket.STATUSES.includes(status)) filter.status = status;
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ subject: rx }, { tenantName: rx }];
    }
    const tickets = await SupportTicket.find(filter).sort({ lastMessageAt: -1 }).lean();
    res.json(tickets.map(toSummary));
  } catch (error) {
    console.error('Erreur liste tickets (admin):', error);
    res.status(500).json({ message: 'Erreur lors du chargement des messages.' });
  }
};

// @desc  Unread + open counts for the console badge. @route GET /api/support/admin/unread
exports.getAdminUnread = async (req, res) => {
  try {
    const [unreadTickets, openCount] = await Promise.all([
      SupportTicket.countDocuments({ unreadForSupport: { $gt: 0 } }),
      SupportTicket.countDocuments({ status: 'open' }),
    ]);
    res.json({ unread: unreadTickets, open: openCount });
  } catch (error) {
    res.json({ unread: 0, open: 0 });
  }
};

// @desc  Get one ticket and mark shop messages as read. @route GET /api/support/admin/:id
exports.getTicketAdmin = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Message introuvable.' });
    if (ticket.unreadForSupport > 0) { ticket.unreadForSupport = 0; await ticket.save(); }
    res.json(ticket);
  } catch (error) {
    console.error('Erreur lecture ticket (admin):', error);
    res.status(500).json({ message: 'Erreur lors du chargement du message.' });
  }
};

// @desc  Support replies to a ticket. @route POST /api/support/admin/:id/reply
exports.replyTicketAdmin = async (req, res) => {
  try {
    const { message, resolve } = req.body || {};
    if (!message || !String(message).trim()) return res.status(400).json({ message: 'Le message est requis.' });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Message introuvable.' });
    ticket.messages.push({
      sender: 'support', user: req.user._id, authorName: req.user.name || 'Support',
      body: String(message).trim().slice(0, 5000),
    });
    ticket.unreadForShop += 1;
    ticket.unreadForSupport = 0;
    ticket.status = resolve ? 'resolved' : 'open';
    ticket.lastMessageAt = new Date();
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Erreur réponse ticket (admin):', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message.' });
  }
};

// @desc  Change ticket status. @route PUT /api/support/admin/:id
exports.updateTicketAdmin = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!SupportTicket.STATUSES.includes(status)) return res.status(400).json({ message: 'Statut invalide.' });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Message introuvable.' });
    ticket.status = status;
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Erreur mise à jour ticket (admin):', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour.' });
  }
};
