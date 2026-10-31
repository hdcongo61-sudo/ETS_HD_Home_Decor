const mongoose = require('mongoose');

// Webhook sortant : une URL appelée par le serveur quand un événement de la
// boutique survient (ex. vente créée, paiement reçu). La clé `secret` sert à
// signer les livraisons (HMAC-SHA256) pour que le destinataire les vérifie.
const webhookSchema = mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    url: {
      type: String,
      required: [true, "L'URL est requise"],
      trim: true,
      maxlength: 500,
    },
    events: {
      type: [String],
      default: ['sale.created'],
    },
    secret: {
      type: String,
      default: '',
      select: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastStatus: {
      type: Number,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

webhookSchema.index({ tenantId: 1, active: 1 });

module.exports = mongoose.model('Webhook', webhookSchema);
