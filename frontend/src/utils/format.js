// Formatteur monétaire partagé — tenant-aware. La devise active provient du
// réglage "Devise" de la boutique (AppSettings.currency) et retombe sur le CFA
// (XOF) par défaut, préservant exactement l'ancien comportement.

export const DEFAULT_CURRENCY = {
  code: 'XOF',
  symbol: 'CFA',
  label: 'Franc CFA (UEMOA)',
  decimals: 0,
  locale: 'fr-FR',
};

const CURRENCY_STORAGE_KEY = 'hd-active-currency';

let activeCurrency = DEFAULT_CURRENCY;

export const getActiveCurrency = () => activeCurrency;

const clampDecimals = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n)) return DEFAULT_CURRENCY.decimals;
  return Math.min(4, Math.max(0, n));
};

export const setActiveCurrency = (currency) => {
  if (!currency) {
    activeCurrency = DEFAULT_CURRENCY;
  } else {
    activeCurrency = {
      code: currency.code || DEFAULT_CURRENCY.code,
      symbol: currency.symbol || DEFAULT_CURRENCY.symbol,
      label: currency.label || DEFAULT_CURRENCY.label,
      decimals: clampDecimals(currency.decimals),
      locale: currency.locale || DEFAULT_CURRENCY.locale,
    };
  }
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(activeCurrency));
  } catch {
    // stockage indisponible (mode privé…) : on ignore
  }
};

// Applique la devise mémorisée dès le premier rendu, avant le chargement des
// paramètres, pour éviter un flash CFA sur les boutiques ayant changé de devise.
export const bootstrapCurrency = () => {
  try {
    const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (raw) setActiveCurrency(JSON.parse(raw));
  } catch {
    // ignore
  }
};

// Formate un montant avec une devise donnée (active par défaut).
export const formatMoney = (value, currency = activeCurrency) => {
  const c = currency || DEFAULT_CURRENCY;
  const decimals = Number(c.decimals) || 0;
  const locale = c.locale || 'fr-FR';
  const number = Number(value) || 0;
  const formatted = decimals > 0
    ? number.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(number).toLocaleString(locale);
  return `${formatted} ${c.symbol}`;
};

// Alias historique : tout le code appelle `formatCfa`, qui suit désormais la
// devise active du tenant au lieu d'être codé en dur sur le CFA.
export const formatCfa = (value) => formatMoney(value, activeCurrency);

