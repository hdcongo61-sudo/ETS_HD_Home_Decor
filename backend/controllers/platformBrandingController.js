const asyncHandler = require('express-async-handler');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');
const PlatformBranding = require('../models/platformBrandingModel');

const DEFAULT_APP_NAME = 'ETS HD Gestion';
const CONTACT_FIELDS = {
  supportEmail: 254,
  supportPhone: 40,
  whatsappUrl: 500,
  websiteUrl: 500,
  address: 200,
};

const isHttpUrl = (value) => {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const isWhatsAppUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol)
      && (url.hostname === 'wa.me' || url.hostname === 'whatsapp.com' || url.hostname.endsWith('.whatsapp.com'));
  } catch {
    return false;
  }
};

const uploadPlatformLogo = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'platform-branding',
      resource_type: 'image',
      format: 'webp',
      quality: 'auto:good',
    },
    (error, result) => {
      if (error) return reject(error);
      return resolve(result.secure_url);
    }
  );
  streamifier.createReadStream(buffer).pipe(stream);
});

const getPlatformBranding = asyncHandler(async (_req, res) => {
  const branding = await PlatformBranding.findOne({ key: 'app' }).lean();
  res.json({
    appName: branding?.appName || DEFAULT_APP_NAME,
    logoUrl: branding?.logoUrl || '',
    supportEmail: branding?.supportEmail || '',
    supportPhone: branding?.supportPhone || '',
    whatsappUrl: branding?.whatsappUrl || '',
    websiteUrl: branding?.websiteUrl || '',
    address: branding?.address || '',
    updatedAt: branding?.updatedAt || null,
  });
});

const updatePlatformBranding = asyncHandler(async (req, res) => {
  const removeLogo = String(req.body.removeLogo || '').toLowerCase() === 'true';
  const appName = typeof req.body.appName === 'string' ? req.body.appName.trim() : '';
  if (appName.length > 80) {
    res.status(400);
    throw new Error('Le nom de l’application ne peut pas dépasser 80 caractères.');
  }
  if (typeof req.body.appName === 'string' && !appName) {
    res.status(400);
    throw new Error('Le nom de l’application est obligatoire.');
  }
  const updates = {};
  if (typeof req.body.appName === 'string') updates.appName = appName;

  Object.entries(CONTACT_FIELDS).forEach(([field, maxLength]) => {
    if (typeof req.body[field] !== 'string') return;
    const value = req.body[field].trim();
    if (value.length > maxLength) {
      res.status(400);
      throw new Error(`Le champ ${field} ne peut pas dépasser ${maxLength} caractères.`);
    }
    updates[field] = value;
  });

  if (updates.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.supportEmail)) {
    res.status(400);
    throw new Error('Saisissez une adresse e-mail de support valide.');
  }
  if (!isWhatsAppUrl(updates.whatsappUrl)) {
    res.status(400);
    throw new Error('Saisissez un lien WhatsApp valide (wa.me ou whatsapp.com).');
  }
  if (!isHttpUrl(updates.websiteUrl)) {
    res.status(400);
    throw new Error('Le site web doit être une URL commençant par http:// ou https://.');
  }

  if (!Object.keys(updates).length && !req.file?.buffer && !removeLogo) {
    res.status(400);
    throw new Error('Modifiez les informations de la plateforme, sélectionnez une image ou choisissez de réinitialiser le logo.');
  }

  if (removeLogo) {
    updates.logoUrl = '';
  } else if (req.file?.buffer) {
    updates.logoUrl = await uploadPlatformLogo(req.file.buffer);
  }

  const branding = await PlatformBranding.findOneAndUpdate(
    { key: 'app' },
    { $set: updates, $setOnInsert: { key: 'app' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  res.json({
    appName: branding.appName || DEFAULT_APP_NAME,
    logoUrl: branding.logoUrl || '',
    supportEmail: branding.supportEmail || '',
    supportPhone: branding.supportPhone || '',
    whatsappUrl: branding.whatsappUrl || '',
    websiteUrl: branding.websiteUrl || '',
    address: branding.address || '',
    updatedAt: branding.updatedAt,
  });
});

module.exports = { getPlatformBranding, updatePlatformBranding };
