const mongoose = require('mongoose');

const brandingSchema = new mongoose.Schema(
  {
    appName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'ETS HD Gestion',
    },
    shortName: {
      type: String,
      trim: true,
      maxlength: 30,
      default: 'ETS HD',
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 140,
      default: 'Pilotez vos ventes, stocks et encaissements avec clarté.',
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    primaryColor: {
      type: String,
      trim: true,
      default: '#2563EB',
    },
    loginTitle: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'Connexion',
    },
    loginSubtitle: {
      type: String,
      trim: true,
      maxlength: 180,
      default: 'Accédez à votre espace professionnel',
    },
    footerText: {
      type: String,
      trim: true,
      maxlength: 180,
      default: 'ETS HD Tech Filiale. Tous droits réservés.',
    },
    supportPhone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },
    supportEmail: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
  },
  { _id: false }
);

// Currency used for every money display, invoice and export of this tenant.
// Stored as a subdocument so a shop can override symbol/decimals without
// touching the code. Default preserves the legacy CFA behaviour.
const currencySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      maxlength: 8,
      default: 'XOF',
    },
    symbol: {
      type: String,
      trim: true,
      maxlength: 8,
      default: 'CFA',
    },
    label: {
      type: String,
      trim: true,
      maxlength: 60,
      default: 'Franc CFA (UEMOA)',
    },
    decimals: {
      type: Number,
      min: 0,
      max: 4,
      default: 0,
    },
    locale: {
      type: String,
      trim: true,
      maxlength: 16,
      default: 'fr-FR',
    },
  },
  { _id: false }
);

const appSettingsSchema = new mongoose.Schema(
  {
    // Top-level tenant scope so the tenant guard plugin can isolate it.
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    key: {
      type: String,
      default: 'main',
      trim: true,
    },
    branding: {
      type: brandingSchema,
      default: () => ({}),
    },
    currency: {
      type: currencySchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// One settings document per tenant (legacy single-shop uses tenantId: null).
appSettingsSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('AppSettings', appSettingsSchema);
