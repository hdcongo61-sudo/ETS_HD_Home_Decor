/**
 * ShipmentService — expéditions entrantes (Phase 6.5).
 *
 * `getLandedCostAllocation` répartit les coûts logistiques (fret + douane +
 * assurance) sur les lignes reçues des commandes liées, au prorata de la
 * valeur (`value`) ou de la quantité (`quantity`).
 */
const InboundShipment = require('../models/inboundShipmentModel');
const PurchaseOrder = require('../models/purchaseOrderModel');
const Location = require('../models/locationModel');

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

async function createShipment({
  tenantId, destinationLocationId, reference, containerNumber = '',
  supplierIds = [], purchaseOrderIds = [], origin = '',
  departureDate = null, arrivalDate = null, freightCost = 0, customsCost = 0,
  insuranceCost = 0, documents = [], note = '', userId = null,
}) {
  const location = await Location.findOne({ tenantId, _id: destinationLocationId }).select('_id').lean();
  if (!location) throw conflict('Boutique de destination introuvable dans cette organisation.');
  if (!String(reference || '').trim()) throw badRequest('La référence de l\'expédition est requise.');

  try {
    return await InboundShipment.create({
      tenantId,
      destinationLocationId,
      reference: String(reference).trim().toUpperCase(),
      containerNumber: String(containerNumber || '').trim(),
      supplierIds: supplierIds || [],
      purchaseOrderIds: purchaseOrderIds || [],
      origin: String(origin || '').trim(),
      departureDate: departureDate || null,
      arrivalDate: arrivalDate || null,
      status: 'planned',
      freightCost: Number(freightCost) || 0,
      customsCost: Number(customsCost) || 0,
      insuranceCost: Number(insuranceCost) || 0,
      documents: Array.isArray(documents) ? documents : [],
      note: String(note || '').slice(0, 500),
      createdBy: userId,
    });
  } catch (error) {
    if (error && error.code === 11000) throw conflict('Une expédition avec cette référence existe déjà.');
    throw error;
  }
}

async function updateShipment({ tenantId, shipmentId, data, userId = null }) {
  const shipment = await InboundShipment.findOne({ tenantId, _id: shipmentId });
  if (!shipment) throw notFound('Expédition introuvable dans cette organisation.');
  const stringKeys = ['containerNumber', 'origin', 'note', 'reference'];
  const numberKeys = ['freightCost', 'customsCost', 'insuranceCost'];
  const dateKeys = ['departureDate', 'arrivalDate'];
  for (const key of stringKeys) {
    if (data[key] !== undefined) shipment[key] = key === 'reference' ? String(data[key]).trim().toUpperCase() : String(data[key]).trim();
  }
  for (const key of numberKeys) {
    if (data[key] !== undefined) shipment[key] = Number(data[key]) || 0;
  }
  for (const key of dateKeys) {
    if (data[key] !== undefined) shipment[key] = data[key] || null;
  }
  if (data.supplierIds !== undefined) shipment.supplierIds = data.supplierIds;
  if (data.purchaseOrderIds !== undefined) shipment.purchaseOrderIds = data.purchaseOrderIds;
  if (data.documents !== undefined) shipment.documents = data.documents;
  await shipment.save();
  return shipment;
}

async function markInTransit({ tenantId, shipmentId, userId = null }) {
  const shipment = await InboundShipment.findOne({ tenantId, _id: shipmentId });
  if (!shipment) throw notFound('Expédition introuvable dans cette organisation.');
  if (shipment.status !== 'planned') throw conflict(`Impossible de démarrer une expédition « ${shipment.status} ».`);
  shipment.status = 'in_transit';
  await shipment.save();
  return shipment;
}

async function receiveShipment({ tenantId, shipmentId, userId = null }) {
  const shipment = await InboundShipment.findOne({ tenantId, _id: shipmentId });
  if (!shipment) throw notFound('Expédition introuvable dans cette organisation.');
  if (!['planned', 'in_transit'].includes(shipment.status)) {
    throw conflict(`Impossible de réceptionner une expédition « ${shipment.status} ».`);
  }
  shipment.status = 'received';
  shipment.receivedBy = userId;
  shipment.receivedAt = new Date();
  await shipment.save();
  return shipment;
}

async function cancelShipment({ tenantId, shipmentId, userId = null }) {
  const shipment = await InboundShipment.findOne({ tenantId, _id: shipmentId });
  if (!shipment) throw notFound('Expédition introuvable dans cette organisation.');
  if (!['planned', 'in_transit'].includes(shipment.status)) {
    throw conflict(`Impossible d'annuler une expédition « ${shipment.status} ».`);
  }
  shipment.status = 'cancelled';
  await shipment.save();
  return shipment;
}

/**
 * Répartition des coûts logistiques sur les lignes reçues des commandes liées.
 * `method` : 'value' (au prorata de la valeur) ou 'quantity' (au prorata des
 * quantités reçues).
 */
async function getLandedCostAllocation({ tenantId, shipmentId, method = 'value' }) {
  const shipment = await InboundShipment.findOne({ tenantId, _id: shipmentId }).lean();
  if (!shipment) throw notFound('Expédition introuvable dans cette organisation.');
  if (!['value', 'quantity'].includes(method)) throw badRequest('Méthode de répartition invalide (value|quantity).');

  const landedTotal = (shipment.freightCost || 0) + (shipment.customsCost || 0) + (shipment.insuranceCost || 0);
  const orders = await PurchaseOrder.find({
    tenantId, _id: { $in: shipment.purchaseOrderIds || [] },
    status: { $in: ['partially_received', 'received', 'closed'] },
  }).select('code lines').lean();

  const rows = [];
  let totalBase = 0;
  for (const order of orders) {
    for (const line of order.lines) {
      if ((line.receivedQuantity || 0) <= 0) continue;
      const value = line.receivedQuantity * (line.unitCost || 0);
      rows.push({ orderCode: order.code, product: line.product, receivedQuantity: line.receivedQuantity, value });
      totalBase += method === 'value' ? value : line.receivedQuantity;
    }
  }

  const allocations = rows.map((row) => {
    const base = method === 'value' ? row.value : row.receivedQuantity;
    const allocated = totalBase > 0 ? Number(((landedTotal * base) / totalBase).toFixed(2)) : 0;
    return { ...row, landedCost: allocated };
  });
  return { shipment, method, landedTotal, allocations };
}

module.exports = {
  createShipment, updateShipment, markInTransit, receiveShipment, cancelShipment,
  getLandedCostAllocation,
};
