const mongoose = require('mongoose');

// Service (catalogue hors-stock) — première brique du vertical « services ».
// Un service n'a pas de stock : il est facturé directement (coiffure,
// réparation, consultation…). Les rendez-vous viendront dans un incrément
// ultérieur.
const serviceSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom du service est requis'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Le prix est requis'],
      min: [0, 'Le prix ne peut pas être négatif'],
    },
    category: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    durationMinutes: {
      type: Number,
      min: 0,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

serviceSchema.index({ tenantId: 1, active: 1 });

module.exports = mongoose.model('Service', serviceSchema);
