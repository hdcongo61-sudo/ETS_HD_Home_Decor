const mongoose = require('mongoose');

/**
 * NumberSequence — séquences de numérotation atomiques (Phase 5.3).
 *
 * Par tenant, boutique (null = organisation), type de document et période
 * fiscale. Incrément atomique (`findOneAndUpdate $inc` + upsert) : aucun
 * numéro n'est réutilisé, même après annulation du document.
 */
const numberSequenceSchema = new mongoose.Schema(
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
      default: null,
    },
    docType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    fiscalPeriod: {
      type: String,
      required: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

numberSequenceSchema.index(
  { tenantId: 1, locationId: 1, docType: 1, fiscalPeriod: 1 },
  { unique: true }
);

module.exports = mongoose.model('NumberSequence', numberSequenceSchema);
