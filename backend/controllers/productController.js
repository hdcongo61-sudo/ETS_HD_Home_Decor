const Product = require('../models/productModel');
const Sale = require('../models/saleModel');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');

const normaliseId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return null;
};

const hasUserPermission = (user, permission) =>
  Boolean(user?.isAdmin || (Array.isArray(user?.permissions) && user.permissions.includes(permission)));

const stripSensitiveProductFields = (product, user) => {
  if (!product || user?.isAdmin) return product;
  const plain = product.toObject ? product.toObject() : { ...product };
  if (!hasUserPermission(user, 'view_sensitive_financials')) {
    delete plain.costPrice;
  }
  if (!hasUserPermission(user, 'view_supplier_contacts')) {
    delete plain.supplierPhone;
  }
  return plain;
};

const stripSensitiveProductStats = (stats, user) => {
  if (!stats || hasUserPermission(user, 'view_sensitive_financials')) return stats;
  const plain = { ...stats };
  delete plain.profitThisPeriod;
  delete plain.totalProfit;
  delete plain.avgProfitPerUnit;
  delete plain.avgCostPerUnit;
  delete plain.lifetimeAvgProfitPerUnit;
  return plain;
};
// @desc    Get all products
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  try {
    const summaryMode = String(req.query.summary || '').trim().toLowerCase();
    let query = Product.find({}).sort({ stock: -1 });

    if (summaryMode === 'list') {
      query = query.select(
        'name description price costPrice stock category image supplierName supplierPhone container warehouse slug sku isActive minStockLevel'
      );
    }

    const products = await query.lean();
    res.json(products.map((product) => stripSensitiveProductFields(product, req.user)));
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
      res.json(stripSensitiveProductFields(product, req.user));
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

    const statsPayload = {
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
    };

    res.json(stripSensitiveProductStats(statsPayload, req.user));
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching product stats',
      error: error.message
    });
  }
};

const getProductSalesHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 25) : 5;

    const product = await Product.findById(id).select('_id name price');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const productId = product._id.toString();

    const sales = await Sale.find({ 'products.product': product._id })
      .select('saleDate totalAmount client products status')
      .populate('client', 'name')
      .sort({ saleDate: -1 })
      .limit(limit)
      .lean();

    const history = sales
      .map((sale) => {
        const matchingItem = (sale.products || []).find(
          (item) => normaliseId(item.product) === productId
        );

        if (!matchingItem) {
          return null;
        }

        return {
          saleId: sale._id,
          saleDate: sale.saleDate,
          clientName: sale.client?.name || 'Client inconnu',
          status: sale.status || 'pending',
          quantity: Number(matchingItem.quantity) || 0,
          priceAtSale: Number(
            matchingItem.priceAtSale ?? matchingItem.unitPrice ?? product.price ?? 0
          ),
          totalAmount: Number(sale.totalAmount) || 0
        };
      })
      .filter(Boolean);

    res.json({ productId, sales: history });
  } catch (error) {
    console.error('Error fetching product sales history:', error);
    res.status(500).json({
      message: 'Error fetching product sales history',
      error: error.message
    });
  }
};

const parseNumberField = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const converted = Number(value);
  return Number.isNaN(converted) ? undefined : converted;
};

const stripContainerSuffix = (name, container) => {
  const trimmedName = (name || '').trim();
  const trimmedContainer = (container || '').trim();
  if (!trimmedName || !trimmedContainer) return trimmedName;
  const suffix = ` - ${trimmedContainer}`;
  if (trimmedName.endsWith(suffix)) {
    return trimmedName.slice(0, -suffix.length).trim();
  }
  return trimmedName;
};

const buildProductNameWithContainer = (name, container) => {
  const trimmedName = (name || '').trim();
  const trimmedContainer = (container || '').trim();
  if (!trimmedName) return trimmedName;
  if (!trimmedContainer) return trimmedName;
  const suffix = ` - ${trimmedContainer}`;
  if (trimmedName.endsWith(suffix)) return trimmedName;
  return `${trimmedName}${suffix}`;
};

