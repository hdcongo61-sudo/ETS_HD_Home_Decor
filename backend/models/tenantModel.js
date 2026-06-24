const mongoose = require('mongoose');
const crypto = require('crypto');

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom de la boutique est requis'],
      trim: true,
      maxLength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Short unique code shown to the shop owner (e.g. "BOU001")
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Le nom du propriétaire est requis'],
      trim: true,
    },
    ownerEmail: {
      type: String,
      required: [true, 'L\'email du propriétaire est requis'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    ownerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    plan: {
      type: String,
      enum: ['trial', 'basic', 'pro', 'enterprise'],
      default: 'trial',
    },
    status: {
      type: String,
      enum: ['active', 'trial', 'suspended', 'expired'],
      default: 'trial',
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
    subscriptionEndsAt: {
      type: Date,
      default: null,
    },
    // Plan limits
    maxUsers: { type: Number, default: 3 },
    maxProducts: { type: Number, default: 500 },
    // International dialing code for the shop's country (e.g. "+242"), set by
    // the super-admin. Used to build WhatsApp/phone links for client reminders.
    dialCode: { type: String, default: '' },
    // Per-shop feature overrides (super-admin). Shape: { [featureKey]: true|false }.
    // true = force-grant, false = force-revoke, absent = inherit from the plan.
    featureOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Plan change requested by the shop owner, awaiting super-admin decision.
    planRequest: {
      requestedPlan: { type: String, enum: ['basic', 'pro', 'enterprise', null], default: null },
      note: { type: String, default: '', maxLength: 400 },
      status: { type: String, enum: ['pending', 'approved', 'rejected', null], default: null },
      requestedAt: { type: Date, default: null },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    // Per-tenant branding (supplements global AppSettings)
    branding: {
      appName: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
      primaryColor: { type: String, default: '#0F6CBD' },
    },
    // ── Billing ──
    // Monthly price in CFA. Defaults from the plan but overridable per shop.
    monthlyPrice: { type: Number, default: 0, min: 0 },
    nextPaymentDue: { type: Date, default: null },
    lastPaymentAt: { type: Date, default: null },
    payments: [
      {
        amount: { type: Number, required: true, min: 0 },
        method: { type: String, default: 'cash' }, // cash, mobile_money, transfer
        period: { type: String, default: '' },      // e.g. "2026-06"
        note: { type: String, default: '' },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        paidAt: { type: Date, default: Date.now },
      },
    ],
    billingNotes: { type: String, default: '' },
    // Stats (updated periodically)
    stats: {
      userCount: { type: Number, default: 0 },
      productCount: { type: Number, default: 0 },
      saleCount: { type: Number, default: 0 },
      lastActiveAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Auto-generate slug and code before save
tenantSchema.pre('save', async function (next) {
  if (this.isNew) {
    if (!this.slug) {
      const base = this.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
      // Ensure uniqueness
      let slug = base;
      let attempt = 0;
      while (await mongoose.model('Tenant').exists({ slug })) {
        attempt += 1;
        slug = `${base}-${attempt}`;
      }
      this.slug = slug;
    }
    if (!this.code) {
      let code;
      do {
        code = crypto.randomBytes(3).toString('hex').toUpperCase();
      } while (await mongoose.model('Tenant').exists({ code }));
      this.code = code;
    }
  }
  next();
});

tenantSchema.virtual('isActive').get(function () {
  if (this.status === 'suspended' || this.status === 'expired') return false;
  if (this.status === 'trial' && this.trialEndsAt && new Date() > this.trialEndsAt) return false;
  return true;
});

// ── Plan catalog: single source of truth for price + limits (CFA / month) ──
// Operators can still override per-tenant, but new tenants inherit these.
const PLAN_CATALOG = {
  trial:      { label: 'Essai',      price: 0,     maxUsers: 3,   maxProducts: 500 },
  basic:      { label: 'Basique',    price: 5000,  maxUsers: 5,   maxProducts: 1000 },
  pro:        { label: 'Pro',        price: 15000, maxUsers: 15,  maxProducts: 5000 },
  enterprise: { label: 'Entreprise', price: 40000, maxUsers: 100, maxProducts: 50000 },
};

const Tenant = mongoose.model('Tenant', tenantSchema);
module.exports = Tenant;
module.exports.PLAN_CATALOG = PLAN_CATALOG;
