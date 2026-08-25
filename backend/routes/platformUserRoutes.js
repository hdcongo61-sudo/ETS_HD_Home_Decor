const express = require('express');
const router = express.Router();
const { protectAny, platformAdmin } = require('../middlewares/authMiddleware');
const {
  getAllPlatformUsers,
  createPlatformUser,
  updatePlatformUser,
  deletePlatformUser,
  sendEmailToUsers,
  loginPlatformUser,
} = require('../controllers/platformUserController');

// Connexion opérateur plateforme (public) — déclarée avant le garde global.
router.post('/login', loginPlatformUser);

// Le reste exige un super-admin (compte User) OU un opérateur plateforme habilité.
router.use(protectAny, platformAdmin);

// GET /api/platform-users - Get all platform users
router.get('/', getAllPlatformUsers);

// POST /api/platform-users - Create a new platform user with specific roles
router.post('/', createPlatformUser);

// PATCH /api/platform-users/:userId - Update user role and permissions
router.patch('/:userId', updatePlatformUser);

// DELETE /api/platform-users/:userId - Delete a platform user
router.delete('/:userId', deletePlatformUser);

// POST /api/platform-users/send-email - Send email to multiple users
router.post('/send-email', sendEmailToUsers);

module.exports = router;
