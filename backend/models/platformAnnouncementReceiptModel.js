const mongoose = require('mongoose');

const platformAnnouncementReceiptSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlatformAnnouncement',
      required: true,
    },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

platformAnnouncementReceiptSchema.index(
  { tenantId: 1, announcementId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'PlatformAnnouncementReceipt',
  platformAnnouncementReceiptSchema
);
