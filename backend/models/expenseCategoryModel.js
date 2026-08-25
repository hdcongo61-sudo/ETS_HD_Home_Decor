const mongoose = require('mongoose');

const expenseCategorySchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom de la catégorie de dépense est requis'],
      trim: true,
    },
  },
  { timestamps: true }
);

// Unicité par boutique : le même nom peut exister chez plusieurs tenants.
expenseCategorySchema.index(
  { tenantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { tenantId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
