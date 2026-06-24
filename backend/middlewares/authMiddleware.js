const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const Tenant = require('../models/tenantModel');
const { runWithTenant } = require('../utils/tenantContext');

const protect = asyncHandler(async (req, res, next) => {
  // Idempotent: when protect already ran earlier in this chain (e.g. a
  // mount-level guard before per-route protect), skip re-verifying. The tenant
  // context established by the first call is still active downstream.
  if (req.user) {
    return next();
  }

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'Non autorisé. Session invalide.' });
      }

      // ── Time-window access control ──
      if (user.accessControlEnabled) {
        const now = new Date();
        const accessStart = user.accessStart ? new Date(user.accessStart) : null;
        const accessEnd = user.accessEnd ? new Date(user.accessEnd) : null;
        if ((accessStart && now < accessStart) || (accessEnd && now > accessEnd)) {
          return res.status(403).json({
            message: 'Accès restreint. Veuillez contacter un administrateur.',
            accessStart: accessStart ? accessStart.toISOString() : null,
            accessEnd: accessEnd ? accessEnd.toISOString() : null,
          });
        }
      }

      if (user.isActive === false) {
        return res.status(403).json({
          message: 'Votre compte a été désactivé. Veuillez contacter un administrateur.',
          code: 'ACCOUNT_INACTIVE',
        });
      }

      // ── Impersonation awareness ──
      // A super-admin can mint a tenant-scoped token to act as a shop admin.
      // That token carries `impersonatedBy`. The acting user is the tenant
      // admin (isSuperAdmin = false), so normal tenant scoping applies, but
      // we surface the impersonation context for auditing / UI banners.
      if (decoded.impersonatedBy) {
        req.isImpersonating = true;
        req.impersonatedBy = decoded.impersonatedBy;
      }

      // ── Tenant resolution + validation ──
      // The tenant ALWAYS comes from the signed token (decoded.tenantId),
      // never from a header or query the client could tamper with.
      // Super-admins acting on the control plane have no token tenantId.
      const tokenTenantId = decoded.tenantId || (user.isSuperAdmin ? null : user.tenantId);

      if (tokenTenantId) {
        const tenant = await Tenant.findById(tokenTenantId).lean();

        if (!tenant) {
          return res.status(403).json({ message: 'Boutique introuvable.', code: 'TENANT_NOT_FOUND' });
        }

        const isTrialExpired =
          tenant.status === 'trial' &&
          tenant.trialEndsAt &&
          new Date() > new Date(tenant.trialEndsAt);

        if (tenant.status === 'suspended') {
          return res.status(403).json({
            message: 'Votre abonnement est suspendu. Veuillez contacter le support.',
            code: 'TENANT_SUSPENDED',
          });
        }

        if (tenant.status === 'expired' || isTrialExpired) {
          return res.status(403).json({
            message: "Votre période d'essai est terminée. Veuillez souscrire à un abonnement.",
            code: 'TENANT_EXPIRED',
            trialEndsAt: tenant.trialEndsAt,
          });
        }

        req.tenantId = tenant._id;
        req.tenant = tenant;
      }

      // Fire-and-forget: update lastActivity
      User.findByIdAndUpdate(user._id, { lastActivity: new Date() }, { timestamps: false }).catch(() => {});

      req.user = user;

      // Run the rest of the request inside the tenant context so the global
      // Mongoose plugin auto-scopes every query to this tenant. Super-admins
      // (no req.tenantId) run with a null context = control plane.
      runWithTenant(
        {
          tenantId: req.tenantId || null,
          isSuperAdmin: Boolean(user.isSuperAdmin),
          userId: user._id,
        },
        () => next()
      );
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Session expirée. Veuillez vous reconnecter.', code: 'TOKEN_EXPIRED' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Token invalide. Veuillez vous reconnecter.', code: 'TOKEN_INVALID' });
      }
      console.error(error);
      return res.status(401).json({ message: 'Non autorisé.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Non autorisé, aucun token.' });
  }
});

const admin = (req, res, next) => {
  if (req.user && (req.user.isAdmin || req.user.isSuperAdmin)) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
};

// Super-admin only (control plane — cross-tenant management)
const superAdmin = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) {
    next();
  } else {
    res.status(403);
    throw new Error('Réservé au super administrateur.');
  }
};

// Data-plane guard: every shop route must run inside a single tenant.
// A super-admin who has NOT impersonated has no req.tenantId and is
// rejected here — forcing them through impersonation to view a shop,
// instead of silently seeing a cross-tenant data soup.
const requireTenant = (req, res, next) => {
  if (req.tenantId) return next();
  return res.status(403).json({
    message: "Aucune boutique active. Ouvrez une boutique pour accéder à ces données.",
    code: 'NO_TENANT_CONTEXT',
  });
};

const adminOrPermission = (permission) => (req, res, next) => {
  if (
    req.user &&
    (req.user.isAdmin || req.user.isSuperAdmin ||
      (Array.isArray(req.user.permissions) && req.user.permissions.includes(permission)))
  ) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized');
  }
};

module.exports = { protect, admin, superAdmin, requireTenant, adminOrPermission };
