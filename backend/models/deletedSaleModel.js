const mongoose = require('mongoose');

const deletedSaleSchema = mongoose.Schema(
  {
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true
    },
    saleSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    deletionReason: {
      type: String,
      required: true,
      trim: true,
      maxLength: 500
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    deletedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

module.exports = mongoose.model('DeletedSale', deletedSaleSchema);
