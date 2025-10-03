const mongoose = require("mongoose");

const saleSchema = mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'La quantité ne peut pas être inférieure à 1']
        },
        priceAtSale: {
          type: Number,
          required: true,
          min: [0, 'Le prix ne peut pas être négatif']
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Le montant total ne peut pas être négatif'],
      default: 0
    },
    payments: [{
      amount: {
        type: Number,
        required: true,
        set: v => parseFloat(v.toFixed(2)),
        min: [0, 'Le montant ne peut pas être négatif']
      },
      method: {
        type: String,
        enum: ['cash', 'MobileMoney', 'credit'],
        default: 'cash',
        required: true
      },
      paymentDate: {
        type: Date,
        default: Date.now
      },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    note: {
      type: String,
      maxLength: [500, 'La note ne peut pas dépasser 500 caractères'],
      trim: true
    },
    paymentReminder: {
      isSet: {
        type: Boolean,
        default: false
      },
      reminderDate: {
        type: Date,
        index: true
      },
      reminderNote: {
        type: String,
        maxLength: 200,
        trim: true
      },
      status: {
        type: String,
        enum: ['pending', 'sent', 'cancelled'],
        default: 'pending'
      },
      sentAt: Date,
      sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'partially_paid', 'completed', 'cancelled'],
        message: 'Statut de vente non valide'
      },
      default: 'pending'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    saleDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },
    modificationHistory: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: Date,
      note: String,
      changes: {
        products: [{
          product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
          oldQuantity: Number,
          newQuantity: Number,
          oldPrice: Number,
          newPrice: Number
        }]
      }
    }],
    stockDeducted: {
      type: Boolean,
      default: false
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'not_delivered'],
      default: 'pending'
    },
    deliveryDate: {
      type: Date
    },
    deliveryNote: {
      type: String,
      maxLength: 500,
      trim: true
    },
    
    // NOUVEAUX CHAMPS POUR L'ANALYSE DES BÉNÉFICES
    profitData: {
      totalProfit: {
        type: Number,
        default: 0,
        set: v => parseFloat(v.toFixed(2))
      },
      totalCost: {
        type: Number,
        default: 0,
        set: v => parseFloat(v.toFixed(2))
      },
      profitMargin: {
        type: Number,
        default: 0,
        set: v => parseFloat(v.toFixed(2))
      },
      productProfits: [{
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        productName: String,
        quantity: Number,
        salePrice: Number,
        costPrice: Number,
        profit: Number,
        profitMargin: Number,
        revenue: Number
      }]
    },
    
    profitCategory: {
      type: String,
      enum: ['faible', 'moyen', 'élevé', 'excellent'],
      default: 'moyen'
    },
    
    // Champs pour l'analyse temporelle
    periodData: {
      year: { type: Number, index: true },
      month: { type: Number, index: true },
      week: { type: Number, index: true },
      day: { type: Number, index: true },
      quarter: { type: Number, index: true }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// VIRTUALS EXISTANTS AMÉLIORÉS
saleSchema.virtual('balance').get(function () {
  const totalPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(0, this.totalAmount - totalPaid);
});

saleSchema.virtual('totalPaid').get(function () {
  return this.payments.reduce((sum, payment) => sum + payment.amount, 0);
});

saleSchema.virtual('profit').get(function () {
  return this.products.reduce((total, item) => {
    const costPrice = item.product?.costPrice || 0;
    return total + (item.priceAtSale - costPrice) * item.quantity;
  }, 0);
});

saleSchema.virtual('profitMarginPercentage').get(function () {
  if (this.totalAmount === 0) return 0;
  return ((this.profit / this.totalAmount) * 100).toFixed(2);
});

saleSchema.virtual('formattedSaleDate').get(function () {
  return this.saleDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
});

// Virtual for reminder status
saleSchema.virtual('isReminderDue').get(function () {
  if (!this.paymentReminder.isSet || this.paymentReminder.status === 'cancelled') {
    return false;
  }
  return new Date() >= new Date(this.paymentReminder.reminderDate);
});

saleSchema.virtual('isReminderOverdue').get(function () {
  if (!this.paymentReminder.isSet || this.paymentReminder.status === 'cancelled') {
    return false;
  }
  const reminderDate = new Date(this.paymentReminder.reminderDate);
  const now = new Date();
  return now > reminderDate && this.paymentReminder.status === 'pending';
});

// NOUVEAUX VIRTUALS POUR L'ANALYSE
saleSchema.virtual('totalCost').get(function () {
  return this.products.reduce((total, item) => {
    const costPrice = item.product?.costPrice || 0;
    return total + (costPrice * item.quantity);
  }, 0);
});

saleSchema.virtual('profitPerUnit').get(function () {
  const totalQuantity = this.products.reduce((sum, item) => sum + item.quantity, 0);
  return totalQuantity > 0 ? this.profit / totalQuantity : 0;
});

saleSchema.virtual('isProfitable').get(function () {
  return this.profit > 0;
});

// MIDDLEWARE PRE-SAVE AMÉLIORÉ
saleSchema.pre('save', async function (next) {
  // Validation du stock avant sauvegarde
  if (this.isModified('products') && this.isNew) {
    for (const item of this.products) {
      const product = await mongoose.model('Product').findById(item.product);
      if (!product) {
        throw new Error(`Produit ${item.product} introuvable`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Stock insuffisant pour ${product.name}`);
      }
    }
  }

  // Mise à jour des données temporelles
  if (this.isNew || this.isModified('saleDate')) {
    const saleDate = new Date(this.saleDate);
    this.periodData = {
      year: saleDate.getFullYear(),
      month: saleDate.getMonth() + 1,
      week: getWeekNumber(saleDate),
      day: saleDate.getDate(),
      quarter: Math.floor((saleDate.getMonth() + 3) / 3)
    };
  }

  // Calcul détaillé des bénéfices
  if (this.isModified('products') || this.isNew) {
    let totalProfit = 0;
    let totalCost = 0;
    const productProfits = [];
    
    for (const item of this.products) {
      const product = await mongoose.model('Product').findById(item.product);
      if (product) {
        const costPrice = product.costPrice || 0;
        const revenue = item.priceAtSale * item.quantity;
        const cost = costPrice * item.quantity;
        const profit = revenue - cost;
        const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
        
        totalProfit += profit;
        totalCost += cost;
        
        productProfits.push({
          product: item.product,
          productName: product.name,
          quantity: item.quantity,
          salePrice: item.priceAtSale,
          costPrice: costPrice,
          revenue: revenue,
          profit: profit,
          profitMargin: profitMargin
        });
      }
    }
    
    this.profitData = {
      totalProfit: totalProfit,
      totalCost: totalCost,
      profitMargin: this.totalAmount > 0 ? (totalProfit / this.totalAmount) * 100 : 0,
      productProfits: productProfits
    };
    
    // Catégorisation automatique du bénéfice
    const profitMargin = this.profitData.profitMargin;
    if (profitMargin >= 50) this.profitCategory = 'excellent';
    else if (profitMargin >= 30) this.profitCategory = 'élevé';
    else if (profitMargin >= 15) this.profitCategory = 'moyen';
    else this.profitCategory = 'faible';
  }

  // Update status based on payments and balance
  if (this.isModified('payments') || this.isModified('totalAmount')) {
    const totalPaid = this.totalPaid;
    const balance = this.balance;

    if (balance <= 0) {
      this.status = 'completed';
    } else if (totalPaid > 0) {
      this.status = 'partially_paid';
    } else {
      this.status = 'pending';
    }
  }

  next();
});

// MIDDLEWARE POST-SAVE POUR LA DÉDUCTION DU STOCK
saleSchema.post('save', async function (doc) {
  if (doc.isNew && !doc.stockDeducted) {
    try {
      for (const item of doc.products) {
        await mongoose.model('Product').findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity } }
        );
      }
      doc.stockDeducted = true;
      await doc.save();
    } catch (error) {
      console.error('Erreur lors de la déduction du stock:', error);
    }
  }
});

// MÉTHODES STATIQUES POUR L'ANALYSE DES BÉNÉFICES
saleSchema.statics.getProfitAnalytics = async function (filters = {}) {
  const {
    startDate,
    endDate,
    period = 'month', // day, week, month, year, quarter
    category,
    profitRange,
    minProfit,
    maxProfit
  } = filters;

  let matchFilter = { status: { $ne: 'cancelled' } };
  
  // Filtre par date
  if (startDate || endDate) {
    matchFilter.saleDate = {};
    if (startDate) matchFilter.saleDate.$gte = new Date(startDate);
    if (endDate) matchFilter.saleDate.$lte = new Date(endDate);
  }
  
  // Filtre par catégorie de profit
  if (category) {
    matchFilter.profitCategory = category;
  }
  
  // Filtre par plage de bénéfice
  if (minProfit !== undefined || maxProfit !== undefined) {
    matchFilter['profitData.totalProfit'] = {};
    if (minProfit !== undefined) matchFilter['profitData.totalProfit'].$gte = minProfit;
    if (maxProfit !== undefined) matchFilter['profitData.totalProfit'].$lte = maxProfit;
  }

  const groupField = `$periodData.${period}`;

  const profitAnalytics = await this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: groupField,
        totalSales: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$profitData.totalProfit' },
        totalCost: { $sum: '$profitData.totalCost' },
        saleCount: { $sum: 1 },
        averageProfit: { $avg: '$profitData.totalProfit' },
        averageMargin: { $avg: '$profitData.profitMargin' },
        maxProfit: { $max: '$profitData.totalProfit' },
        minProfit: { $min: '$profitData.totalProfit' },
        profitableSales: {
          $sum: {
            $cond: [{ $gt: ['$profitData.totalProfit', 0] }, 1, 0]
          }
        },
        unprofitableSales: {
          $sum: {
            $cond: [{ $lt: ['$profitData.totalProfit', 0] }, 1, 0]
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return profitAnalytics;
};

saleSchema.statics.getTopProfitableProducts = async function (filters = {}) {
  const { startDate, endDate, limit = 10, minSales = 0 } = filters;
  
  let matchFilter = { status: { $ne: 'cancelled' } };
  if (startDate || endDate) {
    matchFilter.saleDate = {};
    if (startDate) matchFilter.saleDate.$gte = new Date(startDate);
    if (endDate) matchFilter.saleDate.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchFilter },
    { $unwind: '$products' },
    {
      $lookup: {
        from: 'products',
        localField: 'products.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: '$products.product',
        productName: { $first: '$productInfo.name' },
        productCategory: { $first: '$productInfo.category' },
        totalQuantity: { $sum: '$products.quantity' },
        totalRevenue: { $sum: { $multiply: ['$products.quantity', '$products.priceAtSale'] } },
        totalCost: { 
          $sum: { 
            $multiply: [
              '$products.quantity', 
              { $ifNull: ['$productInfo.costPrice', 0] }
            ] 
          } 
        },
        averageSalePrice: { $avg: '$products.priceAtSale' },
        averageCostPrice: { $avg: { $ifNull: ['$productInfo.costPrice', 0] } },
        saleCount: { $sum: 1 },
        uniqueSales: { $addToSet: '$_id' }
      }
    },
    {
      $match: {
        saleCount: { $gte: minSales }
      }
    },
    {
      $project: {
        productName: 1,
        productCategory: 1,
        totalQuantity: 1,
        totalRevenue: 1,
        totalCost: 1,
        totalProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
        profitMargin: {
          $cond: [
            { $eq: ['$totalRevenue', 0] },
            0,
            { $multiply: [{ $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] }, 100] }
          ]
        },
        averageSalePrice: { $round: ['$averageSalePrice', 2] },
        averageCostPrice: { $round: ['$averageCostPrice', 2] },
        saleCount: 1,
        uniqueSaleCount: { $size: '$uniqueSales' },
        profitPerUnit: {
          $cond: [
            { $eq: ['$totalQuantity', 0] },
            0,
            { $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalQuantity'] }
          ]
        }
      }
    },
    { $sort: { totalProfit: -1 } },
    { $limit: limit }
  ]);

  return result;
};

saleSchema.statics.getProfitByCategory = async function (filters = {}) {
  const { startDate, endDate } = filters;
  
  let matchFilter = { status: { $ne: 'cancelled' } };
  if (startDate || endDate) {
    matchFilter.saleDate = {};
    if (startDate) matchFilter.saleDate.$gte = new Date(startDate);
    if (endDate) matchFilter.saleDate.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchFilter },
    { $unwind: '$products' },
    {
      $lookup: {
        from: 'products',
        localField: 'products.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: '$productInfo.category',
        totalRevenue: { $sum: { $multiply: ['$products.quantity', '$products.priceAtSale'] } },
        totalCost: { 
          $sum: { 
            $multiply: [
              '$products.quantity', 
              { $ifNull: ['$productInfo.costPrice', 0] }
            ] 
          } 
        },
        totalQuantity: { $sum: '$products.quantity' },
        productCount: { $addToSet: '$products.product' },
        saleCount: { $sum: 1 }
      }
    },
    {
      $project: {
        category: '$_id',
        totalRevenue: 1,
        totalCost: 1,
        totalProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
        profitMargin: {
          $cond: [
            { $eq: ['$totalRevenue', 0] },
            0,
            { $multiply: [{ $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] }, 100] }
          ]
        },
        totalQuantity: 1,
        productCount: { $size: '$productCount' },
        saleCount: 1,
        averageProfitPerSale: { $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$saleCount'] }
      }
    },
    { $sort: { totalProfit: -1 } }
  ]);

  return result;
};

saleSchema.statics.getDailyProfitSummary = async function (date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await this.aggregate([
    {
      $match: {
        saleDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$profitData.totalProfit' },
        saleCount: { $sum: 1 },
        averageProfit: { $avg: '$profitData.totalProfit' },
        bestSale: { $max: '$profitData.totalProfit' },
        worstSale: { $min: '$profitData.totalProfit' },
        profitableSales: {
          $sum: { $cond: [{ $gt: ['$profitData.totalProfit', 0] }, 1, 0] }
        }
      }
    }
  ]);

  return result[0] || {
    totalSales: 0,
    totalProfit: 0,
    saleCount: 0,
    averageProfit: 0,
    bestSale: 0,
    worstSale: 0,
    profitableSales: 0
  };
};

// MÉTHODES D'INSTANCE EXISTANTES
saleSchema.methods.cancelSale = async function () {
  if (this.status === 'cancelled') {
    throw new Error('La vente est déjà annulée');
  }

  this.status = 'cancelled';

  // Restaurer le stock seulement s'il a été déduit précédemment
  if (this.stockDeducted) {
    for (const item of this.products) {
      await mongoose.model('Product').findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }
    this.stockDeducted = false;
  }

  return this.save();
};

saleSchema.methods.addPayment = async function (paymentData) {
  this.payments.push(paymentData);

  // Recalculer le statut automatiquement via le pre-save middleware
  const totalPaid = this.totalPaid;
  const balance = this.balance;

  if (balance <= 0) {
    this.status = 'completed';
  } else if (totalPaid > 0) {
    this.status = 'partially_paid';
  }

  return this.save();
};

saleSchema.methods.hasStockDeducted = function () {
  return this.stockDeducted;
};

// NOUVELLES MÉTHODES D'INSTANCE POUR LES BÉNÉFICES
saleSchema.methods.getProductProfitDetails = function () {
  return this.profitData.productProfits.map(profit => ({
    product: profit.productName,
    quantity: profit.quantity,
    revenue: profit.revenue,
    cost: profit.costPrice * profit.quantity,
    profit: profit.profit,
    margin: profit.profitMargin
  }));
};

saleSchema.methods.isMoreProfitableThan = function (targetMargin) {
  return this.profitData.profitMargin > targetMargin;
};

saleSchema.methods.getProfitContribution = function () {
  const totalProfit = this.profitData.totalProfit;
  return this.profitData.productProfits.map(profit => ({
    product: profit.productName,
    profit: profit.profit,
    contribution: totalProfit > 0 ? (profit.profit / totalProfit) * 100 : 0
  }));
};

// FONCTION UTILITAIRE POUR LE NUMÉRO DE SEMAINE
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// INDEX COMPOSÉS AMÉLIORÉS
saleSchema.index({ saleDate: -1, status: 1 });
saleSchema.index({ stockDeducted: 1 });
saleSchema.index({ 'paymentReminder.reminderDate': 1 });
saleSchema.index({ 'periodData.year': 1, 'periodData.month': 1 });
saleSchema.index({ 'periodData.year': 1, 'periodData.week': 1 });
saleSchema.index({ 'profitData.totalProfit': -1 });
saleSchema.index({ profitCategory: 1 });
saleSchema.index({ 'profitData.profitMargin': -1 });

// HOOK POUR LOGGER LES VENTES TRÈS RENTABLES
saleSchema.post('save', function(doc) {
  if (doc.profitData.profitMargin > 60) {
    // console.log(`🚀 Vente très rentable: ${doc._id} - Marge: ${doc.profitData.profitMargin.toFixed(2)}%`);
  }
  
  if (doc.profitData.totalProfit < 0) {
    // console.warn(`⚠️ Vente non rentable: ${doc._id} - Perte: ${doc.profitData.totalProfit} CFA`);
  }
});

module.exports = mongoose.model('Sale', saleSchema);