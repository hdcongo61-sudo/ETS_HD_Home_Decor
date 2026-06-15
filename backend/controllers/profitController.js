// controllers/profitController.js
const Sale = require('../models/saleModel');
const Product = require('../models/productModel');
const StockMovement = require('../models/stockMovementModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

// @desc    Obtenir les analyses de bénéfices
// @route   GET /api/sales/profit-analytics
// @access  Private/Admin
const getProfitAnalytics = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate, container } = req.query;

    // Container filter → resolve matching product IDs once.
    let containerProductIds = null;
    if (container) {
      const cp = await Product.find({ ...tenantFilter(req), container }, '_id').lean();
      containerProductIds = cp.map((p) => p._id);
    }

    // Single base match, explicitly tenant-scoped (belt-and-suspenders with the plugin).
    const baseMatch = {
      ...tenantFilter(req),
      status: { $ne: 'cancelled' },
      ...((startDate || endDate) ? {
        saleDate: {
          ...(startDate ? { $gte: new Date(startDate) } : {}),
          ...(endDate ? { $lte: new Date(endDate) } : {}),
        },
      } : {}),
      ...(containerProductIds ? { 'products.product': { $in: containerProductIds } } : {}),
    };

    // Human-readable, year-aware period key built from the sale date.
    const periodKey = {
      day:   { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
      week:  { $dateToString: { format: '%G-S%V', date: '$saleDate' } },
      month: { $dateToString: { format: '%Y-%m', date: '$saleDate' } },
      year:  { $dateToString: { format: '%Y', date: '$saleDate' } },
    }[period] || { $dateToString: { format: '%Y-%m', date: '$saleDate' } };

    // ── 1) Headline stats — single source of truth: profitData snapshot ──
    // (profit/cost captured at sale time; portfolio margin = profit / revenue).
    const generalAgg = await Sale.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: { $ifNull: ['$profitData.totalProfit', 0] } },
          totalCost: { $sum: { $ifNull: ['$profitData.totalCost', 0] } },
          saleCount: { $sum: 1 },
          profitableSales: { $sum: { $cond: [{ $gt: ['$profitData.totalProfit', 0] }, 1, 0] } },
          lossSales: { $sum: { $cond: [{ $lt: ['$profitData.totalProfit', 0] }, 1, 0] } },
        },
      },
    ]);

    const g = generalAgg[0] || {};
    const totalRevenue = g.totalRevenue || 0;
    const totalProfit = g.totalProfit || 0;

    // ── Stock losses (casse/cadeau …) over the SAME period → reduce net profit.
    // Movements are tracked separately (StockMovement) and never mutate sale
    // snapshots, so net = gross sales profit − losses, fully auditable.
    const lossMatch = {
      ...tenantFilter(req),
      ...((startDate || endDate) ? {
        createdAt: {
          ...(startDate ? { $gte: new Date(startDate) } : {}),
          ...(endDate ? { $lte: new Date(endDate) } : {}),
        },
      } : {}),
      ...(container ? { container } : {}),
    };
    const lossAgg = await StockMovement.aggregate([
      { $match: lossMatch },
      { $group: { _id: '$reason', cost: { $sum: '$costImpact' }, quantity: { $sum: '$quantity' } } },
    ]);
    const lossByReason = lossAgg.map((r) => ({ reason: r._id, cost: r.cost || 0, quantity: r.quantity || 0 }));
    const lossOf = (reason) => lossByReason.find((r) => r.reason === reason)?.cost || 0;
    const lossCasse = lossOf('casse') + lossOf('vol') + lossOf('peremption');
    const lossCadeau = lossOf('cadeau');
    const lossOther = lossByReason.reduce((s, r) => s + r.cost, 0) - lossCasse - lossCadeau;
    const lossCost = lossCasse + lossCadeau + lossOther;
    const netProfit = totalProfit - lossCost;

    // Per-product losses to net out the product breakdown.
    const lossProductAgg = await StockMovement.aggregate([
      { $match: lossMatch },
      { $group: { _id: '$product', cost: { $sum: '$costImpact' } } },
    ]);
    const lossByProduct = {};
    lossProductAgg.forEach((r) => { if (r._id) lossByProduct[String(r._id)] = r.cost || 0; });

    const generalStats = {
      totalRevenue,
      totalProfit,            // gross profit from sales (kept for back-compat)
      grossProfit: totalProfit,
      lossCost,
      lossCasse,
      lossCadeau,
      lossOther,
      lossByReason,
      netProfit,
      netMargin: totalRevenue ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0,
      totalCost: g.totalCost || 0,
      saleCount: g.saleCount || 0,
      profitableSales: g.profitableSales || 0,
      lossSales: g.lossSales || 0,
      averageProfit: g.saleCount ? Math.round(totalProfit / g.saleCount) : 0,
      averageMargin: totalRevenue ? Number(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
    };

    // ── 2) Period trend — revenue, profit and (derived) margin per bucket ──
    const periodAnalytics = await Sale.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: periodKey,
          totalSales: { $sum: '$totalAmount' },
          totalProfit: { $sum: { $ifNull: ['$profitData.totalProfit', 0] } },
          totalCost: { $sum: { $ifNull: ['$profitData.totalCost', 0] } },
          saleCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          margin: {
            $cond: [{ $eq: ['$totalSales', 0] }, 0,
              { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalSales'] }, 100] }, 1] }],
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── Shared per-line pipeline using the profitData.productProfits SNAPSHOT ──
    // This guarantees product/category/container totals reconcile with the
    // headline (both use the cost captured at sale time, not current cost).
    const lineBase = [
      { $match: baseMatch },
      { $unwind: '$profitData.productProfits' },
      {
        $lookup: {
          from: 'products',
          localField: 'profitData.productProfits.product',
          foreignField: '_id',
          as: 'pi',
        },
      },
      { $unwind: { path: '$pi', preserveNullAndEmptyArrays: true } },
      ...(container ? [{ $match: { 'pi.container': container } }] : []),
    ];

    const lineFields = {
      lineRevenue: { $ifNull: ['$profitData.productProfits.revenue', 0] },
      lineProfit: { $ifNull: ['$profitData.productProfits.profit', 0] },
      lineQty: { $ifNull: ['$profitData.productProfits.quantity', 0] },
    };

    // Top products
    const topProducts = await Sale.aggregate([
      ...lineBase,
      { $addFields: lineFields },
      {
        $group: {
          _id: '$profitData.productProfits.product',
          productName: { $first: '$profitData.productProfits.productName' },
          category: { $first: '$pi.category' },
          totalQuantity: { $sum: '$lineQty' },
          totalRevenue: { $sum: '$lineRevenue' },
          totalProfit: { $sum: '$lineProfit' },
        },
      },
      {
        $addFields: {
          totalCost: { $subtract: ['$totalRevenue', '$totalProfit'] },
          profitMargin: {
            $cond: [{ $eq: ['$totalRevenue', 0] }, 0,
              { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 2] }],
          },
        },
      },
      { $sort: { totalProfit: -1 } },
      { $limit: 12 },
    ]);

    // Net out per-product losses (casse/cadeau) over the period.
    topProducts.forEach((p) => {
      p.lossCost = lossByProduct[String(p._id)] || 0;
      p.netProfit = (p.totalProfit || 0) - p.lossCost;
    });

    // By category
    const profitByCategory = await Sale.aggregate([
      ...lineBase,
      { $addFields: lineFields },
      {
        $group: {
          _id: { $ifNull: ['$pi.category', 'Non catégorisé'] },
          totalRevenue: { $sum: '$lineRevenue' },
          totalProfit: { $sum: '$lineProfit' },
          totalQuantity: { $sum: '$lineQty' },
        },
      },
      {
        $addFields: {
          profitMargin: {
            $cond: [{ $eq: ['$totalRevenue', 0] }, 0,
              { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 2] }],
          },
        },
      },
      { $sort: { totalProfit: -1 } },
    ]);

    // By container
    const profitByContainer = await Sale.aggregate([
      { $match: baseMatch },
      { $unwind: '$profitData.productProfits' },
      {
        $lookup: {
          from: 'products',
          localField: 'profitData.productProfits.product',
          foreignField: '_id',
          as: 'pi',
        },
      },
      { $unwind: { path: '$pi', preserveNullAndEmptyArrays: true } },
      { $addFields: lineFields },
      {
        $group: {
          _id: { $ifNull: ['$pi.container', 'Non défini'] },
          totalRevenue: { $sum: '$lineRevenue' },
          totalProfit: { $sum: '$lineProfit' },
          totalQuantity: { $sum: '$lineQty' },
        },
      },
      {
        $addFields: {
          totalCost: { $subtract: ['$totalRevenue', '$totalProfit'] },
          profitMargin: {
            $cond: [{ $eq: ['$totalRevenue', 0] }, 0,
              { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 1] }],
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Detail coverage: share of revenue that has line-level snapshot detail
    // (older sales may lack productProfits, so breakdowns can be < headline).
    const categoryRevenue = profitByCategory.reduce((s, c) => s + (c.totalRevenue || 0), 0);
    generalStats.detailCoverage = totalRevenue > 0
      ? Number(((categoryRevenue / totalRevenue) * 100).toFixed(0))
      : 100;

    res.json({
      success: true,
      data: {
        periodAnalytics,
        topProducts,
        generalStats,
        profitByCategory,
        profitByContainer,
        filters: { period, startDate, endDate, container },
      },
    });
  } catch (error) {
    console.error('Erreur analyse bénéfices:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'analyse des bénéfices",
      error: error.message,
    });
  }
};

// @desc    Obtenir le rapport détaillé des bénéfices
// @route   GET /api/sales/profit-report
// @access  Private/Admin
const getProfitReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.saleDate = {};
      if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
      if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
    }

    const report = await Sale.aggregate([
      { 
        $match: { 
          ...dateFilter, 
          status: { $ne: 'cancelled' } 
        } 
      },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $group: {
          _id: '$products.product',
          productName: { $first: '$productInfo.name' },
          category: { $first: '$productInfo.category' },
          totalQuantity: { $sum: '$products.quantity' },
          totalRevenue: { $sum: { $multiply: ['$products.quantity', '$products.priceAtSale'] } },
          totalCost: { 
            $sum: { 
              $multiply: [
                '$products.quantity', 
                { $ifNull: ['$productInfo.costPrice', 0] }
              ] 
            } 
          }
        }
      },
      {
        $project: {
          productName: 1,
          category: 1,
          totalQuantity: 1,
          totalRevenue: 1,
          totalCost: 1,
          totalProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
          profitMargin: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              { $multiply: [{ $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] }, 100] }
            ]
          }
        }
      },
      { $sort: { totalProfit: -1 } }
    ]);

    // Calcul des totaux
    const totals = report.reduce((acc, item) => ({
      totalRevenue: acc.totalRevenue + item.totalRevenue,
      totalCost: acc.totalCost + item.totalCost,
      totalProfit: acc.totalProfit + item.totalProfit,
      totalQuantity: acc.totalQuantity + item.totalQuantity
    }), { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalQuantity: 0 });

    res.json({
      success: true,
      data: {
        report,
        totals: {
          ...totals,
          overallMargin: totals.totalRevenue > 0 ? 
            (totals.totalProfit / totals.totalRevenue) * 100 : 0
        },
        period: { startDate, endDate }
      }
    });

  } catch (error) {
    console.error('Erreur rapport bénéfices:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport',
      error: error.message
    });
  }
};

module.exports = {
  getProfitAnalytics,
  getProfitReport
};