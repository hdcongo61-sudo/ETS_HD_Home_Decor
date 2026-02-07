const mongoose = require('mongoose');

const documentSchema = mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['fiscal', 'rent_payment', 'insurance', 'contract', 'other'],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false,
    },
  },
  { timestamps: true }
);

// Index for filtering by year (derived from date)
documentSchema.index({ date: -1 });

module.exports = mongoose.model('Document', documentSchema);
