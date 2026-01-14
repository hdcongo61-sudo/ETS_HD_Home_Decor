const mongoose = require('mongoose');

const bankTransactionSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['deposit', 'withdraw'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Le montant doit etre superieur a 0']
    },
    label: {
      type: String,
      required: [true, 'Le libelle est requis'],
      trim: true,
      maxLength: [200, 'Le libelle ne peut pas depasser 200 caracteres']
    }
  },
  {
    timestamps: true
  }
);

bankTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('BankTransaction', bankTransactionSchema);
