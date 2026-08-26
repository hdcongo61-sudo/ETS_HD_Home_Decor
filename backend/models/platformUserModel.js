const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  // Version de jeton : l'incrément révoque toutes les sessions (Phase 0.8).
  tokenVersion: {
    type: Number,
    default: 0,
  },
  // MFA TOTP (Phase 0.8) : activé uniquement après vérification du code.
  mfaEnabled: {
    type: Boolean,
    default: false,
  },
  mfaSecret: {
    type: String,
    default: null,
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

// Vérification du mot de passe (bcrypt), alignée sur userModel.
platformUserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Hasher le mot de passe avant sauvegarde, comme userModel.
platformUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('PlatformUser', platformUserSchema);
