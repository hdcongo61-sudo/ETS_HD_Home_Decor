const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');
const generateToken = require('../utils/generateToken');
const LoginHistory = require('../models/loginHistoryModel');

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const user = userDoc.toObject ? userDoc.toObject({ virtuals: false }) : userDoc;
  const {
    password,
    loginAttempts,
    lockUntil,
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
    lastLogin: rest.lastLogin || null,
    lastModifiedBy: normalizeRef(rest.lastModifiedBy),
    lastModifiedAt: rest.lastModifiedAt || null,
    passwordModifiedBy: normalizeRef(rest.passwordModifiedBy),
    passwordModifiedAt: rest.passwordModifiedAt || null,
    accessControlEnabled: Boolean(rest.accessControlEnabled),
    accessStart: rest.accessStart || null,
    accessEnd: rest.accessEnd || null,
  };
};

const parseDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({})
    .select('-password -loginAttempts -lockUntil')
    .populate('lastModifiedBy', 'name email')
    .populate('passwordModifiedBy', 'name email')
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
      lastLogin: user.lastLogin || null,
      createdAt: user.createdAt
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, isAdmin, phone, accessControlEnabled, accessStart, accessEnd } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    isAdmin: isAdmin || false,
    phone: phone ? phone.trim() : '',
    accessControlEnabled: Boolean(accessControlEnabled),
    accessStart: parseDateOrNull(accessStart),
    accessEnd: parseDateOrNull(accessEnd),
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      isAdmin: user.isAdmin,
      lastLogin: user.lastLogin,
      token: generateToken(user._id)
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Authenticate user
// @route   POST /api/users/login
// @access  Public
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION_MINUTES = 15;
const ACCOUNT_LOCK_DURATION_MS = ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000;

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  // Get client information
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const device = req.headers['user-agent'] || 'Unknown device';

  if (user && user.lockUntil && user.lockUntil > Date.now()) {
    const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    await LoginHistory.create({
      user: user._id,
      ipAddress,
      device,
      success: false,
      attemptedEmail: email,
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

    if (user.accessControlEnabled) {
      const isAfterStart = !user.accessStart || now >= user.accessStart;
      const isBeforeEnd = !user.accessEnd || now <= user.accessEnd;

      if (!isAfterStart || !isBeforeEnd) {
        await LoginHistory.create({
          user: user._id,
          ipAddress,
          device,
          success: false,
          attemptedEmail: email,
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
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save({ validateBeforeSave: false });

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      isAdmin: user.isAdmin,
      lastLogin: user.lastLogin,
      token: generateToken(user._id)
    });
  }

  if (user) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    let statusCode = 401;
    let responsePayload = { message: 'Email ou mot de passe invalide' };
    let historyError = 'Email ou mot de passe invalide';

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
      attemptedEmail: email,
      error: historyError
    });

    return res.status(statusCode).json(responsePayload);
  }

  await LoginHistory.create({
    user: null,
    ipAddress,
    device,
    success: false,
    attemptedEmail: email,
    error: 'Utilisateur inconnu'
  });

  return res.status(401).json({ message: 'Email ou mot de passe invalide' });
});

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userObject = user.toObject();
    const { loginAttempts, lockUntil, ...safeUser } = userObject;
    res.json({
      ...safeUser,
      phone: safeUser.phone || '',
      lastLogin: safeUser.lastLogin || null,
      accessControlEnabled: Boolean(safeUser.accessControlEnabled),
      accessStart: safeUser.accessStart || null,
      accessEnd: safeUser.accessEnd || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private/Admin
const getUserStats = async (req, res) => {
  try {
    // Total users count
    const totalUsers = await User.countDocuments()

    // Active users (logged in last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo }
    })

    // Admin users count
    const admins = await User.countDocuments({ isAdmin: true })

    // Recent users (last 30 days)
    const recentUsers = await User.find({
      createdAt: { $gte: thirtyDaysAgo }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email phone isAdmin createdAt')
      .lean()

    res.json({
      totalUsers,
      activeUsers,
      admins,
      recentUsers
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Create user by admin
// @route   POST /api/users
// @access  Private/Admin
const createUserByAdmin = async (req, res) => {
  const { name, email, password, isAdmin, phone, accessControlEnabled, accessStart, accessEnd } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password, // Le mot de passe sera hashé par le middleware pre-save du modèle User
    isAdmin: isAdmin || false,
    phone: phone ? phone.trim() : '',
    accessControlEnabled: Boolean(accessControlEnabled),
    accessStart: parseDateOrNull(accessStart),
    accessEnd: parseDateOrNull(accessEnd),
  });

  const populatedUser = await User.findById(user._id)
    .select('-password -loginAttempts -lockUntil')
    .populate('lastModifiedBy', 'name email')
    .populate('passwordModifiedBy', 'name email');

  res.status(201).json(sanitizeUser(populatedUser));
};

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
const updateUser = async (req, res) => {
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
    if (typeof req.body.isAdmin !== 'undefined') {
      user.isAdmin = Boolean(req.body.isAdmin);
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

    if (req.body.password) {
      user.password = req.body.password;
    }

    const infoFields = ['name', 'email', 'phone', 'isAdmin', 'accessControlEnabled', 'accessStart', 'accessEnd'];
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

    res.json(sanitizeUser(populatedUser));
  } else {
    res.status(404);
    throw new Error('User not found');
  }
}
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

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


module.exports = {
  loginUser,
  getUsers,
  getUserProfile,
  registerUser,
  getCurrentUser,
  getUserStats,
  createUserByAdmin,
  deleteUser,
  updateUser,
  getUserById,
  getLoginStats,
  getLoginActivity
};
