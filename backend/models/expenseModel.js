const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: ['rent', 'utilities', 'salaries', 'supplies', 'other'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'paymentMethod', 'debit', 'transfer'],
      default: 'cash',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Expense', expenseSchema);
