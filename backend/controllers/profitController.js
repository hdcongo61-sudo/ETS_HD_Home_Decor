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

    // ── 2b) Cash-basis (encaissé) — realized profit recognized by PAYMENT date ──
    // Each payment realizes its share of the sale margin: amount × (profit / total).
    // The date range here filters on the PAYMENT date, so a payment received in the
    // period counts even when the sale itself is older (partial / deferred payments).
    const paymentPeriodKey = {
      day:   { $dateToString: { format: '%Y-%m-%d', date: '$__payDate' } },
      week:  { $dateToString: { format: '%G-S%V', date: '$__payDate' } },
      month: { $dateToString: { format: '%Y-%m', date: '$__payDate' } },
      year:  { $dateToString: { format: '%Y', date: '$__payDate' } },
    }[period] || { $dateToString: { format: '%Y-%m', date: '$__payDate' } };

    const realizedBaseMatch = {
      ...tenantFilter(req),
      status: { $ne: 'cancelled' },
      ...(containerProductIds ? { 'products.product': { $in: containerProductIds } } : {}),
    };

    const realizedAgg = await Sale.aggregate([
      { $match: realizedBaseMatch },
      {
        $addFields: {
          __ratio: {
            $cond: [{ $gt: ['$totalAmount', 0] },
              { $divide: [{ $ifNull: ['$profitData.totalProfit', 0] }, '$totalAmount'] }, 0],
          },
        },
      },
      { $unwind: '$payments' },
      { $addFields: { __payDate: { $ifNull: ['$payments.paymentDate', '$saleDate'] } } },
      ...((startDate || endDate) ? [{
        $match: {
          __payDate: {
            ...(startDate ? { $gte: new Date(startDate) } : {}),
            ...(endDate ? { $lte: new Date(endDate) } : {}),
          },
        },
      }] : []),
      { $addFields: { __realized: { $multiply: [{ $ifNull: ['$payments.amount', 0] }, '$__ratio'] } } },
      {
        $group: {
          _id: paymentPeriodKey,
          realizedProfit: { $sum: '$__realized' },
          collected: { $sum: { $ifNull: ['$payments.amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const realizedTotals = realizedAgg.reduce(
      (acc, r) => ({
        realizedProfit: acc.realizedProfit + (r.realizedProfit || 0),
        collected: acc.collected + (r.collected || 0),
      }),
      { realizedProfit: 0, collected: 0 },
    );

    // Cash-basis headline figures (encaissé), kept alongside the accrual ones.
    Object.assign(generalStats, {
      expectedProfit: totalProfit,                                  // accrual (sales in range)
      realizedProfit: Math.round(realizedTotals.realizedProfit),   // encaissé (payments in range)
      collectedRevenue: Math.round(realizedTotals.collected),
      realizedNetProfit: Math.round(realizedTotals.realizedProfit - lossCost),
      realizedMargin: realizedTotals.collected
        ? Number(((realizedTotals.realizedProfit / realizedTotals.collected) * 100).toFixed(2))
        : 0,
    });

    // Merge realized figures into the period trend (union of accrual + payment keys).
    periodAnalytics.forEach((p) => { p.realizedProfit = 0; p.collected = 0; });
    const periodMap = new Map(periodAnalytics.map((p) => [p._id, p]));
    realizedAgg.forEach((r) => {
      const existing = periodMap.get(r._id);
      if (existing) {
        existing.realizedProfit = Math.round(r.realizedProfit || 0);
        existing.collected = Math.round(r.collected || 0);
      } else {
        periodMap.set(r._id, {
          _id: r._id,
          totalSales: 0,
          totalProfit: 0,
          totalCost: 0,
          saleCount: 0,
          margin: 0,
          realizedProfit: Math.round(r.realizedProfit || 0),
          collected: Math.round(r.collected || 0),
        });
      }
    });
    const mergedPeriodAnalytics = Array.from(periodMap.values())
      .sort((a, b) => String(a._id).localeCompare(String(b._id)));

    // ── Shared per-line pipeline — CASH-BASIS (encaissé) ──
    // Each sale's line revenue/profit is weighted by the share of the sale total
    // COLLECTED within the period (payments dated in range). So a previous sale
    // paid now contributes its margin to this period's product/category/container
    // breakdown — consistent with the "Bénéfice encaissé" headline.
    const collectedInRangeExpr = {
      $sum: {
        $map: {
          input: {
            $filter: {
              input: { $ifNull: ['$payments', []] },
              as: 'p',
              cond: {
                $and: [
                  ...(startDate ? [{ $gte: [{ $ifNull: ['$$p.paymentDate', '$saleDate'] }, new Date(startDate)] }] : []),
                  ...(endDate ? [{ $lte: [{ $ifNull: ['$$p.paymentDate', '$saleDate'] }, new Date(endDate)] }] : []),
                ],
              },
            },
          },
          as: 'p',
          in: { $ifNull: ['$$p.amount', 0] },
        },
      },
    };

    const lineBase = [
      {
        $match: {
          ...tenantFilter(req),
          status: { $ne: 'cancelled' },
          ...(containerProductIds ? { 'products.product': { $in: containerProductIds } } : {}),
        },
      },
      { $addFields: { __collectedInRange: collectedInRangeExpr } },
      {
        $addFields: {
          __ratio: {
            $cond: [{ $gt: ['$totalAmount', 0] }, { $divide: ['$__collectedInRange', '$totalAmount'] }, 0],
          },
        },
      },
      { $match: { __collectedInRange: { $gt: 0 } } },
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
      lineRevenue: { $multiply: [{ $ifNull: ['$profitData.productProfits.revenue', 0] }, '$__ratio'] },
      lineProfit: { $multiply: [{ $ifNull: ['$profitData.productProfits.profit', 0] }, '$__ratio'] },
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
      ...lineBase,
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

    // Detail coverage: share of COLLECTED revenue that has line-level snapshot
    // detail (breakdowns are cash-basis, so compare against amount collected).
    const categoryRevenue = profitByCategory.reduce((s, c) => s + (c.totalRevenue || 0), 0);
    generalStats.detailCoverage = realizedTotals.collected > 0
      ? Number(((categoryRevenue / realizedTotals.collected) * 100).toFixed(0))
      : 100;

    res.json({
      success: true,
      data: {
        periodAnalytics: mergedPeriodAnalytics,
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