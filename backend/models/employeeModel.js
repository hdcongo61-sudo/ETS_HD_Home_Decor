const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const employeeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      trim: true,
      index: true
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
    photo: {
      type: String,
      default: '',
      trim: true,
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

employeeSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);
