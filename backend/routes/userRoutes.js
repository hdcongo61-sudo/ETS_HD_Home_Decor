const express = require('express');
const router = express.Router();
const {
  loginUser,
  requestPasswordUpdate,
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
} = require('../controllers/userController');
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');

// Route de login
router.post('/login', loginUser);
router.post('/password-update-request', requestPasswordUpdate);

router.route('/')
  .get(protect, requireTenant, admin, getUsers);
router.post('/admin', protect, requireTenant, admin, imageUpload.single('photoFile'), createUserByAdmin);
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, imageUpload.single('photoFile'), updateMyProfile);

// Add this new route for login statistics
router.get('/login-stats', protect, requireTenant, admin, getLoginStats);
router.get('/login-activity/:id', protect, requireTenant, admin, getLoginActivity);
router.get('/me', protect, getCurrentUser);
router.get('/stats', protect, requireTenant, admin, getUserStats);
// Révoque toutes les sessions du compte courant (bump tokenVersion).
router.post('/logout-all', protect, revokeAllSessions);
// Sessions et MFA (Phase 0.8) — AVANT /:id pour éviter la capture.
router.get('/sessions', protect, listMySessions);
router.post('/sessions/:id/revoke', protect, revokeMySession);
router.post('/mfa/setup', protect, mfaSetup);
router.post('/mfa/verify', protect, mfaVerify);
router.post('/mfa/disable', protect, mfaDisable);
router.route('/:id').get(protect, requireTenant, getUserById);


router.delete('/:id', protect, requireTenant, admin, deleteUser);
router.put('/:id/toggle-active', protect, requireTenant, admin, toggleUserActive);
router.put('/:id', protect, requireTenant, admin, imageUpload.single('photoFile'), updateUser);


module.exports = router;
