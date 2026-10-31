const asyncHandler = require('express-async-handler');
const Tenant = require('../models/tenantModel');
const PlatformAnnouncement = require('../models/platformAnnouncementModel');
const PlatformAnnouncementReceipt = require('../models/platformAnnouncementReceiptModel');
const PlatformAudit = require('../models/platformAuditModel');

const PAYMENT_STATUSES = new Set(['all', 'overdue', 'upcoming', 'never-paid']);
const ANNOUNCEMENT_TYPES = new Set(['info', 'warning', 'success', 'urgent', 'release']);

const getTargetTenants = async (target) => {
  const targetType = target?.targetType || 'all';
  const now = new Date();
  const filter = {};

  if (targetType === 'all') return Tenant.find({}).select('_id').lean();

  if (targetType === 'plans') {
    const plans = Array.isArray(target.plans)
      ? target.plans.filter((plan) => ['trial', 'basic', 'pro', 'enterprise'].includes(plan))
      : [];
    if (!plans.length) return [];
    filter.plan = { $in: plans };
  } else if (targetType === 'statuses') {
    const statuses = Array.isArray(target.statuses)
      ? target.statuses.filter((status) => ['active', 'trial', 'suspended', 'expired'].includes(status))
      : [];
    if (!statuses.length) return [];
    filter.status = { $in: statuses };
  } else if (targetType === 'payment') {
    const paymentStatus = target.paymentStatus || 'all';
    if (!PAYMENT_STATUSES.has(paymentStatus)) return [];
    if (paymentStatus === 'overdue') {
      filter.status = 'active';
      filter.nextPaymentDue = { $lt: now };
    } else if (paymentStatus === 'upcoming') {
      filter.nextPaymentDue = {
        $gt: now,
        $lte: new Date(now.getTime() + 7 * 86400000),
      };
    } else if (paymentStatus === 'never-paid') {
      filter.lastPaymentAt = null;
      filter.monthlyPrice = { $gt: 0 };
    }
  } else {
    return [];
  }

  return Tenant.find(filter).select('_id').lean();
};

const serializeForTenant = (announcement, readIds) => ({
  _id: announcement._id,
  title: announcement.title,
  message: announcement.message,
  type: announcement.type,
  publishedAt: announcement.publishedAt,
  read: readIds.has(String(announcement._id)),
});

exports.createAnnouncement = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const message = String(req.body?.message || '').trim();
  const type = String(req.body?.type || 'info');
  const targetInput = req.body?.target;
  const target = targetInput === undefined ? { targetType: 'all' } : targetInput;

  if (!title || title.length > 100) {
    return res.status(400).json({ message: 'Le titre est requis (100 caractères maximum).' });
  }
  if (!message || message.length > 500) {
    return res.status(400).json({ message: 'Le message est requis (500 caractères maximum).' });
  }
  if (!ANNOUNCEMENT_TYPES.has(type)) {
    return res.status(400).json({ message: 'Type de publication invalide.' });
  }
  if (!target || typeof target !== 'object' || Array.isArray(target) || !['all', 'plans', 'statuses', 'payment'].includes(target.targetType)) {
    return res.status(400).json({ message: 'Cible de publication invalide.' });
  }

  const tenants = await getTargetTenants(target);
  if (!tenants.length) {
    return res.status(400).json({ message: 'Aucune boutique ne correspond à cette cible.' });
  }

  const announcement = await PlatformAnnouncement.create({
    title,
    message,
    type,
    target,
    targetTenantIds: tenants.map((tenant) => tenant._id),
    createdBy: req.user?._id || null,
    createdByName: req.user?.name || '',
  });
  PlatformAudit.record({
    req,
    action: 'platform.announcement',
    meta: {
      announcementId: announcement._id,
      type,
      title,
      recipientCount: tenants.length,
      targetType: target.targetType || 'all',
    },
  });

  res.status(201).json({
    announcement: {
      ...announcement.toObject(),
      recipientCount: tenants.length,
      readCount: 0,
    },
  });
});

exports.listAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await PlatformAnnouncement.find({})
    .sort({ publishedAt: -1 })
    .limit(100)
    .lean();
  const ids = announcements.map((item) => item._id);
  const receipts = ids.length
    ? await PlatformAnnouncementReceipt.aggregate([
        { $match: { announcementId: { $in: ids } } },
        { $group: { _id: '$announcementId', count: { $sum: 1 } } },
      ])
    : [];
  const readCounts = new Map(receipts.map((item) => [String(item._id), item.count]));

  res.json(announcements.map((item) => ({
    ...item,
    recipientCount: item.targetTenantIds?.length || 0,
    readCount: readCounts.get(String(item._id)) || 0,
  })));
});

exports.listMyAnnouncements = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const announcements = await PlatformAnnouncement.find({
    targetTenantIds: tenantId,
    publishedAt: { $lte: new Date() },
  })
    .sort({ publishedAt: -1 })
    .limit(20)
    .lean();
  const receipts = await PlatformAnnouncementReceipt.find({
    tenantId,
    announcementId: { $in: announcements.map((item) => item._id) },
  }).select('announcementId').lean();
  const readIds = new Set(receipts.map((receipt) => String(receipt.announcementId)));

  res.json(announcements.map((item) => serializeForTenant(item, readIds)));
});

exports.markAnnouncementRead = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const announcement = await PlatformAnnouncement.findOne({
    _id: req.params.id,
    targetTenantIds: tenantId,
    publishedAt: { $lte: new Date() },
  }).select('_id').lean();

  if (!announcement) {
    return res.status(404).json({ message: 'Publication introuvable.' });
  }

  try {
    await PlatformAnnouncementReceipt.updateOne(
      { tenantId, announcementId: announcement._id },
      { $setOnInsert: { readAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  res.json({ message: 'Publication marquée comme lue.' });
});
