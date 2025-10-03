const express = require('express');
const router = express.Router();
const {
  loginUser,
  registerUser,
  getUsers,
  getUserProfile,
  getCurrentUser,
  getUserStats,
  createUserByAdmin,
  deleteUser,
  updateUser,
  getUserById,
  getLoginStats,
  getLoginActivity
} = require('../controllers/userController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Route de login
router.post('/login', loginUser);

router.route('/')
  .post(registerUser)
  .get(protect, admin, getUsers);
router.post('/admin', protect, admin, createUserByAdmin);
router.route('/profile')
  .get(protect, getUserProfile);

// Add this new route for login statistics
router.get('/login-stats', protect, admin, getLoginStats);
router.get('/login-activity/:id', protect, admin, getLoginActivity);
router.get('/me', protect, getCurrentUser);
router.get('/stats', protect, admin, getUserStats);
router.route('/:id').get(protect, getUserById);


router.delete('/:id', protect, admin, deleteUser);
router.put('/:id', protect, admin, updateUser);


module.exports = router;
