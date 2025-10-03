const mongoose = require('mongoose');

const clientSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
    },
    address: {
      type: String,
    },
    purchases: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',
      }
    ],
    // NEW FIELDS FOR PURCHASE METRICS
    totalPurchases: {
      type: Number,
      default: 0,
      min: 0
    },
    purchaseCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPurchaseDate: {
      type: Date,
      default: null
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
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual to automatically update purchase metrics
clientSchema.virtual('purchaseDetails', {
  ref: 'Sale',
  localField: 'purchases',
  foreignField: '_id'
});

// Middleware to update metrics when purchases change
clientSchema.pre('save', async function (next) {
  if (this.isModified('purchases')) {
    try {
      const sales = await mongoose.model('Sale').find({
        _id: { $in: this.purchases }
      });

      this.purchaseCount = sales.length;
      this.totalPurchases = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      this.lastPurchaseDate = sales.length
        ? new Date(Math.max(...sales.map(s => new Date(s.createdAt))))
        : null;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Client', clientSchema);
