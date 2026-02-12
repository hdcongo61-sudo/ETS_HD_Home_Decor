const mongoose = require('mongoose');

const containerSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom du conteneur est requis'],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Container', containerSchema);
