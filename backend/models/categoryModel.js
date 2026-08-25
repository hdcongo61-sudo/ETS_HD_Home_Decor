const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

/**
 * Category — arborescence (Phase 3). `parentId` crée la hiérarchie ;
 * `path` et `depth` sont maintenus par le contrôleur (avec anti-cycle).
 * Compatibilité : les produits référencent encore la catégorie par libellé
 * (champ texte) ; la bascule vers l'ID viendra avec le catalogue v2.
 */
const categorySchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Le nom de la catégorie est requis'],
      trim: true,
    },
    normalizedName: {
      type: String,
      trim: true,
      lowercase: true,
    },
    slug: {
      type: String,
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    path: {
      type: String,
      default: '',
    },
    depth: {
      type: Number,
      default: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    attributeDefinitionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
  },
  { timestamps: true }
);

// Unicité par organisation ET par niveau : deux catégories du même niveau
// ne peuvent pas partager le même nom (normalisé).
categorySchema.index(
  { tenantId: 1, parentId: 1, normalizedName: 1 },
  { unique: true }
);

// Nom normalisé + slug dérivés du libellé.
categorySchema.pre('save', function (next) {
  if (this.isModified('name') || !this.normalizedName) {
    this.normalizedName = (this.name || '').trim().toLowerCase();
  }
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name || '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