const uploadImageToCloudinary = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'products',
      resource_type: 'image',
      // auto convert any incoming image to WebP for better performance
      format: 'webp',
      quality: 'auto:best',
    },
    (error, result) => {
      if (error) return reject(error);
      return resolve(result.secure_url);
    }
  );

  streamifier.createReadStream(buffer).pipe(stream);
});

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
      container,
      warehouse,
    } = req.body;
    const numericPrice = parseNumberField(price);
    const numericCost = parseNumberField(costPrice);
    const numericStock = parseNumberField(stock) ?? 0;
    const cleanedContainer = typeof container === 'string' ? container.trim() : '';
    const cleanedWarehouse = typeof warehouse === 'string' ? warehouse.trim() : '';
    const cleanedName = typeof name === 'string' ? name.trim() : '';
    const resolvedName = buildProductNameWithContainer(cleanedName, cleanedContainer);

    let resolvedImageUrl = image;
    if (req.file?.buffer) {
      resolvedImageUrl = await uploadImageToCloudinary(req.file.buffer);
    }

    const userId = req.user ? req.user._id : null;
    const userName = req.user?.name || 'Utilisateur inconnu';

    const product = new Product({
      name: resolvedName,
      description,
      price: numericPrice,
      costPrice: numericCost,
      stock: numericStock,
      category,
      image: resolvedImageUrl,
      supplierName,
      supplierPhone,
      container: cleanedContainer,
      warehouse: cleanedWarehouse,
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
      container,
      warehouse,
    } = req.body;

    let resolvedImageUrl;
    const hasImageField = Object.prototype.hasOwnProperty.call(req.body, 'image');
    if (req.file?.buffer) {
      resolvedImageUrl = await uploadImageToCloudinary(req.file.buffer);
    } else if (hasImageField) {
      resolvedImageUrl = image;
    }


    const userId = req.user ? req.user._id : null;
    const userName = req.user?.name || 'Utilisateur inconnu';
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // 🔍 Détection des changements
    const incomingContainer = typeof container === 'string' ? container.trim() : undefined;
    const incomingWarehouse = typeof warehouse === 'string' ? warehouse.trim() : undefined;
    const incomingNameRaw = typeof name === 'string' ? name.trim() : undefined;
    const incomingName = incomingNameRaw !== undefined && incomingNameRaw !== '' ? incomingNameRaw : undefined;
    const previousContainer = product.container || '';
    const containerForName =
      incomingContainer !== undefined ? incomingContainer : previousContainer;
    const baseName = incomingName !== undefined
      ? incomingName
      : stripContainerSuffix(product.name, previousContainer);
    const resolvedName = buildProductNameWithContainer(baseName, containerForName);

    const changes = [];
    const fieldsToCheck = {
      name: resolvedName,
      description,
      price: parseNumberField(price),
      costPrice: parseNumberField(costPrice),
      stock: parseNumberField(stock),
      category,
      ...(resolvedImageUrl !== undefined ? { image: resolvedImageUrl } : {}),
      supplierName,
      supplierPhone,
      container: incomingContainer,
      warehouse: incomingWarehouse,
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
        select: 'name category price costPrice supplierName supplierPhone',
      })
      .lean();

    // 3️⃣ Analyse des ventes
    const productSalesMap = {};
    const productMetaMap = products.reduce((acc, prod) => {
      if (prod && prod._id) {
        acc[prod._id.toString()] = {
          supplierName: prod.supplierName || 'Inconnu',
          supplierPhone: prod.supplierPhone || '',
          price: prod.price || 0,
          costPrice: prod.costPrice || 0,
        };
      }
      return acc;
    }, {});
    const salesTrendMap = {};
    const allProductSalesMap = {};

    for (const sale of sales) {
      const dateKey = new Date(sale.saleDate).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      });
      if (!salesTrendMap[dateKey]) salesTrendMap[dateKey] = 0;

      if (!sale.products) continue;
      for (const item of sale.products) {
        const productRef = item.product;
        const id =
          productRef?._id?.toString?.() ||
          productRef?.toString?.() ||
          productRef;
        if (!id) continue;

        const productMeta = productMetaMap[id] || {};
        const quantity = Number(item.quantity || 0) || 0;
        const priceAtSale =
          Number(item.priceAtSale ?? productRef?.price ?? productMeta.price ?? 0) ||
          0;
        const costPrice =
          Number(productRef?.costPrice ?? productMeta.costPrice ?? 0) || 0;

        salesTrendMap[dateKey] += priceAtSale * quantity;

        if (!productSalesMap[id]) {
          productSalesMap[id] = {
            _id: id,
            name: productRef?.name || 'Produit inconnu',
            category: productRef?.category || 'Non catégorisé',
            price: priceAtSale,
            sold: 0,
            revenue: 0,
            profit: 0,
            supplierName: productMeta.supplierName || 'Inconnu',
            supplierPhone: productMeta.supplierPhone || ''
          };
        }

        productSalesMap[id].sold += quantity;
        productSalesMap[id].revenue += priceAtSale * quantity;
        productSalesMap[id].profit += (priceAtSale - costPrice) * quantity;

        if (!allProductSalesMap[id]) {
          allProductSalesMap[id] = {
            sold: 0,
            revenue: 0,
            profit: 0,
            lastSaleDate: null,
          };
        }

        allProductSalesMap[id].sold += quantity;
        allProductSalesMap[id].revenue += priceAtSale * quantity;
        allProductSalesMap[id].profit += (priceAtSale - costPrice) * quantity;
        if (
          sale.saleDate &&
          (!allProductSalesMap[id].lastSaleDate ||
            new Date(sale.saleDate) > new Date(allProductSalesMap[id].lastSaleDate))
        ) {
          allProductSalesMap[id].lastSaleDate = sale.saleDate;
        }
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
      const supplierName =
        (p.supplierName && p.supplierName.trim()) || 'Inconnu';
      const supplierPhone = p.supplierPhone || '';
      if (!supplierStatsMap[supplierName]) {
        supplierStatsMap[supplierName] = {
          supplierName,
          supplierPhone,
          totalProducts: 0,
          totalStockValue: 0,
          totalRevenue: 0,
          totalProfit: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };
      } else if (!supplierStatsMap[supplierName].supplierPhone && supplierPhone) {
        supplierStatsMap[supplierName].supplierPhone = supplierPhone;
      }

      const productId = p._id?.toString?.() || p._id;
      const salesData = productSalesMap[productId] || {
        sold: 0,
        revenue: 0,
        profit: 0,
      };

      supplierStatsMap[supplierName].totalProducts += 1;
      supplierStatsMap[supplierName].totalStockValue +=
        (p.price || 0) * (p.stock || 0);
      supplierStatsMap[supplierName].totalRevenue += salesData.revenue;
      supplierStatsMap[supplierName].totalProfit += salesData.profit;

      if (p.stock === 0) supplierStatsMap[supplierName].outOfStockCount += 1;
      if (p.stock > 0 && p.stock <= 5)
        supplierStatsMap[supplierName].lowStockCount += 1;
    }

