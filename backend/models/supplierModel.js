const mongoose = require('mongoose');

const supplierSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom du fournisseur est requis'],
      unique: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Supplier', supplierSchema);
