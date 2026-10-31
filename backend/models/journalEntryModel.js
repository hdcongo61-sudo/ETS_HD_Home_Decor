const mongoose = require('mongoose');

// Écriture comptable en partie double. Chaque ligne porte un débit OU un
// crédit (jamais les deux), et la somme des débits doit égaler la somme des
// crédits — validation appliquée côté contrôleur.
const journalLineSchema = mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    debit: {
      type: Number,
      default: 0,
      min: [0, 'Le débit ne peut pas être négatif'],
    },
    credit: {
      type: Number,
      default: 0,
      min: [0, 'Le crédit ne peut pas être négatif'],
    },
  },
  { _id: false }
);

const journalEntrySchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    entryNumber: {
      type: String,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'La date de l’écriture est requise'],
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    // Origine de l'écriture. Les écritures manuelles restent modifiables ;
    // les écritures générées (vente, dépense…) devraient être traitées avec
    // prudence. Seule la source est mémorisée ici — l'écriture elle-même est
    // immuable une fois équilibrée.
    sourceType: {
      type: String,
      enum: ['manual', 'sale', 'expense', 'payment', 'payroll', 'opening'],
      default: 'manual',
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    lines: {
      type: [journalLineSchema],
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length >= 2,
        message: 'Une écriture doit contenir au moins deux lignes',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

journalEntrySchema.index({ tenantId: 1, date: -1 });
journalEntrySchema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
