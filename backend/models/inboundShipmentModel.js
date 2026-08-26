const mongoose = require('mongoose');

/**
 * InboundShipment — expédition/conteneur entrant (Phase 6.5).
 *
 * Concept opérationnel d'achat : référence, conteneur, fournisseurs, origine,
 * boutique de destination, dates, coûts logistiques (fret/douane/assurance)
 * allouables aux lignes reçues, et documents liés.
 */
const inboundShipmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    containerNumber: { type: String, trim: true, default: '' },
    supplierIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
    purchaseOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }],
    origin: { type: String, trim: true, default: '' },
    destinationLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    departureDate: { type: Date, default: null },
    arrivalDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['planned', 'in_transit', 'received', 'cancelled'],
      default: 'planned',
      index: true,
    },
    freightCost: { type: Number, default: 0, min: 0 },
    customsCost: { type: Number, default: 0, min: 0 },
    insuranceCost: { type: Number, default: 0, min: 0 },
    documents: { type: [{ name: String, url: String }], default: [] },
    note: { type: String, trim: true, default: '', maxLength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

inboundShipmentSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
inboundShipmentSchema.index({ tenantId: 1, status: 1, arrivalDate: 1 });

module.exports = mongoose.model('InboundShipment', inboundShipmentSchema);
