// controllers/profitController.js
const Sale = require('../models/saleModel');

// @desc    Obtenir les analyses de bénéfices
// @route   GET /api/sales/profit-analytics
// @access  Private/Admin
const getProfitAnalytics = async (req, res) => {
  try {
    const { 
      period = 'month', 
      startDate, 
      endDate,
      category,
      minProfit,
      maxProfit
    } = req.query;

    // console.log('Profit analytics request:', { period, startDate, endDate, category });

    // Construction des filtres
    const filters = { 
      period, 
      startDate, 
      endDate, 
      category,
      minProfit: minProfit ? parseFloat(minProfit) : undefined,
      maxProfit: maxProfit ? parseFloat(maxProfit) : undefined
    };

    // Analyse des bénéfices par période
    const periodAnalytics = await Sale.aggregate([
      { 
        $match: { 
          status: { $ne: 'cancelled' },
          ...(startDate || endDate ? {
            saleDate: {
              ...(startDate ? { $gte: new Date(startDate) } : {}),
              ...(endDate ? { $lte: new Date(endDate) } : {})
            }
          } : {}),
          ...(category ? { profitCategory: category } : {})
        } 
      },
      {
        $group: {
          _id: `$periodData.${period}`,
          totalSales: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profitData.totalProfit' },
          totalCost: { $sum: '$profitData.totalCost' },
          saleCount: { $sum: 1 },
          averageProfit: { $avg: '$profitData.totalProfit' },
          averageMargin: { $avg: '$profitData.profitMargin' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Produits les plus rentables (simplifié)
    const topProducts = await Sale.aggregate([
      { 
        $match: { 
          status: { $ne: 'cancelled' },
          ...(startDate || endDate ? {
            saleDate: {
              ...(startDate ? { $gte: new Date(startDate) } : {}),
              ...(endDate ? { $lte: new Date(endDate) } : {})
            }
          } : {})
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
          totalQuantity: { $sum: '$products.quantity' },
          totalRevenue: { $sum: { $multiply: ['$products.quantity', '$products.priceAtSale'] } },
          totalCost: { 
            $sum: { 
              $multiply: ['$products.quantity', { $ifNull: ['$productInfo.costPrice', 0] }]
            } 
          }
        }
      },
      {
        $project: {
          productName: 1,
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
      { $sort: { totalProfit: -1 } },
      { $limit: 10 }
    ]);

    // Statistiques générales
    const generalStats = await Sale.aggregate([
      { 
        $match: { 
          status: { $ne: 'cancelled' },
          ...(startDate || endDate ? {
            saleDate: {
              ...(startDate ? { $gte: new Date(startDate) } : {}),
              ...(endDate ? { $lte: new Date(endDate) } : {})
            }
          } : {})
        } 
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: '$profitData.totalProfit' },
          totalRevenue: { $sum: '$totalAmount' },
          saleCount: { $sum: 1 },
          averageProfit: { $avg: '$profitData.totalProfit' },
          averageMargin: { $avg: '$profitData.profitMargin' },
          profitableSales: {
            $sum: { $cond: [{ $gt: ['$profitData.totalProfit', 0] }, 1, 0] }
          }
        }
      }
    ]);

    // Analyse par catégorie de produit
    const profitByCategory = await Sale.aggregate([
      { 
        $match: { 
          status: { $ne: 'cancelled' },
          ...(startDate || endDate ? {
            saleDate: {
              ...(startDate ? { $gte: new Date(startDate) } : {}),
              ...(endDate ? { $lte: new Date(endDate) } : {})
            }
          } : {})
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
          _id: '$productInfo.category',
          totalProfit: { $sum: { $subtract: [
            { $multiply: ['$products.quantity', '$products.priceAtSale'] },
            { $multiply: ['$products.quantity', { $ifNull: ['$productInfo.costPrice', 0] }] }
          ] } },
          saleCount: { $sum: 1 }
        }
      },
      { $sort: { totalProfit: -1 } }
    ]);

    const stats = generalStats[0] || {
      totalProfit: 0,
      totalRevenue: 0,
      saleCount: 0,
      averageProfit: 0,
      averageMargin: 0,
      profitableSales: 0
    };

    res.json({
      success: true,
      data: {
        periodAnalytics,
        topProducts,
        generalStats: stats,
        profitByCategory,
        filters: {
          period,
          startDate,
          endDate,
          category
        }
      }
    });

  } catch (error) {
    console.error('Erreur analyse bénéfices:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse des bénéfices',
      error: error.message
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