const mongoose = require('mongoose');

const stockReplacementReminderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    warehouseName: {
      type: String,
      trim: true,
      default: '',
    },
    quantityToReplace: {
      type: Number,
      required: true,
      min: 1,
    },
    currentStock: {
      type: Number,
      min: 0,
      default: 0,
    },
    sales: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
    }],
    lastSale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    lastSaleAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'pending',
      index: true,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

stockReplacementReminderSchema.index(
  { tenantId: 1, product: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);
stockReplacementReminderSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('StockReplacementReminder', stockReplacementReminderSchema);
