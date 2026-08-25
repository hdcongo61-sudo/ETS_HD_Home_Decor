const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const Tenant = require('../models/tenantModel');
const PlatformUser = require('../models/platformUserModel');
const Location = require('../models/locationModel');
const { authorize } = require('../services/authorization');
const { runWithTenant } = require('../utils/tenantContext');

// Core token verification + tenant resolution.
// `allowRestricted` lets suspended/expired shops through (they can still pay
// their subscription to reactivate), while normal data-plane routes stay blocked.
const authenticate = (allowRestricted, { allowPlatform = false } = {}) => asyncHandler(async (req, res, next) => {
  // Idempotent: when protect already ran earlier in this chain (e.g. a
  // mount-level guard before per-route protect), skip re-verifying. The tenant
  // context established by the first call is still active downstream.
  if (req.user || req.platformUser) {
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

      // ── Opérateur plateforme (PlatformUser) ──
      // Jetons émis par POST /api/platform-users/login : ils ne portent aucun
      // tenant et ne sont acceptés que là où `protectAny` est utilisé.
      if (decoded.platformUserId) {
        if (!allowPlatform) {
          return res.status(403).json({
            message: 'Jeton plateforme non autorisé sur cette route.',
            code: 'PLATFORM_SCOPE_ONLY',
          });
        }
        const platformUser = await PlatformUser.findById(decoded.platformUserId).select('-password');
        if (!platformUser) {
          return res.status(401).json({ message: 'Non autorisé. Session invalide.' });
        }
        if (platformUser.isActive === false) {
          return res.status(403).json({
            message: 'Votre compte a été désactivé. Veuillez contacter le super administrateur.',
            code: 'ACCOUNT_INACTIVE',
          });
        }
        req.platformUser = platformUser;
        return next();
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'Non autorisé. Session invalide.' });
      }

      // ── Révocation par version de jeton ──
      // Un jeton émis avant le dernier bump de tokenVersion est rejeté.
      if (
        decoded.ver !== undefined &&
        user.tokenVersion !== undefined &&
        Number(decoded.ver) !== Number(user.tokenVersion)
      ) {
        return res.status(401).json({
          message: 'Session révoquée. Veuillez vous reconnecter.',
          code: 'TOKEN_REVOKED',
        });
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

        const isPaymentOverdue =
          tenant.status === 'active' &&
          tenant.nextPaymentDue &&
          new Date() > new Date(tenant.nextPaymentDue);

        if (tenant.status === 'suspended' && !allowRestricted) {
          return res.status(403).json({
            message: 'Votre abonnement est suspendu. Veuillez contacter le support.',
            code: 'TENANT_SUSPENDED',
          });
        }

        if ((tenant.status === 'expired' || isTrialExpired) && !allowRestricted) {
          return res.status(403).json({
            message: "Votre periode d essai est terminee. Veuillez souscrire a un abonnement.",
            code: 'TENANT_EXPIRED',
            trialEndsAt: tenant.trialEndsAt,
          });
        }

        if (isPaymentOverdue && !allowRestricted) {
          const daysPastDue = Math.floor((new Date() - new Date(tenant.nextPaymentDue)) / (1000 * 60 * 60 * 24));
          return res.status(403).json({
            message: `Votre abonnement a expire il y a ${daysPastDue} jour(s). Payez pour reactiver votre boutique.`,
            code: 'PAYMENT_OVERDUE',
            nextPaymentDue: tenant.nextPaymentDue,
            daysPastDue,
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

const protect = authenticate(false);
// Same as protect, but suspended/expired shops are allowed through so they can
// reach the billing endpoints and reactivate by paying.
const protectForBilling = authenticate(true);

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

// Authentifie un utilisateur boutique OU un opérateur plateforme.
// À utiliser sur le control plane (platform-users, support admin…).
const protectAny = authenticate(false, { allowPlatform: true });

// Control plane : super-admin (compte User) OU opérateur plateforme habilité
// (rôle super-admin, permission `platform.manage` ou joker `*`).
const platformAdmin = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) return next();
  if (req.platformUser) {
    const perms = Array.isArray(req.platformUser.permissions) ? req.platformUser.permissions : [];
    if (req.platformUser.role === 'super-admin' || perms.includes('*') || perms.includes('platform.manage')) {
      return next();
    }
  }
  return res.status(403).json({ message: 'Réservé aux opérateurs plateforme autorisés.' });
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

// Résout la boutique active (Phase 2) : en-tête `X-Location-Id` validé dans
// l'organisation, sinon boutique par défaut (la plus ancienne active).
// Pose `req.locationId` pour que les créations soient rattachées au bon lieu.
const resolveLocation = asyncHandler(async (req, res, next) => {
  if (!req.tenantId) return next();
  const headerId = req.headers['x-location-id'];
  if (headerId) {
    const loc = await Location.findOne({
      tenantId: req.tenantId,
      _id: headerId,
      isActive: true,
    }).select('_id').lean();
    if (!loc) {
      return res.status(403).json({
        message: 'Boutique invalide pour cette organisation.',
        code: 'INVALID_LOCATION',
      });
    }
    req.locationId = loc._id;
    return next();
  }
  const defaultLocation = await Location.findOne({
    tenantId: req.tenantId,
    isActive: true,
  }).sort({ createdAt: 1 }).select('_id').lean();
  req.locationId = defaultLocation ? defaultLocation._id : null;
  next();
});

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

// RBAC (Phase 2) : vérifie la permission agrégée des rôles de la membership.
// Adaptateur legacy : isAdmin/isSuperAdmin continuent de passer (propriétaires
// historiques), le temps que toutes les routes migrent vers les permissions.
const requirePermission = (permission) => asyncHandler(async (req, res, next) => {
  if (req.user && (req.user.isAdmin || req.user.isSuperAdmin)) return next();
  if (!req.tenantId) {
    return res.status(403).json({ message: 'Aucune boutique active.', code: 'NO_TENANT_CONTEXT' });
  }
  const result = await authorize({
    tenantId: req.tenantId,
    userId: req.user ? req.user._id : null,
    permission,
    locationId: req.locationId || undefined,
  });
  if (!result.allowed) {
    return res.status(403).json({
      message: 'Permission insuffisante.',
      code: 'FORBIDDEN',
      reason: result.reason,
    });
  }
  next();
});

module.exports = { protect, protectForBilling, admin, superAdmin, requireTenant, adminOrPermission, protectAny, platformAdmin, resolveLocation, requirePermission };
