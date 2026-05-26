const mongoose = require('mongoose');

const expenseCategorySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom de la catégorie de dépense est requis'],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
