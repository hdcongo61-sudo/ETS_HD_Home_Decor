const express = require('express');
const router = express.Router();
const { protect, requireTenant, requirePermission } = require('../middlewares/authMiddleware');
const { getMyMemberships, getTenantRoles, getMemberships } = require('../controllers/membershipController');

// Appartenances du compte courant (toutes organisations).
router.get('/me', protect, getMyMemberships);

// Rôles de l'organisation active.
router.get('/roles', protect, requireTenant, getTenantRoles);

// Gestion des appartenances (admin ou permission users.manage).
router.get('/', protect, requireTenant, requirePermission('users.manage'), getMemberships);

module.exports = router;
