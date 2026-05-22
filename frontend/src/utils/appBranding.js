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
