const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');

const protect = asyncHandler(async (req, res, next) => {
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

      if (user.accessControlEnabled) {
        const now = new Date();
        const accessStart = user.accessStart ? new Date(user.accessStart) : null;
        const accessEnd = user.accessEnd ? new Date(user.accessEnd) : null;
        const beforeStart = accessStart && now < accessStart;
        const afterEnd = accessEnd && now > accessEnd;

        if (beforeStart || afterEnd) {
          return res.status(403).json({
            message: 'Accès restreint. Veuillez contacter un administrateur.',
            accessStart: accessStart ? accessStart.toISOString() : null,
            accessEnd: accessEnd ? accessEnd.toISOString() : null,
          });
        }
      }

      req.user = user;
      next();
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
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
};

module.exports = { protect, admin };
