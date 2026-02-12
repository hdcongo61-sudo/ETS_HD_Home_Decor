const mongoose = require('mongoose');

const warehouseSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom de l'entrepôt est requis"],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Warehouse', warehouseSchema);
