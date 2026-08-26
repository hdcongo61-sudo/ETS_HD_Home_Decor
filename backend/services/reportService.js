/**
 * ReportService — reporting paginé côté serveur (Phase 7.6).
 *
 * Les agrégations tournent en base ; le navigateur ne charge jamais les
 * collections entières. Métriques financières protégées par la permission
 * `reporting.view` (au niveau de la route).
 */
const Sale = require('../models/saleModel');
const InventoryBalance = require('../models/inventoryBalanceModel');

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const parseRange = (from, to) => {
  const filter = {};
  if (from) {
    const fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) throw badRequest('Date `from` invalide.');
    filter.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) throw badRequest('Date `to` invalide.');
    filter.$lte = toDate;
  }
  return filter;
};

const GROUP_EXPRESSIONS = {
  day: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
  week: { $dateToString: { format: '%G-W%V', date: '$saleDate' } },
  month: { $dateToString: { format: '%Y-%m', date: '$saleDate' } },
  year: { $dateToString: { format: '%Y', date: '$saleDate' } },
};

/**
 * Ventes agrégées par période (jour/semaine/mois/année), paginées.
 * Métriques : ventes (HT encaissé), total facturé, encaissé, restant dû.
 */
async function salesReport({ tenantId, locationId = null, from = null, to = null, groupBy = 'day', page = 1, limit = 50 }) {
  const expression = GROUP_EXPRESSIONS[groupBy];
  if (!expression) throw badRequest('groupBy invalide (day|week|month|year).');
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 50));

  const match = {
    tenantId,
    status: { $ne: 'cancelled' },
  };
  const dateRange = parseRange(from, to);
  if (Object.keys(dateRange).length > 0) match.saleDate = dateRange;
  if (locationId) match.locationId = locationId;

  const basePipeline = [
    { $match: match },
    {
      $addFields: {
        collectedAmount: {
          $reduce: {
            input: { $ifNull: ['$payments', []] },
            initialValue: 0,
            in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
          },
        },
      },
    },
  ];

  const rows = await Sale.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: expression,
        orders: { $sum: 1 },
        invoiced: { $sum: '$totalAmount' },
        collected: { $sum: '$collectedAmount' },
      },
    },
    { $sort: { _id: 1 } },
    { $skip: (safePage - 1) * safeLimit },
    { $limit: safeLimit },
  ]);

  const totals = await Sale.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        invoiced: { $sum: '$totalAmount' },
        collected: { $sum: '$collectedAmount' },
      },
    },
  ]);

  const periods = rows.map((row) => ({
    period: row._id,
    orders: row.orders,
    invoiced: round2(row.invoiced),
    collected: round2(row.collected),
    outstanding: round2(row.invoiced - row.collected),
  }));
  const summary = totals.length
    ? {
        orders: totals[0].orders,
        invoiced: round2(totals[0].invoiced),
        collected: round2(totals[0].collected),
        outstanding: round2(totals[0].invoiced - totals[0].collected),
      }
    : { orders: 0, invoiced: 0, collected: 0, outstanding: 0 };

  return { groupBy, page: safePage, limit: safeLimit, summary, periods };
}

/**
 * État des stocks par produit (paginé) : quantités et valorisation au coût,
 * plus un résumé global (unités, valeur, alertes stock bas).
 */
async function inventoryReport({ tenantId, locationId = null, page = 1, limit = 50, minStockOnly = false }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 50));

  const match = { tenantId };
  if (locationId) match.locationId = locationId;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'products',
        let: { productId: '$productId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$productId'] } } },
          { $project: { name: 1, sku: 1, costPrice: 1, minStockLevel: 1 } },
        ],
        as: 'productInfo',
      },
    },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        productId: 1,
        name: { $ifNull: ['$productInfo.name', '—'] },
        sku: { $ifNull: ['$productInfo.sku', ''] },
        onHand: 1,
        reserved: 1,
        available: 1,
        unitCost: { $ifNull: ['$productInfo.costPrice', 0] },
        minStockLevel: { $ifNull: ['$productInfo.minStockLevel', 0] },
      },
    },
  ];
  if (minStockOnly) {
    pipeline.push({ $match: { $expr: { $lt: ['$available', '$minStockLevel'] } } });
  }
  const rows = await InventoryBalance.aggregate([
    ...pipeline,
    { $sort: { onHand: -1, name: 1 } },
    { $skip: (safePage - 1) * safeLimit },
    { $limit: safeLimit },
  ]);

  const summaryRows = await InventoryBalance.aggregate([...pipeline, {
    $group: {
      _id: null,
      units: { $sum: '$onHand' },
      value: { $sum: { $multiply: ['$onHand', '$unitCost'] } },
      lowStock: { $sum: { $cond: [{ $lt: ['$available', '$minStockLevel'] }, 1, 0] } },
    },
  }]);
  const summary = summaryRows.length
    ? { units: summaryRows[0].units, value: round2(summaryRows[0].value), lowStock: summaryRows[0].lowStock }
    : { units: 0, value: 0, lowStock: 0 };

  const items = rows.map((row) => ({
    ...row,
    value: round2(row.onHand * row.unitCost),
  }));

  return { page: safePage, limit: safeLimit, summary, items };
}

module.exports = { salesReport, inventoryReport };
