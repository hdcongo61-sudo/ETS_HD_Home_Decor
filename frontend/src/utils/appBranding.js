export const DEFAULT_APP_SETTINGS = {
  branding: {
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
  },
  updatedAt: null,
};

const HEX_COLOR_PATTERN = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i;

export const normalizeAppSettings = (settings) => {
  const branding = settings?.branding || {};

  return {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    branding: {
      ...DEFAULT_APP_SETTINGS.branding,
      ...branding,
      primaryColor: HEX_COLOR_PATTERN.test(branding.primaryColor || '')
        ? branding.primaryColor.toUpperCase()
        : DEFAULT_APP_SETTINGS.branding.primaryColor,
    },
  };
};

export const resolveAppLogo = (logoUrl) =>
  logoUrl || `${process.env.PUBLIC_URL || ''}/logo.png`;

/**
 * Fetch a logo URL and return it as a base64 data URL for embedding in jsPDF.
 * Returns null on any failure so callers can render a logo-less header.
 */
export const getLogoDataUrl = async (logoUrl) => {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/**
 * Normalised company identity for documents (invoices, payslips, reports).
 * Pulls from the (tenant-scoped) branding with sensible fallbacks.
 */
export const getCompanyIdentity = (branding = {}) => ({
  name: branding.appName || 'Ma Boutique',
  address: branding.address || '',
  phone: branding.supportPhone || '',
  email: branding.supportEmail || '',
  logoUrl: resolveAppLogo(branding.logoUrl),
  footerText: branding.footerText || '',
});

export const mixHexColors = (baseColor, ratio = 0.16, targetColor = '#FFFFFF') => {
  const normalizedBase = HEX_COLOR_PATTERN.test(baseColor || '')
    ? baseColor.slice(1)
    : DEFAULT_APP_SETTINGS.branding.primaryColor.slice(1);
  const normalizedTarget = HEX_COLOR_PATTERN.test(targetColor || '')
    ? targetColor.slice(1)
    : 'FFFFFF';

  const parseChannel = (hex, start) => {
    const size = hex.length === 3 ? 1 : 2;
    const chunk = hex.slice(start, start + size);
    return Number.parseInt(size === 1 ? `${chunk}${chunk}` : chunk, 16);
  };

  const base = [
    parseChannel(normalizedBase, 0),
    parseChannel(normalizedBase, normalizedBase.length === 3 ? 1 : 2),
    parseChannel(normalizedBase, normalizedBase.length === 3 ? 2 : 4),
  ];
  const target = [
    parseChannel(normalizedTarget, 0),
    parseChannel(normalizedTarget, normalizedTarget.length === 3 ? 1 : 2),
    parseChannel(normalizedTarget, normalizedTarget.length === 3 ? 2 : 4),
  ];

  const mixed = base.map((channel, index) => {
    const value = Math.round(channel + (target[index] - channel) * ratio);
    return value.toString(16).padStart(2, '0');
  });

  return `#${mixed.join('').toUpperCase()}`;
};

export const BRAND_COLOR_STORAGE_KEY = 'hd-brand-color';

/**
 * Apply the tenant brand colour to the app's design tokens at runtime.
 * Derives hover/pressed/dark/soft shades from a single primaryColor and writes
 * them onto :root, so every component using the brand / --ms-blue tokens follows
 * the shop's colour. This is the single source of truth for the accent colour.
 */
export const applyBrandTheme = (primaryColor) => {
  if (typeof document === 'undefined') return;
  const base = HEX_COLOR_PATTERN.test(primaryColor || '')
    ? primaryColor.toUpperCase()
    : DEFAULT_APP_SETTINGS.branding.primaryColor;

  const hover = mixHexColors(base, 0.12, '#000000');
  const pressed = mixHexColors(base, 0.22, '#000000');
  const dark = mixHexColors(base, 0.28, '#000000');
  const soft = mixHexColors(base, 0.88, '#FFFFFF');
  const softer = mixHexColors(base, 0.93, '#FFFFFF');

  const tokens = {
    // Fluent brand family
    '--colorBrandBackground': base,
    '--colorBrandBackgroundHover': hover,
    '--colorBrandBackgroundPressed': pressed,
    '--colorBrandForeground1': base,
    '--colorBrandStroke1': base,
    '--colorStatusInfoForeground1': base,
    '--colorStatusInfoBackground1': softer,
    // Legacy --ms-* accent family (unified with the brand)
    '--ms-blue': base,
    '--ms-blue-dark': dark,
    '--ms-blue-soft': soft,
    '--ms-info': base,
    '--app-accent-soft': soft,
  };

  const root = document.documentElement;
  Object.entries(tokens).forEach(([name, value]) => root.style.setProperty(name, value));

  // Remember the colour so the next load can theme the very first paint.
  try {
    localStorage.setItem(BRAND_COLOR_STORAGE_KEY, base);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
};

/**
 * Apply the last-known brand colour synchronously at app start (before React
 * renders), so the first paint is already themed instead of flashing the
 * default accent until settings load.
 */
export const bootstrapBrandTheme = () => {
  let cached = null;
  try {
    cached = localStorage.getItem(BRAND_COLOR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  applyBrandTheme(cached || DEFAULT_APP_SETTINGS.branding.primaryColor);
};
