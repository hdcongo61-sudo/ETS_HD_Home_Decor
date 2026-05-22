const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const slugify = require('../utils/slugify');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    password: {
      type: String,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastModifiedAt: {
      type: Date,
      default: null,
    },
    passwordModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    passwordModifiedAt: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    accessControlEnabled: {
      type: Boolean,
      default: false,
    },
    accessStart: {
      type: Date,
      default: null,
    },
    accessEnd: {
      type: Date,
      default: null,
    },
    photo: {
      type: String,
      default: '',
      trim: true,
    },
    salesGoals: {
      monthlyRevenueTarget: {
        type: Number,
        default: 0,
        min: 0,
      },
      monthlyProfitTarget: {
        type: Number,
        default: 0,
        min: 0,
      },
      monthlyCollectionTarget: {
        type: Number,
        default: 0,
        min: 0,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    adminPreferences: {
      weeklyReportEnabled: {
        type: Boolean,
        default: false,
      },
      weeklyReportFormat: {
        type: String,
        enum: ['excel', 'pdf'],
        default: 'excel',
      },
      inactivityAlertsEnabled: {
        type: Boolean,
        default: true,
      },
      collectionAlertsEnabled: {
        type: Boolean,
        default: true,
      },
      manualSaleDateEnabled: {
        type: Boolean,
        default: false,
      },
      manualExpenseDateEnabled: {
        type: Boolean,
        default: false,
      },
      manualPaymentDateEnabled: {
        type: Boolean,
        default: false,
      },
      weeklyReportLastSentAt: {
        type: Date,
        default: null,
      },
    },
    pushSubscriptions: [
      {
        endpoint: {
          type: String,
          required: true,
        },
        expirationTime: {
          type: Number,
          default: null,
        },
        keys: {
          p256dh: {
            type: String,
            required: true,
          },
          auth: {
            type: String,
            required: true,
          },
        },
        device: {
          platform: {
            type: String,
            default: '',
          },
          userAgent: {
            type: String,
            default: '',
          },
          language: {
            type: String,
            default: '',
          },
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Ajouter la méthode de comparaison de mot de passe
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hasher le mot de passe avant de sauvegarder
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
