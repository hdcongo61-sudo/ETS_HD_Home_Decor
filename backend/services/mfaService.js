/**
 * MfaService — TOTP pour l'usurpation et les actions sensibles (Phase 0.8).
 */
const { generateSecret, verifyTotp } = require('../utils/totp');

const buildOtpauthUrl = (email, secret, issuer = 'ETS-HD-Gestion') =>
  `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

const setup = (email) => {
  const secret = generateSecret();
  return { secret, otpauthUrl: buildOtpauthUrl(email, secret) };
};

const verifyCode = (secret, code) => Boolean(secret) && verifyTotp(code, secret, { window: 1 });

module.exports = { setup, verifyCode };
