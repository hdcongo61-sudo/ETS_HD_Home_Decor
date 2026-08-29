/**
 * SupplierInvoiceService — factures fournisseur et dettes (Phase 6.6).
 *
 * Fondation payable : lignes dérivées des réceptions (par défaut) ou fournies,
 * détection des écarts commande/réception/facture, paiements partiels avec
 * garde anti-sur-paiement, synthèse des dettes par fournisseur.
 */
const SupplierInvoice = require('../models/supplierInvoiceModel');
const PurchaseOrder = require('../models/purchaseOrderModel');
const Supplier = require('../models/supplierModel');

const round2 = (value) => Math.round(Number(value) * 100) / 100;

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

async function createInvoice({
  tenantId, supplierId, invoiceNumber, purchaseOrderIds = [], shipmentId = null,
  issueDate = null, dueDate = null, currency = 'XOF', lines = null, note = '', userId = null,
}) {
  const supplier = await Supplier.findOne({ tenantId, _id: supplierId }).select('_id').lean();
  if (!supplier) throw conflict('Fournisseur introuvable dans cette organisation.');
  if (!String(invoiceNumber || '').trim()) throw badRequest('Le numéro de facture est requis.');

  const orders = purchaseOrderIds && purchaseOrderIds.length
    ? await PurchaseOrder.find({ tenantId, _id: { $in: purchaseOrderIds } })
      .select('code lines status')
      .lean()
    : [];

  // Lignes dérivées des réceptions par défaut ; sinon, lignes fournies par l'appelant.
  let invoiceLines;
  if (Array.isArray(lines) && lines.length > 0) {
    invoiceLines = lines.map((line) => {
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) throw badRequest('Quantité facturée invalide.');
      const unitCost = Number(line.unitCost) || 0;
      const taxRate = Number(line.taxRate) || 0;
      return {
        product: line.product,
        description: String(line.description || '').slice(0, 300),
        quantity,
        unitCost,
        taxRate,
        lineTotal: round2(quantity * unitCost * (1 + taxRate / 100)),
      };
    });
  } else {
    invoiceLines = [];
    for (const order of orders) {
      for (const line of order.lines) {
        if ((line.receivedQuantity || 0) <= 0) continue;
        invoiceLines.push({
          product: line.product,
          description: line.description || '',
          quantity: line.receivedQuantity,
          unitCost: line.unitCost || 0,
          taxRate: line.taxRate || 0,
          lineTotal: round2(line.receivedQuantity * (line.unitCost || 0) * (1 + (line.taxRate || 0) / 100)),
        });
      }
    }
    if (invoiceLines.length === 0) throw conflict('Aucune ligne reçue à facturer sur ces commandes.');
  }

  const subtotal = round2(invoiceLines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0));
  const taxTotal = round2(invoiceLines.reduce((sum, l) => sum + l.quantity * l.unitCost * (l.taxRate / 100), 0));
  const totalAmount = round2(subtotal + taxTotal);

  return SupplierInvoice.create({
    tenantId,
    supplierId,
    invoiceNumber: String(invoiceNumber).trim().toUpperCase(),
    purchaseOrderIds: purchaseOrderIds || [],
    shipmentId,
    issueDate: issueDate || new Date(),
    dueDate: dueDate || null,
    currency: String(currency || 'XOF').toUpperCase(),
    status: 'draft',
    lines: invoiceLines,
    subtotal,
    taxTotal,
    totalAmount,
    paidAmount: 0,
    note: String(note || '').slice(0, 500),
    createdBy: userId,
  });
}

async function postInvoice({ tenantId, invoiceId, userId = null }) {
  const invoice = await SupplierInvoice.findOne({ tenantId, _id: invoiceId });
  if (!invoice) throw notFound('Facture introuvable dans cette organisation.');
  if (invoice.status !== 'draft') throw conflict(`Impossible de poster une facture « ${invoice.status} ».`);
  invoice.status = 'posted';
  invoice.postedBy = userId;
  invoice.postedAt = new Date();
  await invoice.save();
  return invoice;
}

