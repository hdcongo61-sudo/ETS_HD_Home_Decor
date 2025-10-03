const mongoose = require('mongoose');

const employeeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    salary: {
      type: Number,
      required: true,
    },
    hireDate: {
      type: Date,
      required: true,
    },
    department: { type: String },
    advances: [
      {
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        reason: String,
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
      },
    ],
    paySlips: [
      {
        month: { type: Number, required: true },
        year: { type: Number, required: true },
        baseSalary: { type: Number, required: true },
        deductions: { type: Number, default: 0 },
        bonuses: { type: Number, default: 0 },
        netSalary: { type: Number, required: true },
        paymentDate: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Employee', employeeSchema);