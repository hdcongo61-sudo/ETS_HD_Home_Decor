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
  },
  {
    timestamps: true,
  }
);

// One settings document per tenant (legacy single-shop uses tenantId: null).
appSettingsSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('AppSettings', appSettingsSchema);
