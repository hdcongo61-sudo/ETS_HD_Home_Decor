const asyncHandler = require('express-async-handler');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');
const AppSettings = require('../models/appSettingsModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

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
  address: '',
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
      address: normalizeOptionalText(branding.address),
    },
    updatedAt: settings.updatedAt || null,
  };
};

// Each tenant gets a UNIQUE `key` so we never collide with a legacy global
// unique index on `key` (a single-shop DB may still have `key_1`). Using the
// tenantId as the key makes every document's key distinct.
const settingsKeyFor = (tenantId) => (tenantId ? String(tenantId) : 'main');

// Each tenant has its own AppSettings document, looked up by tenantId.
const getOrCreateSettings = async (req) => {
  const tenantId = req?.tenantId || null;
  const filter = tenantId ? { tenantId } : { tenantId: null };

  let settings = await AppSettings.findOne(filter);
  if (settings) return settings;

  try {
    settings = await AppSettings.create({
      tenantId,
      key: settingsKeyFor(tenantId),
      branding: DEFAULT_BRANDING,
    });
  } catch (err) {
    // Race or stale-index collision: fall back to whatever now exists.
    settings = await AppSettings.findOne(filter)
      || await AppSettings.findOne({ key: settingsKeyFor(tenantId) });
    if (!settings) throw err;
  }
  return settings;
};

// @desc    Get public app settings (tenant-aware)
// @route   GET /api/app-settings/public
// @access  Public
const getPublicAppSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(req);
  res.json(sanitizeSettings(settings));
});

// @desc    Update app settings
// @route   PUT /api/app-settings
// @access  Private/Admin
const updateAppSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(req);
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
    address: normalizeOptionalText(req.body.address || currentBranding.address || ''),
  };

  if (req.file?.buffer) {
    nextBranding.logoUrl = await uploadBrandLogo(req.file.buffer);
  }

  settings.branding = nextBranding;
  await settings.save();

  res.json(sanitizeSettings(settings));
});

/**
 * Seed a brand-new tenant's settings from the information captured at shop
 * creation, so the owner opens Settings and immediately sees THEIR shop —
 * not the generic defaults.
 *
 * Called from tenantController at registration / creation time.
 * Idempotent: if settings already exist for the tenant, it does nothing.
 */
const seedTenantSettings = async ({ tenantId, shopName, ownerEmail, ownerPhone, primaryColor } = {}) => {
  if (!tenantId) return null;

  const existing = await AppSettings.findOne({ tenantId });
  if (existing) return existing;

  const cleanName = normalizeText(shopName, DEFAULT_BRANDING.appName);
  // Short name = first word of the shop name, capped at 30 chars.
  const shortName = (cleanName.split(/\s+/)[0] || cleanName).slice(0, 30);

  const branding = {
    ...DEFAULT_BRANDING,
    appName: cleanName,
    shortName,
    loginTitle: `Bienvenue chez ${cleanName}`,
    loginSubtitle: 'Connectez-vous à votre espace de gestion',
    footerText: `${cleanName}. Tous droits réservés.`,
    supportEmail: normalizeOptionalText(ownerEmail),
    supportPhone: normalizeOptionalText(ownerPhone),
    primaryColor: normalizeColor(primaryColor, DEFAULT_BRANDING.primaryColor),
  };

  try {
    return await AppSettings.create({ tenantId, key: settingsKeyFor(tenantId), branding });
  } catch (err) {
    // If a settings doc was created concurrently, return it instead of failing signup.
    return AppSettings.findOne({ tenantId });
  }
};

module.exports = {
  getPublicAppSettings,
  updateAppSettings,
  seedTenantSettings,
  DEFAULT_BRANDING,
};
