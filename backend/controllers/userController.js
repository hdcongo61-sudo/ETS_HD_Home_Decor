const User = require('../models/userModel');
const Employee = require('../models/employeeModel');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const generateToken = require('../utils/generateToken');
const sessionService = require('../services/sessionService');
const mfaService = require('../services/mfaService');
const { ensureMembershipForUser } = require('../services/authorization');
const LoginHistory = require('../models/loginHistoryModel');
const AdminRequest = require('../models/adminRequestModel');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');
const { resolveTenantFeatures } = require('../config/features');

const uploadUserPhoto = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'users',
      resource_type: 'image',
      format: 'webp',
      quality: 'auto:good',
    },
    (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result.secure_url);
    }
  );

  streamifier.createReadStream(buffer).pipe(stream);
});

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const user = userDoc.toObject ? userDoc.toObject({ virtuals: false }) : userDoc;
  const {
    password,
    loginAttempts,
    __v,
    ...rest
  } = user;

  const normalizedId = rest._id?.toString ? rest._id.toString() : rest._id;

  const normalizeRef = (ref) => {
    if (!ref) return null;
    if (ref._id) {
      return {
        _id: ref._id.toString ? ref._id.toString() : ref._id,
        name: ref.name || null,
        email: ref.email || null,
      };
    }
    const refId = typeof ref === 'string' ? ref : ref.toString?.();
    return {
      _id: refId,
      name: null,
      email: null,
    };
  };

  return {
    ...rest,
    _id: normalizedId,
    phone: rest.phone || '',
    employee: rest.employee ? {
      _id: rest.employee._id?.toString ? rest.employee._id.toString() : rest.employee.toString?.() || rest.employee,
      name: rest.employee.name || null,
      email: rest.employee.email || null,
      phone: rest.employee.phone || null,
      position: rest.employee.position || null,
      isActive: rest.employee.isActive !== false,
    } : null,
    permissions: Array.isArray(rest.permissions) ? rest.permissions : [],
    lastLogin: rest.lastLogin || null,
    lastActivity: rest.lastActivity || null,
    lockUntil: rest.lockUntil || null,
    lastModifiedBy: normalizeRef(rest.lastModifiedBy),
    lastModifiedAt: rest.lastModifiedAt || null,
    passwordModifiedBy: normalizeRef(rest.passwordModifiedBy),
    passwordModifiedAt: rest.passwordModifiedAt || null,
    isActive: rest.isActive !== false,
    accessControlEnabled: Boolean(rest.accessControlEnabled),
    accessStart: rest.accessStart || null,
    accessEnd: rest.accessEnd || null,
    salesGoals: {
      monthlyRevenueTarget: Number(rest.salesGoals?.monthlyRevenueTarget) || 0,
      monthlyProfitTarget: Number(rest.salesGoals?.monthlyProfitTarget) || 0,
      monthlyCollectionTarget: Number(rest.salesGoals?.monthlyCollectionTarget) || 0,
      updatedAt: rest.salesGoals?.updatedAt || null,
    },
    adminPreferences: {
      weeklyReportEnabled: Boolean(rest.adminPreferences?.weeklyReportEnabled),
      weeklyReportFormat:
        rest.adminPreferences?.weeklyReportFormat === 'pdf' ? 'pdf' : 'excel',
      inactivityAlertsEnabled:
        typeof rest.adminPreferences?.inactivityAlertsEnabled === 'boolean'
          ? rest.adminPreferences.inactivityAlertsEnabled
          : true,
      collectionAlertsEnabled:
        typeof rest.adminPreferences?.collectionAlertsEnabled === 'boolean'
          ? rest.adminPreferences.collectionAlertsEnabled
          : true,
      manualSaleDateEnabled:
        typeof rest.adminPreferences?.manualSaleDateEnabled === 'boolean'
          ? rest.adminPreferences.manualSaleDateEnabled
          : false,
      manualExpenseDateEnabled:
        typeof rest.adminPreferences?.manualExpenseDateEnabled === 'boolean'
          ? rest.adminPreferences.manualExpenseDateEnabled
          : false,
      manualPaymentDateEnabled:
        typeof rest.adminPreferences?.manualPaymentDateEnabled === 'boolean'
          ? rest.adminPreferences.manualPaymentDateEnabled
          : false,
      weeklyReportLastSentAt: rest.adminPreferences?.weeklyReportLastSentAt || null,
    },
  };
};

const parseDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parsePositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

const ALLOWED_PERMISSIONS = new Set([
  'view_sensitive_financials',
  'view_supplier_contacts',
  'approve_admin_requests',
]);

const normalizePermissions = (value) => {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (error) {
      raw = raw.split(',');
    }
  }

  if (!Array.isArray(raw)) return [];

  return [...new Set(
    raw
      .map((permission) => String(permission || '').trim())
      .filter((permission) => ALLOWED_PERMISSIONS.has(permission))
  )];
};

const resolveEmployeeLink = async ({ employeeId, tenantId, userId = null }) => {
  if (employeeId === undefined) return undefined;
  if (!employeeId) return null;
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    const error = new Error('Employé invalide.');
    error.statusCode = 400;
    throw error;
  }
  const employee = await Employee.findOne({ _id: employeeId, tenantId });
  if (!employee) {
    const error = new Error("Cet employé n'existe pas dans cette boutique.");
    error.statusCode = 400;
    throw error;
  }
  const alreadyLinked = await User.findOne({
    tenantId,
    employee: employee._id,
    ...(userId ? { _id: { $ne: userId } } : {}),
  }).select('_id name');
  if (alreadyLinked) {
    const error = new Error(`Cet employé est déjà associé au compte ${alreadyLinked.name}.`);
    error.statusCode = 409;
    throw error;
  }
  return employee._id;
};

// @desc    Get all users (tenant-scoped)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const filter = req.user.isSuperAdmin ? {} : { tenantId: req.tenantId };
  const users = await User.find(filter)
    .select('-password -loginAttempts')
    .populate('lastModifiedBy', 'name email')
    .populate('passwordModifiedBy', 'name email')
    .populate('employee', 'name email phone position isActive')
    .lean();

  res.json(users.map(sanitizeUser));
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      isAdmin: user.isAdmin,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      photo: user.photo || '',
      lastLogin: user.lastLogin || null,
      createdAt: user.createdAt
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update the logged-in user's own profile (photo, name). Works for any
//          authenticated user, including the super-admin.
// @route   PUT /api/users/profile
// @access  Private
const updateMyProfile = asyncHandler(async (req, res) => {
  // Phase 0.1: Security - reject client-supplied privilege escalation fields
  if (req.body.isAdmin !== undefined) {
    res.status(403);
    throw new Error('Cannot modify isAdmin field');
  }
  if (req.body.isSuperAdmin !== undefined) {
    res.status(403);
    throw new Error('Cannot modify isSuperAdmin field');
  }
  if (req.body.tenantId !== undefined) {
    res.status(403);
    throw new Error('Cannot modify tenantId field');
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (req.file?.buffer) {
    user.photo = await uploadUserPhoto(req.file.buffer);
  } else if (typeof req.body.photo === 'string') {
    user.photo = req.body.photo; // allow clearing (empty string) or setting a URL
  }
  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    user.name = req.body.name.trim();
  }

  await user.save();

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin || false,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    photo: user.photo || '',
  });
});

// @desc    Authenticate user (by email or phone)
// @route   POST /api/users/login
// @access  Public
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION_MINUTES = 15;
const ACCOUNT_LOCK_DURATION_MS = ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000;

const normalizePhoneToDigits = (value) => (value || '').replace(/\D/g, '');

/** Normalize for comparison: digits only, then strip leading 0 so 07... and 7... match */
const normalizePhoneForMatch = (value) => {
  const digits = normalizePhoneToDigits(value);
  if (digits.length >= 10 && digits[0] === '0') return digits.slice(1);
  return digits;
};

const findUsersByPhone = async (phoneInput) => {
  const inputNorm = normalizePhoneForMatch(phoneInput);
  if (inputNorm.length < 8) return [];
  const inputDigits = normalizePhoneToDigits(phoneInput);
  const users = await User.find({ phone: { $exists: true, $ne: '' } });
  return users.filter((u) => {
    const stored = u.phone || '';
    const storedNorm = normalizePhoneForMatch(stored);
    const storedDigits = normalizePhoneToDigits(stored);
    return storedNorm.length >= 8 && (storedNorm === inputNorm || storedDigits === inputDigits);
  });
};

const findUserByPhone = async (phoneInput) => {
  const matches = await findUsersByPhone(phoneInput);
  return matches[0] || null;
};

