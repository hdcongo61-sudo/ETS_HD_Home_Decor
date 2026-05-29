const mongoose = require('mongoose');

const adminRequestSchema = mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'sale.delete',
        'sale.edit',
        'sale.cancel',
        'payment.delete',
        'payment.edit',
        'discount.request',
        'expense.create',
        'product.price_change',
        'stock.adjustment',
        'user.password_update',
        'other',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    targetModel: {
      type: String,
      trim: true,
      default: '',
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetLabel: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminComment: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    executionStatus: {
      type: String,
      enum: ['none', 'action_required', 'executed', 'failed'],
      default: 'none',
    },
    executionMessage: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    executedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

adminRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminRequest', adminRequestSchema);
