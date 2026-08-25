/**
 * PawaPay (mobile money) configuration.
 *
 * Environment variables:
 *   PAWAPAY_API_TOKEN  — Bearer token generated from the PawaPay dashboard
 *                        (sandbox + production tokens are different).
 *   PAWAPAY_BASE_URL   — Optional. Defaults to the SANDBOX API:
 *                        https://api.sandbox.pawapay.io
 *                        Production: https://api.pawapay.io
 *   PAWAPAY_PROVIDERS  — Optional JSON array overriding the provider list below.
 *                        Shape: [{ "id": "MTN_MOMO_CIV", "label": "...",
 *                                  "country": "CIV", "currency": "XOF" }]
 *                        The IDs must be enabled on YOUR PawaPay account.
 *   PAWAPAY_PUBLIC_KEY — Optional PEM public key for verifying signed PawaPay
 *                        webhook callbacks (RFC-9421). Without it, callbacks
 *                        are accepted on trust (log a warning when signed).
 */

const DEFAULT_PROVIDERS = [
  { id: 'MTN_MOMO_CMR',   label: 'MTN Mobile Money — Cameroun',      country: 'CMR', currency: 'XAF' },
  { id: 'ORANGE_MONEY_CMR', label: 'Orange Money — Cameroun',        country: 'CMR', currency: 'XAF' },
  { id: 'MTN_MOMO_CIV',   label: 'MTN Mobile Money — Côte d’Ivoire', country: 'CIV', currency: 'XOF' },
  { id: 'ORANGE_MONEY_CIV', label: 'Orange Money — Côte d’Ivoire',   country: 'CIV', currency: 'XOF' },
  { id: 'MOOV_MONEY_CIV', label: 'Moov Money — Côte d’Ivoire',       country: 'CIV', currency: 'XOF' },
  { id: 'WAVE_CIV',       label: 'Wave — Côte d’Ivoire',             country: 'CIV', currency: 'XOF' },
  { id: 'ORANGE_MONEY_SEN', label: 'Orange Money — Sénégal',         country: 'SEN', currency: 'XOF' },
  { id: 'MTN_MOMO_BEN',   label: 'MTN Mobile Money — Bénin',         country: 'BEN', currency: 'XOF' },
  { id: 'MOOV_MONEY_BEN', label: 'Moov Money — Bénin',               country: 'BEN', currency: 'XOF' },
];

function parseProviders() {
  const raw = process.env.PAWAPAY_PROVIDERS;
  if (!raw) return DEFAULT_PROVIDERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    console.warn('[pawapay] PAWAPAY_PROVIDERS is not valid JSON, using defaults.', err.message);
  }
  return DEFAULT_PROVIDERS;
}

const baseUrl = (process.env.PAWAPAY_BASE_URL || 'https://api.sandbox.pawapay.io').replace(/\/+$/, '');

module.exports = {
  isConfigured: Boolean(process.env.PAWAPAY_API_TOKEN),
  baseUrl,
  token: process.env.PAWAPAY_API_TOKEN || '',
  providers: parseProviders(),
  publicKey: process.env.PAWAPAY_PUBLIC_KEY || '',
};
