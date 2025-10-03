const Product = require('../models/productModel');
const Sale = require('../models/saleModel');
// @desc    Get all products
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  try {
    let query = Product.find({}).sort({ stock: -1 });

    if (req.user && req.user.isAdmin) {
      query = query
        .select('+createdBy +updatedBy')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');
    }

    const products = await query.lean();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
const getProductById = async (req, res) => {
  try {
    let query = Product.findById(req.params.id);

    if (req.user && req.user.isAdmin) {
      query = query
        .select('+createdBy +updatedBy')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');
    }

    const product = await query;
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get product statistics
// @route   GET /api/products/:id/stats
// @access  Private
const getProductStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = 'month' } = req.query; // day, week, month, year

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const productId = product._id.toString();

    // Calculate date range
    let startDate;
    const endDate = new Date();

    switch (range) {
      case 'day': {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        break;
      }
      case 'week': {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        break;
      }
      case 'month': {
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      }
      case 'year': {
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      }
      default: {
        startDate = new Date(0); // All time
      }
    }

    const normaliseId = (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value._id) return value._id.toString();
      if (value.toString) return value.toString();
      return null;
    };

    const selectFields = 'saleDate products profitData';
    const matchByProduct = { 'products.product': product._id };

    const salesInRange = await Sale.find({
      ...matchByProduct,
      saleDate: { $gte: startDate, $lte: endDate }
    }).select(selectFields).lean();

    const lifetimeSales = await Sale.find(matchByProduct)
      .select(selectFields)
      .lean();

    const computeMetrics = (sales) => {
      let orders = 0;
      let units = 0;
      let revenue = 0;
      let profit = 0;
      let totalCost = 0;
      let lastSaleDate = null;
      const dailyMap = new Map();

      sales.forEach((sale) => {
        const saleDate = sale.saleDate ? new Date(sale.saleDate) : null;
        const matchingItems = (sale.products || []).filter((item) => {
          const itemProductId = normaliseId(item.product);
          return itemProductId === productId;
        });

        if (!matchingItems.length) {
          return;
        }

        orders += 1;
        if (saleDate && (!lastSaleDate || saleDate > lastSaleDate)) {
          lastSaleDate = saleDate;
        }

        let saleUnits = 0;
        let saleRevenue = 0;
        let saleProfit = 0;
        let saleCost = 0;

        matchingItems.forEach((item) => {
          const quantity = Number(item.quantity) || 0;
          const priceAtSale = Number(
            item.priceAtSale ?? item.unitPrice ?? product.price ?? 0
          );

          const profitEntry = sale.profitData?.productProfits?.find((entry) => {
            const entryId = normaliseId(entry.product);
            return entryId === productId;
          });

          const costPerUnit = Number(
            profitEntry?.costPrice ?? product.costPrice ?? 0
          );
          const computedProfit = Number(
            profitEntry?.profit ?? (priceAtSale - costPerUnit) * quantity
          );

          const itemRevenue = priceAtSale * quantity;

          saleUnits += quantity;
          saleRevenue += itemRevenue;
          saleProfit += computedProfit;
          saleCost += costPerUnit * quantity;
        });

        units += saleUnits;
        revenue += saleRevenue;
        profit += saleProfit;
        totalCost += saleCost;

        if (saleDate) {
          const dayKey = saleDate.toISOString().split('T')[0];
          if (!dailyMap.has(dayKey)) {
            dailyMap.set(dayKey, { date: dayKey, unitsSold: 0, revenue: 0, orders: 0 });
          }
          const dayData = dailyMap.get(dayKey);
          dayData.unitsSold += saleUnits;
          dayData.revenue += saleRevenue;
          dayData.orders += 1;
        }
      });

      const avgSalePrice = units > 0 ? revenue / units : 0;
      const avgProfitPerUnit = units > 0 ? profit / units : 0;
      const avgCostPerUnit = units > 0 ? totalCost / units : 0;

      const dailyTrend = Array.from(dailyMap.values()).map((entry) => ({
        ...entry,
        revenue: Number(entry.revenue.toFixed(2))
      }));

      return {
        orders,
        units,
        revenue,
        profit,
        avgSalePrice,
        avgProfitPerUnit,
        avgCostPerUnit,
        lastSaleDate,
        dailyTrend
      };
    };

    const periodMetrics = computeMetrics(salesInRange);
    const lifetimeMetrics = computeMetrics(lifetimeSales);

    const periodLengthMs = Math.max(endDate.getTime() - startDate.getTime(), 1);
    const periodLengthDays = Math.max(periodLengthMs / (1000 * 60 * 60 * 24), 1);
    const averageDailyUnits = periodMetrics.units > 0 ? periodMetrics.units / periodLengthDays : 0;

    const stockCoverage = averageDailyUnits > 0 && product.stock !== undefined
      ? Number(((product.stock || 0) / averageDailyUnits).toFixed(1))
      : null;

    const sellThroughRate = (periodMetrics.units + (product.stock || 0)) > 0
      ? Number(((periodMetrics.units / (periodMetrics.units + (product.stock || 0))) * 100).toFixed(2))
      : 0;

    const activities = Array.isArray(product.activities)
      ? [...product.activities]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
      : [];

    const conversionRate = product.viewsCount > 0
      ? Number(((lifetimeMetrics.orders / product.viewsCount) * 100).toFixed(2))
      : 0;

    const toFixedNumber = (value, decimals = 2) => Number(value.toFixed(decimals));

    res.json({
      productId,
      range,
      salesThisPeriod: periodMetrics.units,
      ordersThisPeriod: periodMetrics.orders,
      revenueThisPeriod: toFixedNumber(periodMetrics.revenue),
      profitThisPeriod: toFixedNumber(periodMetrics.profit),
      avgSellingPrice: toFixedNumber(periodMetrics.avgSalePrice),
      avgProfitPerUnit: toFixedNumber(periodMetrics.avgProfitPerUnit),
      avgCostPerUnit: toFixedNumber(periodMetrics.avgCostPerUnit),
      totalUnitsSold: lifetimeMetrics.units,
      totalOrders: lifetimeMetrics.orders,
      totalRevenue: toFixedNumber(lifetimeMetrics.revenue),
      totalProfit: toFixedNumber(lifetimeMetrics.profit),
      lifetimeAvgSellingPrice: toFixedNumber(lifetimeMetrics.avgSalePrice),
      lifetimeAvgProfitPerUnit: toFixedNumber(lifetimeMetrics.avgProfitPerUnit),
      lastSaleDate: lifetimeMetrics.lastSaleDate,
      stock: {
        currentStock: product.stock || 0,
        stockValue: toFixedNumber((product.stock || 0) * (product.price || 0)),
        coverageDays: stockCoverage,
        sellThroughRate
      },
      views: product.viewsCount || 0,
      conversionRate,
      returns: product.returnsCount || 0,
      activities,
      trend: periodMetrics.dailyTrend
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching product stats',
      error: error.message
    });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    // Ajout de costPrice dans la création
    const product = new Product({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      costPrice: req.body.costPrice, // Nouveau champ
      stock: req.body.stock,
      category: req.body.category,
      image: req.body.image,
      createdBy: req.user ? req.user._id : undefined,
      updatedBy: req.user ? req.user._id : undefined
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const { name, description, price, costPrice, stock, category, image } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = name || product.name;
      product.description = description || product.description;
      product.price = price || product.price;
      product.costPrice = costPrice || product.costPrice; // Nouveau champ
      product.stock = stock || product.stock;
      product.category = category || product.category;
      product.image = image || product.image;
      product.updatedBy = req.user ? req.user._id : product.updatedBy;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      await product.deleteOne();
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductDashboard = async (req, res) => {
  try {
    const { range } = req.query;

    // Définir les dates de début et de fin
    let startDate;
    const endDate = new Date();

    switch (range) {
      case 'day':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(0); // Toutes les données
    }

    // Vérifier la validité des dates
    if (isNaN(startDate.getTime())) startDate = new Date(0);
    if (isNaN(endDate.getTime())) endDate = new Date();

    // Récupérer tous les produits
    const products = await Product.find({}).lean();

    // Récupérer les IDs des produits qui ont été vendus
    const sales = await Sale.find({}).select('products.product').lean();
    const soldProductIds = new Set();
    
    sales.forEach(sale => {
      sale.products.forEach(item => {
        if (item.product) {
          soldProductIds.add(item.product.toString());
        }
      });
    });

    // Produits jamais vendus
    const neverSoldProducts = products
      .filter(product => !soldProductIds.has(product._id.toString()))
      .sort((a, b) => b.price - a.price) // Trier par prix décroissant
      .slice(0, 10); // Limiter à 10 produits pour l'affichage

    // Calculer les statistiques de base
    const totalProducts = products.length;

    const totalStockValue = products.reduce(
      (sum, product) => sum + (product.price || 0) * (product.stock || 0),
      0
    );

    // Produits à faible stock (moins de 10 unités)
    const lowStockProducts = products
      .filter(p => (p.stock || 0) < 10 && (p.stock || 0) > 0)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 10);

    // Produits en rupture de stock (stock = 0)
    const outOfStockProducts = products
      .filter(p => (p.stock || 0) === 0)
      .sort((a, b) => b.price - a.price) // Trier par prix décroissant
      .slice(0, 10);

    // Produits avec stock à 1 unité
    const criticalStockProducts = products
      .filter(p => (p.stock || 0) === 1)
      .sort((a, b) => b.price - a.price) // Trier par prix décroissant
      .slice(0, 10);

    // Produits les plus chers
    const mostExpensiveProducts = products
      .filter(p => p.price > 0)
      .sort((a, b) => b.price - a.price)
      .slice(0, 5)
      .map(p => ({ 
        _id: p._id, 
        name: p.name, 
        price: p.price,
        sku: p.sku,
        category: p.category,
        stock: p.stock
      }));

    // Statistiques de stock
    const lowStockCount = products.filter(p => (p.stock || 0) < 10 && (p.stock || 0) > 0).length;
    const mediumStockCount = products.filter(p => (p.stock || 0) >= 10 && (p.stock || 0) < 20).length;
    const goodStockCount = products.filter(p => (p.stock || 0) >= 20).length;
    const zeroStockCount = products.filter(p => (p.stock || 0) === 0).length;
    const neverSoldCount = neverSoldProducts.length;

    // Calculer la marge moyenne
    const productsWithMargin = products.filter(p => p.costPrice > 0);
    const averageMargin = productsWithMargin.length > 0
      ? productsWithMargin.reduce(
        (sum, product) => sum + ((product.price - product.costPrice) / product.costPrice * 100),
        0
      ) / productsWithMargin.length
      : 0;

    // Répartition par catégorie
    const categoryDistribution = Object.entries(
      products.reduce((acc, product) => {
        const category = product.category || 'Non catégorisé';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {})
    ).map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Top produits par marge
    const topMarginProducts = products
      .filter(p => p.costPrice > 0)
      .map(p => ({
        _id: p._id,
        name: p.name,
        margin: ((p.price - p.costPrice) / p.costPrice * 100).toFixed(2)
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);

    // Récupérer les données de vente pour la période
    const salesInPeriod = await Sale.find({
      saleDate: { $gte: startDate, $lte: endDate }
    }).populate({
      path: 'products.product',
      model: 'Product',
      select: 'name'
    });

    // Calculer les produits les plus vendus
    const productSales = {};
    salesInPeriod.forEach(sale => {
      sale.products.forEach(item => {
        if (item.product && item.product._id) {
          const productId = item.product._id.toString();
          if (!productSales[productId]) {
            productSales[productId] = {
              name: item.product.name || 'Produit inconnu',
              sold: 0
            };
          }
          productSales[productId].sold += item.quantity || 0;
        }
      });
    });

    const topSellingProducts = Object.values(productSales)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    // Calculer l'évolution des ventes
    let salesTrend = 'stable';
    if (salesInPeriod.length > 0) {
      // Comparer avec la période précédente pour déterminer la tendance
      const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousPeriodEnd = new Date(startDate.getTime() - 1);
      
      const previousPeriodSales = await Sale.countDocuments({
        saleDate: { 
          $gte: previousPeriodStart, 
          $lte: previousPeriodEnd 
        }
      });
      
      if (salesInPeriod.length > previousPeriodSales * 1.2) {
        salesTrend = 'up';
      } else if (salesInPeriod.length < previousPeriodSales * 0.8) {
        salesTrend = 'down';
      }
    }

    // Statistiques supplémentaires
    const totalSalesValue = salesInPeriod.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalProfit = salesInPeriod.reduce((sum, sale) => {
      let saleProfit = 0;
      sale.products.forEach(item => {
        const costPrice = item.product?.costPrice || 0;
        const priceAtSale = item.priceAtSale || 0;
        const quantity = item.quantity || 0;
        saleProfit += (priceAtSale - costPrice) * quantity;
      });
      return sum + saleProfit;
    }, 0);

    res.json({
      // Statistiques de base
      totalProducts,
      totalStockValue,
      totalSalesValue,
      totalProfit,
      
      // Listes de produits
      lowStockProducts,
      outOfStockProducts,
      criticalStockProducts,
      mostExpensiveProducts,
      neverSoldProducts,
      topSellingProducts,
      topMarginProducts,
      
      // Compteurs
      lowStockCount,
      mediumStockCount,
      goodStockCount,
      zeroStockCount,
      neverSoldCount,
      
      // Métriques calculées
      averageMargin: Number(averageMargin.toFixed(2)),
      categoryDistribution,
      
      // Données de performance
      salesTrend,
      salesCount: salesInPeriod.length,
      periodSalesValue: totalSalesValue,
      periodProfit: totalProfit,
      
      // Informations sur la période
      period: {
        start: startDate,
        end: endDate,
        range: range
      }
    });

  } catch (error) {
    console.error('--- PRODUCT DASHBOARD ERROR ---', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductDashboard
};