const supplierStats = Object.values(supplierStatsMap).sort(
  (a, b) => b.totalRevenue - a.totalRevenue
);

    // 9️⃣ Statistiques par conteneur
    const containerStatsMap = {};

    for (const p of products) {
      const containerName = (p.container && p.container.trim()) || 'Non defini';
      if (!containerStatsMap[containerName]) {
        containerStatsMap[containerName] = {
          containerName,
          totalProducts: 0,
          totalStockValue: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalUnitsSold: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };
      }

      const productId = p._id?.toString?.() || p._id;
      const salesData = productSalesMap[productId] || {
        sold: 0,
        revenue: 0,
        profit: 0,
      };

      containerStatsMap[containerName].totalProducts += 1;
      containerStatsMap[containerName].totalStockValue +=
        (p.price || 0) * (p.stock || 0);
      containerStatsMap[containerName].totalRevenue += salesData.revenue;
      containerStatsMap[containerName].totalProfit += salesData.profit;
      containerStatsMap[containerName].totalUnitsSold += salesData.sold;

      if (p.stock === 0) containerStatsMap[containerName].outOfStockCount += 1;
      if (p.stock > 0 && p.stock <= 5)
        containerStatsMap[containerName].lowStockCount += 1;
    }

    const containerStats = Object.values(containerStatsMap).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    // 10️⃣ Statistiques par entrepot
    const warehouseStatsMap = {};

    for (const p of products) {
      const warehouseName = (p.warehouse && p.warehouse.trim()) || 'Non defini';
      if (!warehouseStatsMap[warehouseName]) {
        warehouseStatsMap[warehouseName] = {
          warehouseName,
          totalProducts: 0,
          totalStockValue: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalUnitsSold: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };
      }

      const productId = p._id?.toString?.() || p._id;
      const salesData = productSalesMap[productId] || {
        sold: 0,
        revenue: 0,
        profit: 0,
      };

      warehouseStatsMap[warehouseName].totalProducts += 1;
      warehouseStatsMap[warehouseName].totalStockValue +=
        (p.price || 0) * (p.stock || 0);
      warehouseStatsMap[warehouseName].totalRevenue += salesData.revenue;
      warehouseStatsMap[warehouseName].totalProfit += salesData.profit;
      warehouseStatsMap[warehouseName].totalUnitsSold += salesData.sold;

      if (p.stock === 0) warehouseStatsMap[warehouseName].outOfStockCount += 1;
      if (p.stock > 0 && p.stock <= 5)
        warehouseStatsMap[warehouseName].lowStockCount += 1;
    }

    const warehouseStats = Object.values(warehouseStatsMap).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    const daysInRange = Math.max(
      1,
      Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const buildProductActionSuggestions = () => {
      const suggestions = [];

      for (const product of products) {
        const productId = product._id?.toString?.() || product._id;
        const currentSales = allProductSalesMap[productId] || {
          sold: 0,
          revenue: 0,
          profit: 0,
          lastSaleDate: null,
        };
        const stock = Number(product.stock || 0);
        const price = Number(product.price || 0);
        const costPrice = Number(product.costPrice || 0);
        const stockValue = stock * price;
        const marginRate =
          costPrice > 0 && price > 0 ? ((price - costPrice) / price) * 100 : null;
        const sellThroughRate =
          currentSales.sold + stock > 0
            ? (currentSales.sold / (currentSales.sold + stock)) * 100
            : 0;
        const dailyVelocity = currentSales.sold / daysInRange;
        const daysSinceLastSale = currentSales.lastSaleDate
          ? Math.floor(
              (now.getTime() - new Date(currentSales.lastSaleDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;
        const actions = [];
        let score = 0;

        if (stock <= 0 || product.isActive === false) {
          continue;
        }

        if (currentSales.sold === 0) {
          score += 45;
          actions.push('Mettre ce produit en avant sur la page d’accueil ou en boutique.');
          actions.push('Tester une remise courte de 10 % à 15 % pendant 7 jours.');
          actions.push('Vérifier la photo, le nom et la description du produit.');
        } else if (sellThroughRate < 12 && stock >= 5) {
          score += 30;
          actions.push('Créer une promotion ciblée pour accélérer l’écoulement du stock.');
          actions.push('Placer le produit près des articles les plus vendus.');
        }

        if (stock >= 10) {
          score += 12;
          actions.push('Faire une offre groupée avec un produit complémentaire.');
        }

        if (stockValue >= 100000) {
          score += 10;
          actions.push('Limiter les nouveaux achats de ce produit avant amélioration des ventes.');
        }

        if (marginRate !== null && marginRate >= 18 && price > 0) {
          const discountRate = currentSales.sold === 0 ? 12 : 8;
          const suggestedPrice = Math.max(
            costPrice,
            Math.round((price * (1 - discountRate / 100)) / 100) * 100
          );

          if (suggestedPrice < price) {
            score += 18;
            actions.unshift(
              `Essayer un prix autour de ${suggestedPrice.toLocaleString('fr-FR')} CFA au lieu de ${price.toLocaleString('fr-FR')} CFA.`
            );
          }
        } else if (price > 0) {
          score += 8;
          actions.push('Comparer le prix avec les produits similaires avant de baisser fortement.');
        }

        if (Number(product.viewsCount || 0) > 20 && Number(product.conversionRate || 0) < 2) {
          score += 15;
          actions.push('Beaucoup de vues mais peu d’achats : revoir le prix, les photos ou la mise en rayon.');
        }

        if (Number(product.returnsCount || 0) > 0) {
          score += 8;
          actions.push('Contrôler la qualité et les motifs de retour avant promotion.');
        }

        if (actions.length === 0) continue;

        suggestions.push({
          _id: productId,
          name: product.name,
          category: product.category || 'Non catégorisé',
          supplierName: product.supplierName || 'Inconnu',
          price,
          costPrice,
          stock,
          stockValue: Number(stockValue.toFixed(2)),
          sold: currentSales.sold,
          revenue: Number(currentSales.revenue.toFixed(2)),
          profit: Number(currentSales.profit.toFixed(2)),
          marginRate: marginRate !== null ? Number(marginRate.toFixed(1)) : null,
          sellThroughRate: Number(sellThroughRate.toFixed(1)),
          dailyVelocity: Number(dailyVelocity.toFixed(2)),
          daysSinceLastSale,
          priority:
            score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
          score,
          highlight:
            currentSales.sold === 0
              ? 'Aucune vente sur la période'
              : `Seulement ${currentSales.sold} unité(s) vendue(s)`,
          actions: Array.from(new Set(actions)).slice(0, 4),
        });
      }

      return suggestions
        .sort((a, b) => b.score - a.score || b.stockValue - a.stockValue)
        .slice(0, 12);
    };

    const productActionSuggestions = buildProductActionSuggestions();

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
  productActionSuggestions,
  supplierStats, 
  containerStats,
  warehouseStats,
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

// ==========================
// @desc    Get products grouped by container with stats
// @route   GET /api/products/by-container
// @access  Private/Admin
// ==========================
const getProductsByContainer = async (req, res) => {
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
          select: 'name category price costPrice container',
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

    const containersMap = {};

    for (const product of products) {
      const containerName = (product.container && product.container.trim()) || 'Non defini';

      if (!containersMap[containerName]) {
        containersMap[containerName] = {
          containerName,
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

      const container = containersMap[containerName];
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

      container.totalProducts += 1;
      container.totalStockValue += stockValue;
      container.totalRevenue += salesData.revenue;
      container.totalProfit += salesData.profit;
      container.totalUnitsSold += salesData.sold;

      if (product.stock === 0) container.outOfStockCount += 1;
      if (product.stock > 0 && product.stock <= 5) container.lowStockCount += 1;

      container.products.push({
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

    const containers = Object.values(containersMap)
      .map((container) => {
        const revenue = container.totalRevenue;
        container.averageMargin =
          revenue > 0
            ? Number(((container.totalProfit / revenue) * 100).toFixed(2))
            : 0;

        container.products.sort((a, b) => b.revenue - a.revenue);

        return {
          ...container,
          totalStockValue: Number(container.totalStockValue.toFixed(2)),
          totalRevenue: Number(container.totalRevenue.toFixed(2)),
          totalProfit: Number(container.totalProfit.toFixed(2)),
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const aggregateTotals = containers.reduce(
      (acc, container) => {
        acc.stockValue += container.totalStockValue;
        acc.revenue += container.totalRevenue;
        acc.profit += container.totalProfit;
        acc.unitsSold += container.totalUnitsSold;
        return acc;
      },
      { stockValue: 0, revenue: 0, profit: 0, unitsSold: 0 }
    );

    res.json({
      range,
      generatedAt: new Date().toISOString(),
      containers,
      totals: {
        containerCount: containers.length,
        productCount: products.length,
        stockValue: Number(aggregateTotals.stockValue.toFixed(2)),
        revenue: Number(aggregateTotals.revenue.toFixed(2)),
        profit: Number(aggregateTotals.profit.toFixed(2)),
        unitsSold: aggregateTotals.unitsSold,
      },
    });
  } catch (error) {
    console.error('❌ getProductsByContainer error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==========================
// @desc    Get products grouped by warehouse with stats
// @route   GET /api/products/by-warehouse
// @access  Private/Admin
// ==========================
const getProductsByWarehouse = async (req, res) => {
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
          select: 'name category price costPrice warehouse',
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

    const warehousesMap = {};

    for (const product of products) {
      const warehouseName = (product.warehouse && product.warehouse.trim()) || 'Non defini';

      if (!warehousesMap[warehouseName]) {
        warehousesMap[warehouseName] = {
          warehouseName,
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

      const warehouse = warehousesMap[warehouseName];
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

      warehouse.totalProducts += 1;
      warehouse.totalStockValue += stockValue;
      warehouse.totalRevenue += salesData.revenue;
      warehouse.totalProfit += salesData.profit;
      warehouse.totalUnitsSold += salesData.sold;

      if (product.stock === 0) warehouse.outOfStockCount += 1;
      if (product.stock > 0 && product.stock <= 5) warehouse.lowStockCount += 1;

      warehouse.products.push({
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

    const warehouses = Object.values(warehousesMap)
      .map((warehouse) => {
        const revenue = warehouse.totalRevenue;
        warehouse.averageMargin =
          revenue > 0
            ? Number(((warehouse.totalProfit / revenue) * 100).toFixed(2))
            : 0;

        warehouse.products.sort((a, b) => b.revenue - a.revenue);

        return {
          ...warehouse,
          totalStockValue: Number(warehouse.totalStockValue.toFixed(2)),
          totalRevenue: Number(warehouse.totalRevenue.toFixed(2)),
          totalProfit: Number(warehouse.totalProfit.toFixed(2)),
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const aggregateTotals = warehouses.reduce(
      (acc, warehouse) => {
        acc.stockValue += warehouse.totalStockValue;
        acc.revenue += warehouse.totalRevenue;
        acc.profit += warehouse.totalProfit;
        acc.unitsSold += warehouse.totalUnitsSold;
        return acc;
      },
      { stockValue: 0, revenue: 0, profit: 0, unitsSold: 0 }
    );

    res.json({
      range,
      generatedAt: new Date().toISOString(),
      warehouses,
      totals: {
        warehouseCount: warehouses.length,
        productCount: products.length,
        stockValue: Number(aggregateTotals.stockValue.toFixed(2)),
        revenue: Number(aggregateTotals.revenue.toFixed(2)),
        profit: Number(aggregateTotals.profit.toFixed(2)),
        unitsSold: aggregateTotals.unitsSold,
      },
    });
  } catch (error) {
    console.error('❌ getProductsByWarehouse error:', error);
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
  getProductsBySupplier,
  getProductsByContainer,
  getProductsByWarehouse,
  getProductSalesHistory
};
