const https = require('https');
const crypto = require('crypto');
const pawapayConfig = require('../config/pawapay');

/**
 * Minimal PawaPay Merchant API v2 client (no external dependencies).
 * Docs: https://docs.pawapay.io/
 */

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pawapayConfig.baseUrl + path);
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      headers: {
        Authorization: `Bearer ${pawapayConfig.token}`,
        Accept: 'application/json',
      },
    };
    if (payload) {
      options.headers['Content-Type'] = 'application/json; charset=UTF-8';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = { raw: data };
        }
        resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.setTimeout(15000, () => req.destroy(new Error('PawaPay request timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * PawaPay amount format: no leading zeroes, no trailing ".00", max 2 decimals.
 */
function formatAmount(value) {
  const num = Number(value);
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  return String(rounded);
}

function cleanPhoneNumber(raw) {
  return String(raw || '').replace(/[\s\-().]/g, '');
}

/**
 * Initiate a mobile-money deposit.
 * Returns the PawaPay response: { depositId, status: ACCEPTED|REJECTED|DUPLICATE_IGNORED, created, failureReason }
 */
async function createDeposit({ depositId, amount, currency, provider, phoneNumber, clientReferenceId }) {
  const body = {
    depositId,
    amount: formatAmount(amount),
    currency,
    payer: {
      type: 'MMO',
      accountDetails: {
        provider,
        phoneNumber: cleanPhoneNumber(phoneNumber),
      },
    },
    customerMessage: 'Abonnement HD Gestion', // 4-22 chars, [a-zA-Z0-9 ]
  };
  if (clientReferenceId) body.clientReferenceId = clientReferenceId;

  const { statusCode, data } = await request('POST', '/v2/deposits', body);

  if (statusCode >= 500) {
    throw new Error('PawaPay est momentanément indisponible. Réessayez plus tard.');
  }
  if (statusCode === 401 || statusCode === 403) {
    console.error('[pawapay] Authentication error while creating deposit:', data?.failureReason || data);
    throw new Error('Le paiement mobile money n’est pas configuré correctement. Contactez le support.');
  }
  return data;
}

/**
 * Check the latest status of a deposit.
 * Returns PawaPay payload: { status: FOUND|NOT_FOUND, data: Deposit } (or an error body).
 */
async function getDeposit(depositId) {
  const { statusCode, data } = await request('GET', `/v2/deposits/${encodeURIComponent(depositId)}`);
  if (statusCode >= 500) {
    throw new Error('PawaPay est momentanément indisponible.');
  }
  return data;
}

// ── Webhook verification (RFC-9421 / Content-Digest) ──────────────────────

const HEADER_VALUE_SAFE = /^[!#$%&'*+\-.^_|~0-9A-Za-z:/]*$/;

function serializeComponentValue(value) {
  return HEADER_VALUE_SAFE.test(value) ? value : `"${value.replace(/(["\\])/g, '\\$1')}"`;
}

function buildSignatureBase(paramsString, components, ctx) {
  const lines = components.map((name) => {
    if (name === '@method') return `"@method": ${ctx.method}`;
    if (name === '@authority') return `"@authority": ${ctx.authority}`;
    if (name === '@path') return `"@path": ${ctx.path}`;
    const headerValue = ctx.headers[String(name).toLowerCase()] || '';
    return `"${name}": ${serializeComponentValue(headerValue)}`;
  });
  lines.push(`"@signature-params": ${paramsString}`);
  return lines.join('\n');
}

/** Build a second, lenient base where header values are never quoted (matches the simplified docs examples). */
function buildSignatureBaseLenient(paramsString, components, ctx) {
  const lines = components.map((name) => {
    if (name === '@method') return `"@method": ${ctx.method}`;
    if (name === '@authority') return `"@authority": ${ctx.authority}`;
    if (name === '@path') return `"@path": ${ctx.path}`;
    return `"${name}": ${ctx.headers[String(name).toLowerCase()] || ''}`;
  });
  lines.push(`"@signature-params": ${paramsString}`);
  return lines.join('\n');
}

function rawToDerEcSignature(sig) {
  if (sig.length !== 64) return null;
  const r = sig.subarray(0, 32);
  const s = sig.subarray(32, 64);
  const toDerInt = (buf) => {
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0 && !(buf[i + 1] & 0x80)) i += 1;
    const body = buf.subarray(i);
    if (body[0] & 0x80) {
      const padded = Buffer.concat([Buffer.from([0x00]), body]);
      return { len: padded.length, bytes: padded };
    }
    return { len: body.length, bytes: body };
  };
  const ri = toDerInt(r);
  const si = toDerInt(s);
  const der = Buffer.concat([
    Buffer.from([0x30, 4 + ri.len + si.len]),
    Buffer.from([0x02, ri.len]), ri.bytes,
    Buffer.from([0x02, si.len]), si.bytes,
  ]);
  return der;
}

function verifySignature(alg, publicKey, base, signature) {
  let verified = false;
  try {
    if (alg === 'ecdsa-p256-sha256' || alg === 'ecdsa-p384-sha384') {
      const hash = alg === 'ecdsa-p256-sha256' ? 'sha256' : 'sha384';
      verified = crypto.verify(hash, Buffer.from(base), publicKey, signature);
      if (!verified) {
        const der = rawToDerEcSignature(signature);
        if (der) verified = crypto.verify(hash, Buffer.from(base), publicKey, der);
      }
    } else if (alg === 'rsa-v1_5-sha256') {
      verified = crypto.verify('RSA-SHA256', Buffer.from(base), publicKey, signature);
    } else if (alg === 'rsa-pss-sha512') {
      verified = crypto.verify(
        'sha512',
        Buffer.from(base),
        { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 },
        signature
      );
    } else {
      return { ok: false, reason: `Unsupported signature algorithm: ${alg}` };
    }
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  return { ok: verified, reason: verified ? '' : 'Signature mismatch' };
}

/**
 * Verify an incoming PawaPay callback.
 *
 * req must carry the RAW body buffer (req.rawBody) captured by the JSON body
 * parser `verify` hook, plus headers, method and originalUrl.
 *
 * Returns { digestOk, sigProvided, sigOk, configured, reason }.
 */
function verifyCallback(req) {
  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  const headers = req.headers;

  // 1) Content-Digest (integrity) — verify whenever present.
  let digestOk = true;
  let digestReason = '';
  const digestHeader = headers['content-digest'];
  if (digestHeader) {
    const match = /^(sha-256|sha-512)=:([A-Za-z0-9+/=]+):$/.exec(String(digestHeader).trim());
    if (!match) {
      digestOk = false;
      digestReason = 'Malformed Content-Digest header';
    } else {
      const hash = crypto.createHash(match[1] === 'sha-256' ? 'sha256' : 'sha512').update(rawBody).digest('base64');
      if (hash !== match[2]) {
        digestOk = false;
        digestReason = 'Content-Digest mismatch';
      }
    }
  }

  // 2) RFC-9421 signature — only verifiable when a PawaPay public key is configured.
  const signatureHeader = String(headers.signature || '');
  const inputHeader = String(headers['signature-input'] || '');
  const sigProvided = Boolean(signatureHeader && inputHeader);

  const publicKey = pawapayConfig.publicKey;
  if (!publicKey) {
    return {
      digestOk,
      sigProvided,
      sigOk: false,
      configured: false,
      reason: sigProvided
        ? 'PawaPay callback is signed but PAWAPAY_PUBLIC_KEY is not configured; accepted without signature verification.'
        : digestReason,
    };
  }

  // Parse "sig-pp=(...);alg=...;keyid=...;created=...;expires=..."
  const eqIndex = inputHeader.indexOf('=');
  if (eqIndex === -1) {
    return { digestOk, sigProvided, sigOk: false, configured: true, reason: 'Malformed Signature-Input header' };
  }
  const paramsString = inputHeader.slice(eqIndex + 1);
  const componentsMatch = /^\(([^)]*)\)/.exec(paramsString);
  if (!componentsMatch) {
    return { digestOk, sigProvided, sigOk: false, configured: true, reason: 'No signature components found' };
  }
  // Component names are quoted inside @signature-params, e.g. ("@method" "@path").
  const components = componentsMatch[1]
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => c.replace(/^"/, '').replace(/"$/, ''));
  const algMatch = /;alg="([^"]+)"/.exec(paramsString);
  const alg = algMatch ? algMatch[1] : '';

  const sigMatch = /^sig-pp=:([A-Za-z0-9+/=]+):$/.exec(signatureHeader.trim());
  if (!sigMatch) {
    return { digestOk, sigProvided, sigOk: false, configured: true, reason: 'Malformed Signature header' };
  }
  const signature = Buffer.from(sigMatch[1], 'base64');

  const ctx = {
    method: req.method.toUpperCase(),
    authority: String(headers.host || ''),
    path: req.originalUrl || req.url || '',
    headers,
  };

  // Try strict RFC serialization first, then the lenient form shown in the docs.
  const bases = [buildSignatureBase(paramsString, components, ctx)];
  const lenient = buildSignatureBaseLenient(paramsString, components, ctx);
  if (lenient !== bases[0]) bases.push(lenient);

  for (const base of bases) {
    const result = verifySignature(alg, publicKey, base, signature);
    if (result.ok) return { digestOk, sigProvided, sigOk: true, configured: true, reason: '' };
  }
  return { digestOk, sigProvided, sigOk: false, configured: true, reason: 'Signature verification failed' };
}

module.exports = {
  createDeposit,
  getDeposit,
  formatAmount,
  cleanPhoneNumber,
  verifyCallback,
};
