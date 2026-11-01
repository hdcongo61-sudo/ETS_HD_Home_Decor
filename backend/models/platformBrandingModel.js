const mongoose = require('mongoose');

const platformBrandingSchema = new mongoose.Schema(
  {
    appName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'ETS HD Gestion',
    },
    key: {
      type: String,
      enum: ['app'],
      default: 'app',
      unique: true,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    supportEmail: {
      type: String,
      trim: true,
      maxlength: 254,
      default: '',
    },
    supportPhone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },
    whatsappUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    websiteUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformBranding', platformBrandingSchema);
