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

const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      costPrice,
      stock,
      category,
      image,
      supplierName,
      supplierPhone,
    } = req.body;

    const userId = req.user ? req.user._id : null;
    const userName = req.user?.name || 'Utilisateur inconnu';

    const product = new Product({
      name,
      description,
      price,
      costPrice,
      stock,
      category,
      image,
      supplierName,
      supplierPhone,
      createdBy: userId,
      updatedBy: userId,
      activities: [
        {
          type: 'creation',
          description: `Produit créé par ${userName}`,
          user: userId,
        },
      ],
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('❌ Erreur création produit :', error);
    res.status(400).json({ message: error.message });
  }
};

// 🟡 METTRE À JOUR UN PRODUIT AVEC LOG DES ACTIVITÉS
const updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      costPrice,
      stock,
      category,
      image,
      supplierName,
      supplierPhone,
    } = req.body;

    const userId = req.user ? req.user._id : null;
    const userName = req.user?.name || 'Utilisateur inconnu';
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // 🔍 Détection des changements
    const changes = [];
    const fieldsToCheck = {
      name,
      description,
      price,
      costPrice,
      stock,
      category,
      image,
      supplierName,
      supplierPhone,
    };

    for (const [key, newValue] of Object.entries(fieldsToCheck)) {
      if (newValue !== undefined && newValue !== product[key]) {
        changes.push({
          field: key,
          oldValue: product[key],
          newValue,
        });
        product[key] = newValue;
      }
    }

    product.updatedBy = userId;

    // 🧾 Ajouter l’activité correspondante
    if (changes.length > 0) {
      changes.forEach((change) => {
        product.activities.push({
          type: 'adjustment',
          description: `Changement de "${change.field}" par ${userName}`,
          oldValue: change.oldValue,
          newValue: change.newValue,
          user: userId,
        });
      });
    } else {
      product.activities.push({
        type: 'adjustment',
        description: `Produit mis à jour par ${userName} sans changement de données`,
        user: userId,
      });
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    console.error('❌ Erreur update produit :', error);
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

// ==========================
// @desc    Get full product dashboard data
// @route   GET /api/products/dashboard
// @access  Private (Admin / Manager)
// ==========================
const getProductDashboard = async (req, res) => {
  try {
    const { range = 'month' } = req.query;

    // 1️⃣ Déterminer la période
    const now = new Date();
    let startDate = new Date();
    switch (range) {
      case 'day': startDate.setDate(now.getDate() - 1); break;
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'month': startDate.setMonth(now.getMonth() - 1); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
      default: startDate = new Date(0);
    }

    // 2️⃣ Récupération des produits et ventes
    const products = await Product.find({}).lean();
    const sales = await Sale.find({
      saleDate: { $gte: startDate },
      status: { $ne: 'cancelled' },
    })
      .populate({
        path: 'products.product',
        select: 'name category price costPrice',
      })
      .lean();

    // 3️⃣ Analyse des ventes
    const productSalesMap = {};
    const productMetaMap = products.reduce((acc, prod) => {
      if (prod && prod._id) {
        acc[prod._id.toString()] = {
          supplierName: prod.supplierName || 'Inconnu',
          supplierPhone: prod.supplierPhone || ''
        };
      }
      return acc;
    }, {});
    const salesTrendMap = {};

    for (const sale of sales) {
      const dateKey = new Date(sale.saleDate).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      });
      if (!salesTrendMap[dateKey]) salesTrendMap[dateKey] = 0;

      if (!sale.products) continue;
      for (const item of sale.products) {
        const p = item.product;
        if (!p || !p._id) continue;

        const id = p._id.toString();
        const quantity = item.quantity || 0;
        const priceAtSale = item.priceAtSale || p.price || 0;
        const costPrice = p.costPrice || 0;

        salesTrendMap[dateKey] += priceAtSale * quantity;

        if (!productSalesMap[id]) {
          productSalesMap[id] = {
            _id: id,
            name: p.name || 'Produit inconnu',
            category: p.category || 'Non catégorisé',
            price: priceAtSale,
            sold: 0,
            revenue: 0,
            profit: 0,
            supplierName: productMetaMap[id]?.supplierName || 'Inconnu',
            supplierPhone: productMetaMap[id]?.supplierPhone || ''
          };
        }

        productSalesMap[id].sold += quantity;
        productSalesMap[id].revenue += priceAtSale * quantity;
        productSalesMap[id].profit += (priceAtSale - costPrice) * quantity;
      }
    }

    // 4️⃣ Top ventes
    const topSellingProducts = Object.values(productSalesMap)
      .map((p) => ({
        ...p,
        margin:
          p.revenue > 0 ? Number(((p.profit / p.revenue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 15);

    // 5️⃣ Stocks critiques et ruptures
    const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= 5);
    const outOfStockProducts = products.filter((p) => p.stock <= 0);

    // 6️⃣ Statistiques globales
    const totalProducts = products.length;
    const soldProducts = Object.keys(productSalesMap).length;
    const totalStockValue = products.reduce(
      (sum, p) => sum + (p.price || 0) * (p.stock || 0),
      0
    );
    const neverSoldProducts = products.filter((p) => !productSalesMap[p._id]);
    const neverSoldStockValue = neverSoldProducts.reduce(
      (sum, p) => sum + (p.price || 0) * (p.stock || 0),
      0
    );

    // 7️⃣ Graphique tendance ventes
    const salesTrend = Object.entries(salesTrendMap).map(([name, value]) => ({
      name,
      value,
    }));
    
// 8️⃣ Statistiques par fournisseur
const supplierStatsMap = {};

for (const p of products) {
  const supplier = p.supplierName || 'Inconnu';
  if (!supplierStatsMap[supplier]) {
    supplierStatsMap[supplier] = {
      supplierName: supplier,
      supplierPhone: p.supplierPhone || '',
      totalProducts: 0,
      totalStockValue: 0,
      totalRevenue: 0,
      totalProfit: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    };
  }

  supplierStatsMap[supplier].totalProducts += 1;
  supplierStatsMap[supplier].totalStockValue += (p.price || 0) * (p.stock || 0);
  if (p.stock === 0) supplierStatsMap[supplier].outOfStockCount += 1;
  if (p.stock > 0 && p.stock <= 5) supplierStatsMap[supplier].lowStockCount += 1;
}

for (const sale of sales) {
  if (!sale.products) continue;
  for (const item of sale.products) {
    const pr = item.product;
    if (!pr) continue;
    const supplier = pr.supplierName || 'Inconnu';
    if (!supplierStatsMap[supplier]) continue;

    const priceAtSale = item.priceAtSale || pr.price || 0;
    const costPrice = pr.costPrice || 0;
    const qty = item.quantity || 0;

    supplierStatsMap[supplier].totalRevenue += priceAtSale * qty;
    supplierStatsMap[supplier].totalProfit += (priceAtSale - costPrice) * qty;
  }
}

const supplierStats = Object.values(supplierStatsMap).sort(
  (a, b) => b.totalRevenue - a.totalRevenue
);

// ✅ Ajout au JSON final
res.json({
  totalProducts,
  soldProducts,
  totalStockValue,
  neverSoldStockValue,
  neverSoldProducts,
  lowStockProducts,
  outOfStockProducts,
  topSellingProducts,
  salesTrend,
  supplierStats, 
});

  } catch (error) {
    console.error('❌ getProductDashboard error:', error);
    res.status(500).json({ message: error.message });
  }
};



// @desc Get never sold products
// @route GET /api/products/never-sold
// @access Private/Admin
const getNeverSoldProducts = async (req, res) => {
  
  try {
    const products = await Product.find({}).lean();
    

    const sales = await Sale.find({}).select('products').lean();
    

    const soldIds = new Set();

    for (const sale of sales) {
      try {
        if (!sale.products || !Array.isArray(sale.products)) {
          
          continue;
        }

        for (const item of sale.products) {
          if (!item) continue;
          let productId = null;

          if (typeof item.product === 'string') {
            productId = item.product;
          } else if (item.product && item.product._id) {
            productId = item.product._id.toString();
          } else if (item.product?._id) {
            productId = item.product._id.toString();
          }

          if (productId) soldIds.add(productId);
        }
      } catch (innerErr) {
        console.error('❌ Erreur interne sur une vente:', innerErr.message);
      }
    }

    

    const neverSold = products.filter(p => !soldIds.has(p._id.toString()));
    

    // Répartition par catégorie
    const categoryDistribution = {};
    for (const p of neverSold) {
      const cat = p.category || 'Non catégorisé';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    }

    const categoryDistributionArray = Object.entries(categoryDistribution).map(
      ([category, count]) => ({ category, count })
    );

    // Calcul des valeurs totales
    const totalStockValue = products.reduce(
      (sum, p) => sum + ((p.price || 0) * (p.stock || 0)),
      0
    );
    const neverSoldStockValue = neverSold.reduce(
      (sum, p) => sum + ((p.price || 0) * (p.stock || 0)),
      0
    );

    

    res.json({
      count: neverSold.length,
      products: neverSold,
      categoryDistribution: categoryDistributionArray,
      totalProducts: products.length,
      totalStockValue,
      stockValue: neverSoldStockValue,
    });
  } catch (error) {
    console.error('❌ [ERROR getNeverSoldProducts]:', error.message);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};







// ==========================
// @desc    Get products grouped by supplier with stats
// @route   GET /api/products/by-supplier
// @access  Private/Admin
// ==========================
const getProductsBySupplier = async (req, res) => {
  try {
    const { range = 'month' } = req.query;

    const now = new Date();
    let startDate = new Date(0);

    switch (range) {
      case 'day':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(0);
    }

    const [products, sales] = await Promise.all([
      Product.find({}).lean(),
      Sale.find({
        saleDate: { $gte: startDate },
        status: { $ne: 'cancelled' },
      })
        .populate({
          path: 'products.product',
          select: 'name category price costPrice supplierName supplierPhone',
        })
        .lean(),
    ]);

    const productSalesMap = {};

    for (const sale of sales) {
      if (!sale.products) continue;

      for (const item of sale.products) {
        const populatedProduct = item.product;
        if (!populatedProduct || !populatedProduct._id) continue;

        const id = populatedProduct._id.toString();
        const quantity = item.quantity || 0;
        const priceAtSale = item.priceAtSale || populatedProduct.price || 0;
        const costPrice = populatedProduct.costPrice || 0;

        if (!productSalesMap[id]) {
          productSalesMap[id] = {
            sold: 0,
            revenue: 0,
            profit: 0,
          };
        }

        productSalesMap[id].sold += quantity;
        productSalesMap[id].revenue += priceAtSale * quantity;
        productSalesMap[id].profit += (priceAtSale - costPrice) * quantity;
      }
    }

    const suppliersMap = {};

    for (const product of products) {
      const supplierName = (product.supplierName && product.supplierName.trim()) || 'Inconnu';
      const supplierPhone = product.supplierPhone || '';

      if (!suppliersMap[supplierName]) {
        suppliersMap[supplierName] = {
          supplierName,
          supplierPhone,
          totalProducts: 0,
          totalStockValue: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalUnitsSold: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          averageMargin: 0,
          products: [],
        };
      }

      const supplier = suppliersMap[supplierName];
      if (!supplier.supplierPhone && supplierPhone) {
        supplier.supplierPhone = supplierPhone;
      }

      const productId = product._id.toString();
      const salesData = productSalesMap[productId] || {
        sold: 0,
        revenue: 0,
        profit: 0,
      };

      const stockValue = (product.price || 0) * (product.stock || 0);
      const margin =
        salesData.revenue > 0
          ? Number(((salesData.profit / salesData.revenue) * 100).toFixed(2))
          : 0;

      supplier.totalProducts += 1;
      supplier.totalStockValue += stockValue;
      supplier.totalRevenue += salesData.revenue;
      supplier.totalProfit += salesData.profit;
      supplier.totalUnitsSold += salesData.sold;

      if (product.stock === 0) supplier.outOfStockCount += 1;
      if (product.stock > 0 && product.stock <= 5) supplier.lowStockCount += 1;

      supplier.products.push({
        _id: product._id,
        name: product.name,
        category: product.category,
        sku: product.sku || '',
        stock: product.stock,
        price: product.price,
        costPrice: product.costPrice || 0,
        stockValue: Number(stockValue.toFixed(2)),
        sold: salesData.sold,
        revenue: Number(salesData.revenue.toFixed(2)),
        profit: Number(salesData.profit.toFixed(2)),
        margin,
      });
    }

    const suppliers = Object.values(suppliersMap)
      .map((supplier) => {
        const revenue = supplier.totalRevenue;
        supplier.averageMargin =
          revenue > 0
            ? Number(((supplier.totalProfit / revenue) * 100).toFixed(2))
            : 0;

        supplier.products.sort((a, b) => b.revenue - a.revenue);

        return {
          ...supplier,
          totalStockValue: Number(supplier.totalStockValue.toFixed(2)),
          totalRevenue: Number(supplier.totalRevenue.toFixed(2)),
          totalProfit: Number(supplier.totalProfit.toFixed(2)),
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const aggregateTotals = suppliers.reduce(
      (acc, supplier) => {
        acc.stockValue += supplier.totalStockValue;
        acc.revenue += supplier.totalRevenue;
        acc.profit += supplier.totalProfit;
        acc.unitsSold += supplier.totalUnitsSold;
        return acc;
      },
      { stockValue: 0, revenue: 0, profit: 0, unitsSold: 0 }
    );

    res.json({
      range,
      generatedAt: new Date().toISOString(),
      suppliers,
      totals: {
        supplierCount: suppliers.length,
        productCount: products.length,
        stockValue: Number(aggregateTotals.stockValue.toFixed(2)),
        revenue: Number(aggregateTotals.revenue.toFixed(2)),
        profit: Number(aggregateTotals.profit.toFixed(2)),
        unitsSold: aggregateTotals.unitsSold,
      },
    });
  } catch (error) {
    console.error('❌ getProductsBySupplier error:', error);
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductDashboard,
  getNeverSoldProducts,
  getProductsBySupplier
};