const loginUser = asyncHandler(async (req, res) => {
  let { email, phone, password } = req.body;
  const login = typeof req.body.login === 'string' ? req.body.login.trim() : '';
  if (login.length > 0 && !email && !phone) {
    if (login.includes('@')) {
      email = login;
    } else {
      phone = login;
    }
  }
  const phoneStr = typeof phone === 'string' ? phone.trim() : '';
  const emailStr = typeof email === 'string' ? email.trim() : '';
  const loginByPhone = phoneStr.length > 0;

  if (!password) {
    return res.status(400).json({ message: 'Mot de passe requis.' });
  }
  if (!loginByPhone && !emailStr) {
    return res.status(400).json({ message: 'Téléphone ou email requis.' });
  }

  let user = null;
  let candidates = [];
  if (loginByPhone) {
    candidates = await findUsersByPhone(phoneStr);
  }
  if (candidates.length === 0 && emailStr) {
    candidates = await User.find({ email: emailStr });
  }

  if (candidates.length === 1) {
    user = candidates[0];
  } else if (candidates.length > 1) {
    // Même email/téléphone dans plusieurs boutiques : exiger le code boutique.
    const tenantCodeInput = String(req.body.tenantCode || req.body.shopCode || '').trim();
    if (!tenantCodeInput) {
      const tenantIds = [...new Set(candidates.map((c) => c.tenantId).filter(Boolean))];
      const Tenant = require('../models/tenantModel');
      const tenants = tenantIds.length
        ? await Tenant.find({ _id: { $in: tenantIds } }).select('code name').lean()
        : [];
      return res.status(409).json({
        message: 'Plusieurs boutiques utilisent cet identifiant. Ajoutez votre code boutique pour vous connecter.',
        code: 'TENANT_SELECTION_REQUIRED',
        availableTenants: tenants.map((t) => ({ code: t.code, name: t.name })),
      });
    }
    const Tenant = require('../models/tenantModel');
    const tenant = await Tenant.findOne({
      $or: [{ code: tenantCodeInput.toUpperCase() }, { slug: tenantCodeInput.toLowerCase() }],
    }).select('_id').lean();
    if (!tenant) {
      return res.status(400).json({ message: 'Code boutique inconnu.' });
    }
    user = candidates.find((c) => c.tenantId && String(c.tenantId) === String(tenant._id)) || null;
    if (!user) {
      return res.status(400).json({ message: 'Aucun compte avec cet identifiant dans cette boutique.' });
    }
  }

  // Get client information
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const device = req.headers['user-agent'] || 'Unknown device';

  const attemptedIdentifier = loginByPhone ? { attemptedPhone: phoneStr } : { attemptedEmail: emailStr };

  if (user && user.lockUntil && user.lockUntil > Date.now()) {
    const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    await LoginHistory.create({
      user: user._id,
      ipAddress,
      device,
      success: false,
      ...attemptedIdentifier,
      error: 'Compte verrouillé temporairement'
    });

    return res.status(423).json({
      message: `Compte temporairement verrouillé. Réessayez dans ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
      lockUntil: user.lockUntil.getTime(),
    });
  }

  if (user && user.lockUntil && user.lockUntil <= Date.now()) {
    user.lockUntil = null;
    user.loginAttempts = 0;
    await user.save({ validateBeforeSave: false });
  }

  if (user && (await user.matchPassword(password))) {
    const now = new Date();

    if (user.isActive === false) {
      await LoginHistory.create({
        user: user._id,
        ipAddress,
        device,
        success: false,
        ...attemptedIdentifier,
        error: 'Compte désactivé'
      });
      return res.status(403).json({
        message: 'Votre compte a été désactivé. Veuillez contacter un administrateur.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    if (user.accessControlEnabled) {
      const isAfterStart = !user.accessStart || now >= user.accessStart;
      const isBeforeEnd = !user.accessEnd || now <= user.accessEnd;

      if (!isAfterStart || !isBeforeEnd) {
        await LoginHistory.create({
          user: user._id,
          ipAddress,
          device,
          success: false,
          ...attemptedIdentifier,
          error: 'Accès refusé (fenêtre de connexion)'
        });

        return res.status(403).json({
          message: 'Cet utilisateur n\'est pas autorisé à se connecter pour le moment.',
          accessStart: user.accessStart ? user.accessStart.toISOString() : null,
          accessEnd: user.accessEnd ? user.accessEnd.toISOString() : null,
        });
      }
    }

    await LoginHistory.create({
      user: user._id,
      ipAddress,
      device,
      success: true
    });

    user.lastLogin = now;
    user.lastActivity = now;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save({ validateBeforeSave: false });

    // Phase 0.8 : enregistrer la session (appareil/IP, tokenVersion).
    await sessionService.recordSession({
      kind: 'user',
      userId: user._id,
      tenantId: user.tenantId || null,
      device,
      ip: ipAddress,
      userAgent: device,
      tokenVersion: user.tokenVersion ?? 0,
    });

    // Keep tenant lastActiveAt fresh (fire-and-forget)
    if (user.tenantId) {
      const Tenant = require('../models/tenantModel');
      Tenant.findByIdAndUpdate(user.tenantId, { 'stats.lastActiveAt': now }, { timestamps: false })
        .catch(() => {});
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin || false,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      photo: user.photo || '',
      lastLogin: user.lastLogin,
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      token: generateToken(user._id, user.tenantId, { tokenVersion: user.tokenVersion ?? 0 }),
    });
  }

  if (user) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    let statusCode = 401;
    const invalidMessage = loginByPhone ? 'Téléphone ou mot de passe invalide' : 'Email ou mot de passe invalide';
    let responsePayload = { message: invalidMessage };
    let historyError = invalidMessage;

    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
      user.loginAttempts = 0;
      statusCode = 423;
      responsePayload = {
        message: `Compte temporairement verrouillé. Réessayez dans ${ACCOUNT_LOCK_DURATION_MINUTES} minutes`,
        lockUntil: user.lockUntil.getTime(),
      };
      historyError = 'Compte verrouillé après trop de tentatives';
    }

    await user.save({ validateBeforeSave: false });

    await LoginHistory.create({
      user: user._id,
      ipAddress,
      device,
      success: false,
      ...attemptedIdentifier,
      error: historyError
    });

    return res.status(statusCode).json(responsePayload);
  }

  await LoginHistory.create({
    user: null,
    ipAddress,
    device,
    success: false,
    ...attemptedIdentifier,
    error: 'Utilisateur inconnu'
  });

  const invalidMessage = loginByPhone ? 'Téléphone ou mot de passe invalide' : 'Email ou mot de passe invalide';
  return res.status(401).json({ message: invalidMessage });
});

// @desc    Request a password update from the login screen
// @route   POST /api/users/password-update-request
// @access  Public
const requestPasswordUpdate = asyncHandler(async (req, res) => {
  const login = String(req.body.login || '').trim();
  const reason = String(req.body.reason || '').trim();

  if (!login) {
    return res.status(400).json({ message: 'Téléphone ou email requis.' });
  }

  if (!reason) {
    return res.status(400).json({ message: 'Expliquez pourquoi vous ne pouvez pas vous connecter.' });
  }

  if (reason.length > 1000) {
    return res.status(400).json({ message: 'La raison ne peut pas dépasser 1000 caractères.' });
  }

  let user = null;
  if (login.includes('@')) {
    user = await User.findOne({ email: login });
  } else {
    user = await findUserByPhone(login);
  }

  if (!user) {
    return res.status(404).json({ message: 'Aucun utilisateur trouvé avec cet identifiant.' });
  }

  const existingPending = await AdminRequest.findOne({
    type: 'user.password_update',
    requestedBy: user._id,
    status: 'pending',
  });

  if (existingPending) {
    return res.status(200).json({
      message: 'Une demande est déjà en attente. Un administrateur doit la traiter.',
    });
  }

  await AdminRequest.create({
    type: 'user.password_update',
    reason,
    note: `Demande envoyée depuis la page de connexion. Identifiant utilisé: ${login}`,
    targetModel: 'User',
    targetId: user._id,
    targetLabel: user.name || user.email || user.phone || 'Utilisateur',
    metadata: {
      login,
      email: user.email || '',
      phone: user.phone || '',
      requestSource: 'login',
    },
    requestedBy: user._id,
  });

  res.status(201).json({
    message: 'Demande envoyée. Un administrateur recevra le rappel et pourra mettre à jour votre mot de passe.',
  });
});

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload = sanitizeUser(user);

    // Expose the shop's subscription state so the UI can show a trial countdown.
    if (req.tenant) {
      const t = req.tenant;
      let daysLeft = null;
      if (t.status === 'trial' && t.trialEndsAt) {
        daysLeft = Math.ceil((new Date(t.trialEndsAt) - new Date()) / 86400000);
      }

      // Congratulate the shop once per renewal payment (PawaPay or cash), the
      // first time anyone from the shop connects after it clears.
      let renewalCongrats = null;
      if (
        t.status === 'active' &&
        t.lastPaymentAt &&
        (!t.lastPaymentNotifiedAt || new Date(t.lastPaymentNotifiedAt) < new Date(t.lastPaymentAt))
      ) {
        const lastPayment = Array.isArray(t.payments) && t.payments.length
          ? t.payments[t.payments.length - 1]
          : null;
        renewalCongrats = {
          lastPaymentAt: t.lastPaymentAt,
          nextPaymentDue: t.nextPaymentDue || null,
          amount: lastPayment?.amount || null,
        };
        const Tenant = require('../models/tenantModel');
        Tenant.findByIdAndUpdate(t._id, { lastPaymentNotifiedAt: t.lastPaymentAt }).catch(() => {});
      }

      payload.tenant = {
        name: t.name || '',
        plan: t.plan || 'trial',
        status: t.status || 'trial',
        features: await resolveTenantFeatures(t),
        dialCode: t.dialCode || '',
        trialEndsAt: t.trialEndsAt || null,
        trialDaysLeft: daysLeft,
        planRequest: t.planRequest && t.planRequest.status ? {
          requestedPlan: t.planRequest.requestedPlan,
          status: t.planRequest.status,
          requestedAt: t.planRequest.requestedAt,
        } : null,
        renewalCongrats,
      };
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private/Admin
const getUserStats = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const connectedThreshold = new Date(now.getTime() - 15 * 60 * 1000);

    const dormantFilter = {
      $or: [
        { lastLogin: null, createdAt: { $lt: thirtyDaysAgo } },
        { lastLogin: { $lt: thirtyDaysAgo } }
      ]
    };

    const [
      totalUsers,
      activeUsers,
      admins,
      lockedUsers,
      accessControlledUsers,
      connectedNow,
      dormantUsers,
      newUsersThisWeek,
      recentUsers,
      latestLoginUser
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ isAdmin: true }),
      User.countDocuments({ lockUntil: { $gt: now } }),
      User.countDocuments({ accessControlEnabled: true }),
      User.countDocuments({ lastLogin: { $gte: connectedThreshold } }),
      User.countDocuments(dormantFilter),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.find({ createdAt: { $gte: thirtyDaysAgo } })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('name email phone isAdmin createdAt lastLogin lastActivity accessControlEnabled')
        .lean(),
      User.findOne({ lastLogin: { $ne: null } })
        .sort({ lastLogin: -1 })
        .select('name email lastLogin')
        .lean()
    ]);

    res.json({
      totalUsers,
      activeUsers,
      admins,
      standardUsers: Math.max(totalUsers - admins, 0),
      lockedUsers,
      accessControlledUsers,
      connectedNow,
      dormantUsers,
      newUsersThisWeek,
      recentUsers,
      latestLoginUser: latestLoginUser || null
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Create user by admin
// @route   POST /api/users
// @access  Private/Admin
const createUserByAdmin = asyncHandler(async (req, res) => {
  // Phase 0.1: Security - reject client-supplied privilege escalation fields
  if (req.body.isSuperAdmin !== undefined) {
    res.status(400);
    throw new Error('Cannot set isSuperAdmin field');
  }
  if (req.body.tenantId !== undefined) {
    res.status(400);
    throw new Error('Cannot set tenantId field');
  }

  const { name, email, password, isActive, phone, accessControlEnabled, accessStart, accessEnd } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  let photoUrl = req.body.photo;
  if (req.file?.buffer) {
    photoUrl = await uploadUserPhoto(req.file.buffer);
  }

  const employee = await resolveEmployeeLink({ employeeId: req.body.employee, tenantId: req.tenantId });
  const user = await User.create({
    tenantId: req.tenantId || null,
    name,
    email,
    password, // Le mot de passe sera hashé par le middleware pre-save du modèle User
    isAdmin: false, // Phase 0.1: Never accept client-supplied isAdmin
    isActive: isActive !== false,
    permissions: normalizePermissions(req.body.permissions),
    phone: phone ? phone.trim() : '',
    accessControlEnabled: Boolean(accessControlEnabled),
    accessStart: parseDateOrNull(accessStart),
    accessEnd: parseDateOrNull(accessEnd),
    photo: photoUrl || '',
    employee: employee || null,
  });

  // RBAC : membership automatique (owner si admin, staff sinon).
  if (user.tenantId) {
    await ensureMembershipForUser(user.tenantId, user).catch((err) => {
      console.error('Erreur création membership:', err.message);
    });
  }

  const populatedUser = await User.findById(user._id)
    .select('-password -loginAttempts -lockUntil')
    .populate('lastModifiedBy', 'name email')
    .populate('passwordModifiedBy', 'name email');
  await populatedUser.populate('employee', 'name email phone position isActive');

  res.status(201).json(sanitizeUser(populatedUser));
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    // Vérifier qu'on ne supprime pas le dernier admin
    if (user.isAdmin) {
      const adminCount = await User.countDocuments({ isAdmin: true });
      if (adminCount <= 1) {
        res.status(400);
        throw new Error('Cannot delete the last admin');
      }
    }

    await user.deleteOne();
    res.json({ message: 'User removed' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
}

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  // Phase 0.1: Security - reject client-supplied privilege escalation fields
  if (req.body.isAdmin !== undefined) {
    res.status(403);
    throw new Error('Cannot modify isAdmin field');
  }
  if (req.body.isSuperAdmin !== undefined) {
    res.status(400);
    throw new Error('Cannot modify isSuperAdmin field');
  }
  if (req.body.tenantId !== undefined) {
    res.status(400);
    throw new Error('Cannot modify tenantId field');
  }

  const user = await User.findById(req.params.id);

  if (user) {
    if (typeof req.body.name !== 'undefined') {
      user.name = req.body.name;
    }
    if (typeof req.body.email !== 'undefined') {
      user.email = req.body.email;
    }
    if (typeof req.body.phone !== 'undefined') {
      user.phone = req.body.phone ? req.body.phone.trim() : '';
    }
    if (typeof req.body.employee !== 'undefined') {
      user.employee = await resolveEmployeeLink({
        employeeId: req.body.employee,
        tenantId: user.tenantId || req.tenantId,
        userId: user._id,
      });
    }
    if (typeof req.body.isActive !== 'undefined') {
      user.isActive = Boolean(req.body.isActive);
    }
    if (typeof req.body.permissions !== 'undefined') {
      user.permissions = normalizePermissions(req.body.permissions);
    }
    if (typeof req.body.accessControlEnabled !== 'undefined') {
      user.accessControlEnabled = Boolean(req.body.accessControlEnabled);
    }
    if (typeof req.body.accessStart !== 'undefined') {
      user.accessStart = parseDateOrNull(req.body.accessStart);
    }
    if (typeof req.body.accessEnd !== 'undefined') {
      user.accessEnd = parseDateOrNull(req.body.accessEnd);
    }

    if (req.body.salesGoals && typeof req.body.salesGoals === 'object') {
      user.salesGoals = {
        monthlyRevenueTarget: parsePositiveNumber(
          req.body.salesGoals.monthlyRevenueTarget,
          user.salesGoals?.monthlyRevenueTarget || 0
        ),
        monthlyProfitTarget: parsePositiveNumber(
          req.body.salesGoals.monthlyProfitTarget,
          user.salesGoals?.monthlyProfitTarget || 0
        ),
        monthlyCollectionTarget: parsePositiveNumber(
          req.body.salesGoals.monthlyCollectionTarget,
          user.salesGoals?.monthlyCollectionTarget || 0
        ),
        updatedAt: new Date(),
      };
    }

    if (req.body.adminPreferences && typeof req.body.adminPreferences === 'object') {
      user.adminPreferences = {
        weeklyReportEnabled:
          typeof req.body.adminPreferences.weeklyReportEnabled === 'boolean'
            ? req.body.adminPreferences.weeklyReportEnabled
            : Boolean(user.adminPreferences?.weeklyReportEnabled),
        weeklyReportFormat:
          req.body.adminPreferences.weeklyReportFormat === 'pdf' ? 'pdf' : 'excel',
        inactivityAlertsEnabled:
          typeof req.body.adminPreferences.inactivityAlertsEnabled === 'boolean'
            ? req.body.adminPreferences.inactivityAlertsEnabled
            : typeof user.adminPreferences?.inactivityAlertsEnabled === 'boolean'
              ? user.adminPreferences.inactivityAlertsEnabled
              : true,
        collectionAlertsEnabled:
          typeof req.body.adminPreferences.collectionAlertsEnabled === 'boolean'
            ? req.body.adminPreferences.collectionAlertsEnabled
            : typeof user.adminPreferences?.collectionAlertsEnabled === 'boolean'
              ? user.adminPreferences.collectionAlertsEnabled
              : true,
        manualSaleDateEnabled:
          typeof req.body.adminPreferences.manualSaleDateEnabled === 'boolean'
            ? req.body.adminPreferences.manualSaleDateEnabled
            : typeof user.adminPreferences?.manualSaleDateEnabled === 'boolean'
              ? user.adminPreferences.manualSaleDateEnabled
              : false,
        manualExpenseDateEnabled:
          typeof req.body.adminPreferences.manualExpenseDateEnabled === 'boolean'
            ? req.body.adminPreferences.manualExpenseDateEnabled
            : typeof user.adminPreferences?.manualExpenseDateEnabled === 'boolean'
              ? user.adminPreferences.manualExpenseDateEnabled
              : false,
        manualPaymentDateEnabled:
          typeof req.body.adminPreferences.manualPaymentDateEnabled === 'boolean'
            ? req.body.adminPreferences.manualPaymentDateEnabled
            : typeof user.adminPreferences?.manualPaymentDateEnabled === 'boolean'
              ? user.adminPreferences.manualPaymentDateEnabled
              : false,
        weeklyReportLastSentAt:
          parseDateOrNull(req.body.adminPreferences.weeklyReportLastSentAt) ||
          user.adminPreferences?.weeklyReportLastSentAt ||
          null,
      };
    }

    if (req.body.password) {
      user.password = req.body.password;
    }

    const hasPhotoField = Object.prototype.hasOwnProperty.call(req.body, 'photo');
    if (req.file?.buffer) {
      user.photo = await uploadUserPhoto(req.file.buffer);
    } else if (hasPhotoField) {
      user.photo = req.body.photo || '';
    }

    const infoFields = [
      'name',
      'email',
      'phone',
      'employee',
      'isAdmin',
      'permissions',
      'accessControlEnabled',
      'accessStart',
      'accessEnd',
      'photo',
      'salesGoals',
      'adminPreferences',
    ];
    const infoChanged = infoFields.some((field) => user.isModified(field));
    const passwordChanged = user.isModified('password');

    if (infoChanged) {
      user.lastModifiedBy = req.user._id;
      user.lastModifiedAt = new Date();
    }

    if (passwordChanged) {
      user.passwordModifiedBy = req.user._id;
      user.passwordModifiedAt = new Date();
    }

    await user.save();

    const populatedUser = await User.findById(user._id)
      .select('-password -loginAttempts -lockUntil')
      .populate('lastModifiedBy', 'name email')
      .populate('passwordModifiedBy', 'name email');
    await populatedUser.populate('employee', 'name email phone position isActive');

    res.json(sanitizeUser(populatedUser));
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password')
    .populate('employee', 'name email phone position isActive');

  if (user) {
    // Vérifier que l'utilisateur est admin ou accède à son propre profil
    if (req.user.isAdmin || req.user._id.toString() === user._id.toString()) {
      const userObject = user.toObject();
      res.json({
        ...userObject,
        phone: userObject.phone || '',
      });
    } else {
      res.status(403);
      throw new Error('Not authorized to access this user');
    }
  } else {
    res.status(404);
    throw new Error('User not found');
  }
})

// @desc    Get login statistics
// @route   GET /api/users/login-stats
// @access  Private/Admin
const getLoginStats = asyncHandler(async (req, res) => {
  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Execute all queries in parallel
    const [totalLogins, successfulLogins, failedLogins, recentLogins] = await Promise.all([
      LoginHistory.countDocuments(),
      LoginHistory.countDocuments({
        success: true,
        createdAt: { $gte: thirtyDaysAgo }
      }),
      LoginHistory.countDocuments({
        success: false,
        createdAt: { $gte: thirtyDaysAgo }
      }),
      LoginHistory.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'name email phone')
        .lean()
        .select('user ipAddress device success attemptedEmail createdAt')
    ]);

    res.json({
      totalLogins,
      successfulLogins,
      failedLogins,
      recentLogins
    });
  } catch (error) {
    console.error('Login stats error:', error);
    res.status(500).json({
      message: 'Server error while fetching login statistics',
      error: error.message
    });
  }
});

// @desc    Get single login activity
// @route   GET /api/users/login-activity/:id
// @access  Private/Admin
const getLoginActivity = asyncHandler(async (req, res) => {
  try {
    const activity = await LoginHistory.findById(req.params.id)
      .populate('user', 'name email isAdmin')
      .lean();

    if (!activity) {
      res.status(404);
      throw new Error('Activité de connexion non trouvée');
    }

    res.json(activity);
  } catch (error) {
    res.status(500);
    throw new Error("Échec de la récupération de l'activité de connexion");
  }
});

// @desc    Toggle user active/inactive status (admin only)
// @route   PUT /api/users/:id/toggle-active
// @access  Private/Admin
const toggleUserActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  // Prevent admin from deactivating themselves
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('Vous ne pouvez pas désactiver votre propre compte');
  }

  user.isActive = !user.isActive;
  user.lastModifiedBy = req.user._id;
  user.lastModifiedAt = new Date();

  const updatedUser = await user.save({ validateBeforeSave: false });
  const sanitized = sanitizeUser(updatedUser);

  res.json({
    success: true,
    message: user.isActive ? 'Compte activé avec succès' : 'Compte désactivé avec succès',
    user: sanitized,
  });
});


// @desc    Révoque toutes les sessions du compte courant (bump tokenVersion)
// @route   POST /api/users/logout-all
// @access  Private
const revokeAllSessions = asyncHandler(async (req, res) => {
  await sessionService.revokeAllForUser({ kind: 'user', userId: req.user._id });
  const user = await User.findById(req.user._id).select('tokenVersion').lean();
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  res.json({
    message: 'Toutes les sessions ont été révoquées.',
    tokenVersion: user.tokenVersion,
    mustReLogin: true,
  });
});

// ── Sessions (Phase 0.8) ──
// @route   GET /api/users/sessions
const listMySessions = asyncHandler(async (req, res) => {
  const sessions = await sessionService.listSessions({ kind: 'user', userId: req.user._id });
  res.json(sessions);
});

// @route   POST /api/users/sessions/:id/revoke
const revokeMySession = asyncHandler(async (req, res) => {
  await sessionService.revokeSession({ kind: 'user', userId: req.user._id, sessionId: req.params.id });
  res.json({ revoked: true });
});

// ── MFA TOTP (Phase 0.8) ──
// @route   POST /api/users/mfa/setup
const mfaSetup = asyncHandler(async (req, res) => {
  const setup = mfaService.setup(req.user.email);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { mfaSecret: setup.secret, mfaEnabled: false } },
    { new: true, select: '+mfaSecret' }
  );
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  res.json({ secret: setup.secret, otpauthUrl: setup.otpauthUrl });
});

// @route   POST /api/users/mfa/verify
const mfaVerify = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ message: 'Code requis.' });
  const user = await User.findById(req.user._id).select('+mfaSecret').lean();
  if (!user || !user.mfaSecret || !mfaService.verifyCode(user.mfaSecret, code)) {
    return res.status(400).json({ message: 'Code MFA invalide.' });
  }
  await User.updateOne({ _id: req.user._id }, { $set: { mfaEnabled: true } });
  res.json({ mfaEnabled: true });
});

// @route   POST /api/users/mfa/disable
const mfaDisable = asyncHandler(async (req, res) => {
  const password = String(req.body.password || '');
  if (!password || !(await req.user.matchPassword(password))) {
    return res.status(401).json({ message: 'Mot de passe invalide.' });
  }
  await User.updateOne({ _id: req.user._id }, { $set: { mfaEnabled: false, mfaSecret: null } });
  res.json({ mfaEnabled: false });
});

module.exports = {
  loginUser,requestPasswordUpdate,
  getUsers,
  getUserProfile,
  updateMyProfile,
  getCurrentUser,
  getUserStats,
  createUserByAdmin,
  deleteUser,
  updateUser,
  getUserById,
  getLoginStats,
  getLoginActivity,
  toggleUserActive,
  revokeAllSessions,
  listMySessions,
  revokeMySession,
  mfaSetup,
  mfaVerify,
  mfaDisable
};
