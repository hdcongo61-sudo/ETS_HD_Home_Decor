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
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'paymentMethod', 'debit', 'transfer', 'check', 'bank_transfer'],
      default: 'cash',
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    salaryMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    salaryYear: {
      type: Number,
      min: 2000,
      max: 2100,
      default: null,
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

expenseSchema.index({ date: -1 });
expenseSchema.index({ employee: 1, salaryYear: 1, salaryMonth: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
