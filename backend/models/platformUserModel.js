const mongoose = require('mongoose');

const platformUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'L email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values, but unique non-null values
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
  },
  role: {
    type: String,
    enum: ['super-admin', 'payment-checker', 'user-manager', 'support'],
    default: 'support',
  },
  permissions: {
    type: [String],
    default: [],
    // Examples: 'billing.read', 'billing.write', 'users.read', 'users.write', 'tenants.read', 'tenants.write'
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlatformUser',
  },
}, {
  timestamps: true,
});

// Don't apply tenant guard to platform users - they're not tenant-scoped
platformUserSchema.statics.bypassTenantGuard = true;

module.exports = mongoose.model('PlatformUser', platformUserSchema);
