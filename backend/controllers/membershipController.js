const Membership = require('../models/membershipModel');
const Role = require('../models/roleModel');
const { tenantFilter } = require('../utils/tenantQuery');
const { getUserPermissions } = require('../services/authorization');

// @desc    Appartenances de l'organisation courante (gestion)
// @route   GET /api/memberships
// @access  Admin / permission users.manage
const getMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find(tenantFilter(req))
      .populate('userId', 'name email isAdmin')
      .populate('roleIds', 'key name')
      .lean();
    res.json(memberships);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Appartenances de l'utilisateur courant (avec rôles et permissions)
// @route   GET /api/memberships/me
// @access  Private
exports.getMyMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find({ userId: req.user._id, status: 'active' }).lean();
    const result = [];
    for (const m of memberships) {
      const roles = (m.roleIds || []).length
        ? await Role.find({ tenantId: m.tenantId, _id: { $in: m.roleIds } }).lean()
        : [];
      const { permissions } = await getUserPermissions(m.tenantId, req.user._id);
      result.push({
        tenantId: m.tenantId,
        status: m.status,
        allLocations: m.allLocations,
        locationIds: m.locationIds || [],
        roles: roles.map((r) => ({ _id: r._id, key: r.key, name: r.name })),
        permissions,
      });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rôles de l'organisation courante
// @route   GET /api/memberships/roles
// @access  Private (tenant)
exports.getTenantRoles = async (req, res) => {
  try {
    const roles = await Role.find(tenantFilter(req)).sort({ name: 1 }).lean();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMemberships = getMemberships;