async function cancelInvoice({ tenantId, invoiceId, userId = null }) {
  const invoice = await SupplierInvoice.findOne({ tenantId, _id: invoiceId });
  if (!invoice) throw notFound('Facture introuvable dans cette organisation.');
  if (invoice.status !== 'draft') throw conflict(`Seule une facture au statut « draft » peut être annulée (« ${invoice.status} » actuel).`);
  invoice.status = 'cancelled';
  invoice.postedBy = userId;
  invoice.postedAt = new Date();
  await invoice.save();
  return invoice;
}

async function registerInvoicePayment({
  tenantId, invoiceId, amount, method = 'cash', date = null, paidBy = null,
}) {
  const invoice = await SupplierInvoice.findOne({ tenantId, _id: invoiceId });
  if (!invoice) throw notFound('Facture introuvable dans cette organisation.');
  if (!['posted', 'partially_paid'].includes(invoice.status)) {
    throw conflict(`Impossible de payer une facture « ${invoice.status} ».`);
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw badRequest('Montant de paiement invalide.');

  const remaining = round2(invoice.totalAmount - invoice.paidAmount);
  if (value > remaining + 0.005) {
    throw conflict(`Le montant dépasse le restant dû (${remaining.toFixed(2)} ${invoice.currency}).`);
  }

  invoice.payments.push({
    amount: round2(value),
    method: ['cash', 'bank_transfer', 'MobileMoney', 'check', 'other'].includes(method) ? method : 'cash',
    date: date || new Date(),
    paidBy,
  });
  invoice.paidAmount = round2(invoice.paidAmount + value);
  invoice.status = invoice.paidAmount + 0.005 >= invoice.totalAmount ? 'paid' : 'partially_paid';
  await invoice.save();
  return invoice;
}

/**
 * Écarts commande/réception ↔ facture : quantités et coûts différents.
 */
async function detectDiscrepancies({ tenantId, invoiceId }) {
  const invoice = await SupplierInvoice.findOne({ tenantId, _id: invoiceId }).lean();
  if (!invoice) throw notFound('Facture introuvable dans cette organisation.');

  const orders = await PurchaseOrder.find({
    tenantId, _id: { $in: invoice.purchaseOrderIds || [] },
  }).select('code lines').lean();

  const receivedByProduct = new Map();
  const receivedCostByProduct = new Map();
  for (const order of orders) {
    for (const line of order.lines) {
      if ((line.receivedQuantity || 0) <= 0) continue;
      const key = String(line.product);
      receivedByProduct.set(key, (receivedByProduct.get(key) || 0) + line.receivedQuantity);
      receivedCostByProduct.set(key, line.unitCost || 0);
    }
  }

  const discrepancies = [];
  for (const line of invoice.lines) {
    const key = String(line.product);
    const receivedQty = receivedByProduct.get(key) || 0;
    const receivedCost = receivedCostByProduct.get(key);
    if (line.quantity !== receivedQty) {
      discrepancies.push({
        product: line.product,
        kind: 'quantity',
        invoiceQuantity: line.quantity,
        receivedQuantity: receivedQty,
      });
    }
    if (receivedCost !== undefined && line.unitCost !== receivedCost) {
      discrepancies.push({
        product: line.product,
        kind: 'unit_cost',
        invoiceUnitCost: line.unitCost,
        receivedUnitCost: receivedCost,
      });
    }
  }
  return { invoiceId, discrepancies, count: discrepancies.length };
}

async function getPayableSummary({ tenantId, supplierId = null }) {
  const filter = { tenantId, status: { $in: ['posted', 'partially_paid'] } };
  if (supplierId) filter.supplierId = supplierId;
  const invoices = await SupplierInvoice.find(filter).select('supplierId totalAmount paidAmount currency').lean();
  const bySupplier = new Map();
  for (const invoice of invoices) {
    const key = String(invoice.supplierId);
    const entry = bySupplier.get(key) || { supplierId: invoice.supplierId, total: 0, paid: 0, due: 0, currency: invoice.currency };
    entry.total = round2(entry.total + invoice.totalAmount);
    entry.paid = round2(entry.paid + invoice.paidAmount);
    entry.due = round2(entry.total - entry.paid);
    bySupplier.set(key, entry);
  }
  return [...bySupplier.values()];
}

module.exports = {
  createInvoice, postInvoice, cancelInvoice, registerInvoicePayment, detectDiscrepancies, getPayableSummary,
};
