/**
 * SessionService — sessions, révocation unitaire et déconnexion globale
 * (Phase 0.8).
 */
const UserSession = require('../models/userSessionModel');
const User = require('../models/userModel');
const PlatformUser = require('../models/platformUserModel');

const DEFAULT_TTL_MS = 30 * 24 * 3600 * 1000; // 30 jours

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

async function recordSession({
  kind = 'user', userId, tenantId = null, device = '', ip = '', userAgent = '', tokenVersion = 0,
  ttlMs = DEFAULT_TTL_MS,
}) {
  return UserSession.create({
    kind,
    userId,
    tenantId,
    device: String(device || '').slice(0, 300),
    ip: String(ip || '').slice(0, 64),
    userAgent: String(userAgent || '').slice(0, 500),
    tokenVersion,
    status: 'active',
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + ttlMs),
  });
}

async function touchSession({ kind = 'user', userId, sessionId }) {
  return UserSession.updateOne(
    { kind, userId, _id: sessionId, status: 'active' },
    { $set: { lastSeenAt: new Date() } }
  );
}

async function listSessions({ kind = 'user', userId }) {
  return UserSession.find({ kind, userId, status: 'active' })
    .sort({ lastSeenAt: -1 })
    .limit(50)
    .lean();
}

async function revokeSession({ kind = 'user', userId, sessionId }) {
  const result = await UserSession.updateOne(
    { kind, userId, _id: sessionId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
  if (result.matchedCount === 0) throw notFound('Session introuvable.');
  return { revoked: true };
}

/**
 * Déconnexion globale : révoque toutes les sessions ET incrémente
 * tokenVersion du principal → tous les jetons existants deviennent invalides.
 */
async function revokeAllForUser({ kind = 'user', userId }) {
  await UserSession.updateMany(
    { kind, userId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
  if (kind === 'platform') {
    await PlatformUser.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  } else {
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  }
  return { revokedAll: true };
}

module.exports = { recordSession, touchSession, listSessions, revokeSession, revokeAllForUser };
