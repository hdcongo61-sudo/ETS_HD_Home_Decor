/**
 * TOTP (RFC 6238, SHA-1) sans dépendance externe — MFA (Phase 0.8).
 */
const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (input) => {
  const clean = String(input || '').toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Secret base32 invalide.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
};

const generateSecret = (bytes = 20) => base32Encode(crypto.randomBytes(bytes));

const generateTotp = ({ secret, step = 30, digits = 6, time = Date.now(), offset = 0 }) => {
  const counter = Math.floor(time / 1000 / step) + offset;
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const dynamicOffset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(dynamicOffset) & 0x7fffffff) % (10 ** digits))
    .toString()
    .padStart(digits, '0');
  return code;
};

const verifyTotp = (code, secret, { window = 1, step = 30, digits = 6, time = Date.now() } = {}) => {
  const normalized = String(code || '').trim();
  if (!/^\d+$/.test(normalized)) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotp({ secret, step, digits, time, offset }) === normalized) return true;
  }
  return false;
};

module.exports = { generateSecret, generateTotp, verifyTotp };
