const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const productSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom du produit est requis'],
      trim: true,
      maxLength: [100, 'Le nom ne peut pas dépasser 100 caractères']
    },
    description: {
      type: String,
      required: [true, 'La description du produit est requise'],
      maxLength: [500, 'La description ne peut pas dépasser 500 caractères']
    },
    price: {
      type: Number,
      required: [true, 'Le prix du produit est requis'],
      min: [0, 'Le prix ne peut pas être négatif'],
      set: v => parseFloat(v.toFixed(2)) // Arrondir à 2 décimales
    },
    supplierName: { type: String, trim: true, default: 'Non défini' },
    supplierPhone: { type: String, trim: true, default: '' },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'La quantité de stock ne peut pas être négative'],
      validate: {
        validator: function(v) {
          return v >= 0;
        },
        message: 'La quantité de stock ne peut pas être négative'
      }
    },
    category: {
      type: String,
      required: [true, 'La catégorie du produit est requise'],
      trim: true
    },
    slug: {
      type: String,
      trim: true,
      index: true
    },
    image: {
      type: String,
      default: null,
      
    },
    costPrice: {
      type: Number,
      min: [0, 'Le prix de revient ne peut pas être négatif'],
      set: v => v ? parseFloat(v.toFixed(2)) : undefined,
      validate: {
        validator: function(v) {
          return v === undefined || v >= 0;
        },
        message: 'Le prix de revient ne peut pas être négatif'
      }
    },
    minStockLevel: {
      type: Number,
      default: 5,
      min: [0, 'Le niveau de stock minimum ne peut pas être négatif']
    },
    isActive: {
      type: Boolean,
      default: true
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
    sku: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: [0, 'Le nombre de vues ne peut pas être négatif']
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: [0, 'Le taux de conversion ne peut pas être négatif'],
      max: [100, 'Le taux de conversion ne peut pas dépasser 100']
    },
    returnsCount: {
      type: Number,
      default: 0,
      min: [0, 'Le nombre de retours ne peut pas être négatif']
    },
    activities: {
      type: [{
        type: {
          type: String,
          enum: ['creation', 'stock_update', 'price_update', 'sale', 'return', 'view', 'adjustment'],
          default: 'adjustment'
        },
        description: {
          type: String,
          trim: true,
          maxLength: 200
        },
        oldValue: {
          type: mongoose.Schema.Types.Mixed
        },
        newValue: {
          type: mongoose.Schema.Types.Mixed
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index pour les recherches rapides
productSchema.index({ name: 'text', description: 'text', category: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ isActive: 1 });

// Virtual pour vérifier si le stock est faible
productSchema.virtual('isLowStock').get(function() {
  return this.stock <= this.minStockLevel;
});

// Virtual pour calculer la marge bénéficiaire
productSchema.virtual('profitMargin').get(function() {
  if (!this.costPrice || this.costPrice === 0) return null;
  return ((this.price - this.costPrice) / this.costPrice * 100).toFixed(2);
});

// Virtual pour calculer le profit unitaire
productSchema.virtual('unitProfit').get(function() {
  if (!this.costPrice) return null;
  return this.price - this.costPrice;
});

// Middleware pre-save pour générer un SKU automatique si non fourni
productSchema.pre('save', function(next) {
  if (!this.sku) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    this.sku = `SKU-${timestamp}-${random}`.toUpperCase();
  }
  if (this.isNew || this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

// Méthode statique pour trouver les produits en rupture de stock
productSchema.statics.findOutOfStock = function() {
  return this.find({ stock: 0, isActive: true });
};

// Méthode statique pour trouver les produits à stock faible
productSchema.statics.findLowStock = function() {
  return this.find({ 
    stock: { $gt: 0, $lte: '$minStockLevel' }, 
    isActive: true 
  });
};

// Méthode statique pour mettre à jour le stock en toute sécurité
productSchema.statics.updateStock = async function(productId, quantityChange) {
  const product = await this.findById(productId);
  
  if (!product) {
    throw new Error('Produit non trouvé');
  }
  
  const newStock = product.stock + quantityChange;
  
  if (newStock < 0) {
    throw new Error(`Stock insuffisant. Stock actuel: ${product.stock}, tentative de retrait: ${-quantityChange}`);
  }
  
  product.stock = newStock;
  return product.save();
};

// Méthode d'instance pour vérifier la disponibilité du stock
productSchema.methods.hasSufficientStock = function(quantity) {
  return this.stock >= quantity;
};

// Méthode d'instance pour diminuer le stock de manière sécurisée
productSchema.methods.decreaseStock = function(quantity) {
  if (!this.hasSufficientStock(quantity)) {
    throw new Error(`Stock insuffisant. Stock actuel: ${this.stock}, quantité demandée: ${quantity}`);
  }
  
  this.stock -= quantity;
  return this.save();
};



// Middleware pre-save pour valider le stock avant sauvegarde
productSchema.pre('save', function(next) {
  if (this.stock < 0) {
    const error = new Error('La quantité de stock ne peut pas être négative');
    return next(error);
  }
  
  if (this.costPrice && this.costPrice < 0) {
    const error = new Error('Le prix de revient ne peut pas être négatif');
    return next(error);
  }
  
  next();
});

// Hook pour logger les changements de stock importants
productSchema.post('save', function(doc) {
  if (doc.stock <= doc.minStockLevel) {
    console.warn(`Alerte: Stock faible pour le produit ${doc.name} (SKU: ${doc.sku}). Stock actuel: ${doc.stock}`);
  }
  
  if (doc.stock === 0) {
    console.error(`Alerte: Rupture de stock pour le produit ${doc.name} (SKU: ${doc.sku})`);
  }
});

module.exports = mongoose.model('Product', productSchema);
