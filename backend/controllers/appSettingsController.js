const asyncHandler = require('express-async-handler');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');
const AppSettings = require('../models/appSettingsModel');

const DEFAULT_BRANDING = {
  appName: 'ETS HD Gestion',
  shortName: 'ETS HD',
  tagline: 'Pilotez vos ventes, stocks et encaissements avec clarté.',
  logoUrl: '',
  primaryColor: '#2563EB',
  loginTitle: 'Connexion',
  loginSubtitle: 'Accédez à votre espace professionnel',
  footerText: 'ETS HD Tech Filiale. Tous droits réservés.',
  supportPhone: '',
  supportEmail: '',
};

const HEX_COLOR_PATTERN = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i;

const uploadBrandLogo = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'app-branding',
      resource_type: 'image',
      format: 'webp',
      quality: 'auto:good',
    },
    (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result.secure_url);
    }
  );

  streamifier.createReadStream(buffer).pipe(stream);
});

const normalizeText = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeOptionalText = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeColor = (value, fallback = DEFAULT_BRANDING.primaryColor) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toUpperCase() : fallback;
};

const sanitizeSettings = (doc) => {
  const settings = doc?.toObject ? doc.toObject() : doc || {};
  const branding = settings.branding || {};

  return {
    _id: settings._id?.toString?.() || settings._id || null,
    branding: {
      appName: normalizeText(branding.appName, DEFAULT_BRANDING.appName),
      shortName: normalizeText(branding.shortName, DEFAULT_BRANDING.shortName),
      tagline: normalizeText(branding.tagline, DEFAULT_BRANDING.tagline),
      logoUrl: normalizeOptionalText(branding.logoUrl),
      primaryColor: normalizeColor(branding.primaryColor),
      loginTitle: normalizeText(branding.loginTitle, DEFAULT_BRANDING.loginTitle),
      loginSubtitle: normalizeText(branding.loginSubtitle, DEFAULT_BRANDING.loginSubtitle),
      footerText: normalizeText(branding.footerText, DEFAULT_BRANDING.footerText),
      supportPhone: normalizeOptionalText(branding.supportPhone),
      supportEmail: normalizeOptionalText(branding.supportEmail),
    },
    updatedAt: settings.updatedAt || null,
  };
};

const getOrCreateSettings = async () => {
  let settings = await AppSettings.findOne({ key: 'main' });

  if (!settings) {
    settings = await AppSettings.create({
      key: 'main',
      branding: DEFAULT_BRANDING,
    });
  }

  return settings;
};

// @desc    Get public app settings
// @route   GET /api/app-settings/public
// @access  Public
const getPublicAppSettings = asyncHandler(async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(sanitizeSettings(settings));
});

// @desc    Update app settings
// @route   PUT /api/app-settings
// @access  Private/Admin
const updateAppSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const currentBranding = settings.branding || {};
  const removeLogo = String(req.body.removeLogo || '').toLowerCase() === 'true';

  const nextBranding = {
    appName: normalizeText(req.body.appName, currentBranding.appName || DEFAULT_BRANDING.appName),
    shortName: normalizeText(req.body.shortName, currentBranding.shortName || DEFAULT_BRANDING.shortName),
    tagline: normalizeText(req.body.tagline, currentBranding.tagline || DEFAULT_BRANDING.tagline),
    logoUrl: removeLogo
      ? ''
      : normalizeOptionalText(req.body.logoUrl || currentBranding.logoUrl || ''),
    primaryColor: normalizeColor(
      req.body.primaryColor,
      currentBranding.primaryColor || DEFAULT_BRANDING.primaryColor
    ),
    loginTitle: normalizeText(
      req.body.loginTitle,
      currentBranding.loginTitle || DEFAULT_BRANDING.loginTitle
    ),
    loginSubtitle: normalizeText(
      req.body.loginSubtitle,
      currentBranding.loginSubtitle || DEFAULT_BRANDING.loginSubtitle
    ),
    footerText: normalizeText(
      req.body.footerText,
      currentBranding.footerText || DEFAULT_BRANDING.footerText
    ),
    supportPhone: normalizeOptionalText(req.body.supportPhone || currentBranding.supportPhone || ''),
    supportEmail: normalizeOptionalText(req.body.supportEmail || currentBranding.supportEmail || ''),
  };

  if (req.file?.buffer) {
    nextBranding.logoUrl = await uploadBrandLogo(req.file.buffer);
  }

  settings.branding = nextBranding;
  await settings.save();

  res.json(sanitizeSettings(settings));
});

module.exports = {
  getPublicAppSettings,
  updateAppSettings,
  DEFAULT_BRANDING,
};
