const mongoose = require('mongoose');

/**
 * Support ticket: a threaded conversation between a shop (tenant admin) and
 * the platform super-admin. Used for suggestions, complaints, questions, etc.
 *
 * Carries a `tenantId` → the global tenant guard auto-scopes shop queries to
 * their own tickets. The super-admin runs with a null tenant context, so the
 * same queries see every shop's tickets (control plane).
 *
 * Unread tracking is two-sided via counters:
 *   - unreadForSupport: new shop messages the super-admin hasn't read.
 *   - unreadForShop:    new support replies the shop admin hasn't read.
 */
const TICKET_CATEGORIES = ['suggestion', 'reclamation', 'question', 'autre'];
const TICKET_STATUSES = ['open', 'resolved'];

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['shop', 'support'], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, default: '' },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    tenantName: { type: String, default: '' },
    category: { type: String, enum: TICKET_CATEGORIES, default: 'question', index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },
    messages: { type: [messageSchema], default: [] },
    unreadForShop: { type: Number, default: 0 },
    unreadForSupport: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
SupportTicket.CATEGORIES = TICKET_CATEGORIES;
SupportTicket.STATUSES = TICKET_STATUSES;

module.exports = SupportTicket;
