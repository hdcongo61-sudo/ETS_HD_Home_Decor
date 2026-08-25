/**
 * Authorization — moteur RBAC (Phase 2.3).
 *
 * Adaptateur de compatibilité : les gardes `admin` historiques continuent de
 * s'appuyer sur `User.isAdmin` ; ce service permet de vérifier les permissions
 * agrégées des rôles d'une membership (avec périmètre de boutiques) pour les
 * nouvelles routes `/api/v2` et les futurs modules.
 */
const Membership = require('../models/membershipModel');
const Role = require('../models/roleModel');

// Crée (si absente) la membership de l'utilisateur : owner si isAdmin, staff sinon.
// Utilisé à la création d'utilisateurs pour que le RBAC reste complet en continu.
async function ensureMembershipForUser(tenantId, user) {
  const existing = await Membership.findOne({ tenantId, userId: user._id }).lean();
  if (existing) return existing;
  const key = user.isAdmin ? 'owner' : 'staff';
  let role = await Role.findOne({ tenantId, key }).lean();
  if (!role) {
    role = await Role.create({
      tenantId,
      key,
      name: key === 'owner' ? 'Propriétaire' : 'Vendeur',
      permissions: key === 'owner' ? ['*'] : [],
      isSystem: true,
    });
  }
  return Membership.create({
    tenantId,
    userId: user._id,
    status: 'active',
    roleIds: [role._id],
    allLocations: true,
  });
}

// Permissions agrégées de l'utilisateur dans l'organisation (ou rien).
async function getUserPermissions(tenantId, userId) {
  const membership = await Membership.findOne({
    tenantId,
    userId,
    status: 'active',
  }).lean();
  if (!membership) return { membership: null, permissions: [] };

  const roleIds = Array.isArray(membership.roleIds) ? membership.roleIds : [];
  const roles = roleIds.length
    ? await Role.find({ tenantId, _id: { $in: roleIds } }).lean()
    : [];
  const permissions = new Set();
  roles.forEach((role) => (role.permissions || []).forEach((p) => permissions.add(p)));
  if (permissions.has('*')) permissions.add('*');
  return { membership, permissions: [...permissions] };
}

/**
 * authorize({ tenantId, userId, permission, locationId })
 * → { allowed, reason?, permissions, membership }
 */
async function authorize({ tenantId, userId, permission, locationId }) {
  if (!tenantId || !userId) return { allowed: false, reason: 'missing-principal', permissions: [], membership: null };

  const { membership, permissions } = await getUserPermissions(tenantId, userId);
  if (!membership) return { allowed: false, reason: 'no-membership', permissions, membership: null };
  if (permissions.includes('*')) return { allowed: true, permissions, membership };
  if (permission && !permissions.includes(permission)) {
    return { allowed: false, reason: 'forbidden', permissions, membership };
  }
  if (locationId && !membership.allLocations) {
    const ids = (membership.locationIds || []).map((id) => String(id));
    if (!ids.includes(String(locationId))) {
      return { allowed: false, reason: 'location-out-of-scope', permissions, membership };
    }
  }
  return { allowed: true, permissions, membership };
}

module.exports = { getUserPermissions, authorize, ensureMembershipForUser };
