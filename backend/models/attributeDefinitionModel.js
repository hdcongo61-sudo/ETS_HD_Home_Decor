const mongoose = require('mongoose');

/**
 * AttributeDefinition — attribut configurable du catalogue (Phase 3).
 *
 * `variantAxis` marque les attributs qui génèrent des variantes (ex. taille,
 * couleur). Les valeurs sont validées par le backend selon `dataType`.
 */
const ATTRIBUTE_DATA_TYPES = ['text', 'number', 'boolean', 'date', 'select', 'multiselect'];

const attributeDefinitionSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: [true, 'La clé de l’attribut est requise'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_-]{2,64}$/, 'Clé invalide (lettres minuscules, chiffres, - et _)'],
    },
    label: {
      type: String,
      required: [true, 'Le libellé de l’attribut est requis'],
      trim: true,
    },
    dataType: {
      type: String,
      enum: ATTRIBUTE_DATA_TYPES,
      default: 'text',
    },
    options: {
      type: [String],
      default: [],
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitOfMeasure',
      default: null,
    },
    required: {
      type: Boolean,
      default: false,
    },
    searchable: {
      type: Boolean,
      default: false,
    },
    filterable: {
      type: Boolean,
      default: false,
    },
    variantAxis: {
      type: Boolean,
      default: false,
    },
    appliesToCategoryIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Clé unique par organisation.
attributeDefinitionSchema.index({ tenantId: 1, key: 1 }, { unique: true });
attributeDefinitionSchema.index({ tenantId: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('AttributeDefinition', attributeDefinitionSchema);
