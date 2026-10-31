const mongoose = require('mongoose');

const platformAnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'urgent', 'release'],
      default: 'info',
    },
    target: {
      type: mongoose.Schema.Types.Mixed,
      default: { targetType: 'all' },
    },
    targetTenantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
    publishedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

platformAnnouncementSchema.index({ targetTenantIds: 1, publishedAt: -1 });

module.exports = mongoose.model('PlatformAnnouncement', platformAnnouncementSchema);
