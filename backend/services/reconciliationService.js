/**
 * ReconciliationService — rapport de réconciliation final par organisation
 * (Phase 8.7).
 *
 * Comptages par collection, stocks legacy vs registre, totaux ventes/
 * paiements/retours/achats, orphelins, doublons, version de migration.
 * Le rapport est archivé avec un checksum SHA-256 (contenu signé).
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const CutoverReport = require('../models/cutoverReportModel');
const Product = require('../models/productModel');
const Sale = require('../models/saleModel');
const Client = require('../models/clientModel');
const StockMovement = require('../models/stockMovementModel');
const InventoryBalance = require('../models/inventoryBalanceModel');
const Payment = require('../models/paymentModel');
const Refund = require('../models/refundModel');
const SaleReturn = require('../models/saleReturnModel');
const PurchaseOrder = require('../models/purchaseOrderModel');
const SupplierInvoice = require('../models/supplierInvoiceModel');
const Supplier = require('../models/supplierModel');
const SupplierProduct = require('../models/supplierProductModel');
const User = require('../models/userModel');
const Expense = require('../models/expenseModel');
const Location = require('../models/locationModel');
const CashSession = require('../models/cashSessionModel');
const InboundShipment = require('../models/inboundShipmentModel');
const StockCount = require('../models/stockCountModel');
const StockTransfer = require('../models/stockTransferModel');
const NumberSequence = require('../models/numberSequenceModel');
const ExportJob = require('../models/exportJobModel');
const ImportJob = require('../models/importJobModel');
const Category = require('../models/categoryModel');
const Proforma = require('../models/proformaModel');
const { MODULE_VERSION } = require('../config/modules');
const pkg = require('../package.json');

const COUNTED_MODELS = {
  sales: Sale, products: Product, clients: Client, stockMovements: StockMovement,
  inventoryBalances: InventoryBalance, payments: Payment, refunds: Refund,
  saleReturns: SaleReturn, purchaseOrders: PurchaseOrder, supplierInvoices: SupplierInvoice,
  suppliers: Supplier, supplierProducts: SupplierProduct, users: User, expenses: Expense,
  locations: Location, cashSessions: CashSession, inboundShipments: InboundShipment,
  stockCounts: StockCount, stockTransfers: StockTransfer, numberSequences: NumberSequence,
  exportJobs: ExportJob, importJobs: ImportJob, categories: Category, proformas: Proforma,
};

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const checksumOf = (report) => crypto.createHash('sha256').update(stableStringify(report)).digest('hex');

async function buildReport({ tenantId }) {
  // Les agrégats bruts ne castent pas : normaliser explicitement en ObjectId.
  const tenant = mongoose.Types.ObjectId.isValid(tenantId)
    ? new mongoose.Types.ObjectId(tenantId)
    : tenantId;

  const counts = {};
  for (const [name, Model] of Object.entries(COUNTED_MODELS)) {
    counts[name] = await Model.countDocuments({ tenantId: tenant });
  }

  // Stocks legacy vs registre.
  const [legacy] = await Product.aggregate([
    { $match: { tenantId: tenant } },
    { $group: { _id: null, units: { $sum: '$stock' }, value: { $sum: { $multiply: ['$stock', { $ifNull: ['$costPrice', 0] }] } } } },
  ]);
  const [registry] = await InventoryBalance.aggregate([
    { $match: { tenantId: tenant } },
    { $group: { _id: null, units: { $sum: '$onHand' } } },
  ]);
  const stock = {
    legacyUnits: legacy ? legacy.units : 0,
    legacyValue: legacy ? round2(legacy.value) : 0,
    registryUnits: registry ? registry.units : 0,
    difference: (registry ? registry.units : 0) - (legacy ? legacy.units : 0),
  };

  // Ventes / paiements / retours.
  const [sales] = await Sale.aggregate([
    { $match: { tenantId: tenant, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: null,
        invoiced: { $sum: '$totalAmount' },
        profit: { $sum: { $ifNull: ['$profitData.totalProfit', 0] } },
        cost: { $sum: { $ifNull: ['$profitData.totalCost', 0] } },
      },
    },
  ]);
  const [paid] = await Payment.aggregate([
    { $match: { tenantId: tenant, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const [refunded] = await Refund.aggregate([
    { $match: { tenantId: tenant, status: { $ne: 'reversed' } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const postedReturns = await SaleReturn.countDocuments({ tenantId: tenant, status: 'posted' });
  const finance = {
    invoiced: sales ? round2(sales.invoiced) : 0,
    collected: paid ? round2(paid.total) : 0,
    outstanding: sales ? round2(sales.invoiced - (paid ? paid.total : 0)) : 0,
    refunded: refunded ? round2(refunded.total) : 0,
    profit: sales ? round2(sales.profit) : 0,
    cost: sales ? round2(sales.cost) : 0,
    postedReturns,
  };

  // Achats.
  const [purchases] = await PurchaseOrder.aggregate([
    { $match: { tenantId: tenant } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const [payables] = await SupplierInvoice.aggregate([
    { $match: { tenantId: tenant, status: { $in: ['posted', 'partially_paid'] } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$paidAmount' } } },
  ]);
  const purchasing = {
    ordersTotal: purchases ? round2(purchases.total) : 0,
    payablesDue: payables ? round2(payables.total - payables.paid) : 0,
  };

  // Orphelins (références sans document cible).
  const orphanBalance = await InventoryBalance.aggregate([
    { $match: { tenantId: tenant } },
    {
      $lookup: {
        from: 'products', localField: 'productId', foreignField: '_id', as: 'product',
      },
    },
    { $match: { product: { $size: 0 } } },
    { $count: 'orphans' },
  ]);
  const orphanMovements = await StockMovement.aggregate([
    { $match: { tenantId: tenant } },
    {
      $lookup: {
        from: 'products', localField: 'product', foreignField: '_id', as: 'product',
      },
    },
    { $match: { product: { $size: 0 } } },
    { $count: 'orphans' },
  ]);
  const orphanPayments = await Payment.aggregate([
    { $match: { tenantId: tenant } },
    {
      $lookup: {
        from: 'sales', localField: 'saleId', foreignField: '_id', as: 'sale',
      },
    },
    { $match: { sale: { $size: 0 } } },
    { $count: 'orphans' },
  ]);

  // Doublons de SKU (produits actifs).
  const [duplicates] = await Product.aggregate([
    { $match: { tenantId: tenant, sku: { $type: 'string' } } },
    { $group: { _id: '$sku', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $group: { _id: null, skus: { $sum: 1 }, extra: { $sum: { $subtract: ['$count', 1] } } } },
  ]);

  const exceptions = [];
  if (stock.difference !== 0) exceptions.push({ kind: 'stock_difference', detail: stock.difference });
  const orphans = {
    inventoryBalances: orphanBalance.length ? orphanBalance[0].orphans : 0,
    stockMovements: orphanMovements.length ? orphanMovements[0].orphans : 0,
    payments: orphanPayments.length ? orphanPayments[0].orphans : 0,
  };
  if (orphans.inventoryBalances || orphans.stockMovements || orphans.payments) {
    exceptions.push({ kind: 'orphans', detail: orphans });
  }

  return {
    tenantId,
    generatedAt: new Date(),
    migrationVersion: MODULE_VERSION,
    softwareRevision: pkg.version || 'unknown',
    counts,
    stock,
    finance,
    purchasing,
    orphans,
    duplicates: duplicates ? { skus: duplicates.skus, extraProducts: duplicates.extra } : { skus: 0, extraProducts: 0 },
    exceptions,
  };
}

async function archiveReport({ tenantId, userId = null }) {
  const report = await buildReport({ tenantId });
  const checksum = checksumOf(report);
  const archived = await CutoverReport.create({
    tenantId,
    migrationVersion: report.migrationVersion,
    softwareRevision: report.softwareRevision,
    report,
    checksum,
    generatedBy: userId,
    generatedAt: report.generatedAt,
  });
  return { archivedId: archived._id, checksum, report };
}

async function listReports({ tenantId }) {
  return CutoverReport.find({ tenantId }).select('checksum migrationVersion generatedAt').sort({ generatedAt: -1 }).limit(50).lean();
}

async function getReport({ tenantId, reportId }) {
  const report = await CutoverReport.findOne({ tenantId, _id: reportId }).lean();
  if (!report) {
    const err = new Error('Rapport introuvable dans cette organisation.');
    err.statusCode = 404;
    throw err;
  }
  // Le checksum archivé doit correspondre au contenu (intégrité signée).
  return { ...report, checksumValid: checksumOf(report.report) === report.checksum };
}

module.exports = { buildReport, archiveReport, listReports, getReport };
