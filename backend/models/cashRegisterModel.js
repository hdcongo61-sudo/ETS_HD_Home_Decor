const mongoose = require('mongoose');

/**
 * CashRegister — caisse physique attachée à une boutique (Phase 5.7).
 * Préparation du futur module POS.
 */
const cashRegisterSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

cashRegisterSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('CashRegister', cashRegisterSchema);
