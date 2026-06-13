const Product = require('../models/productModel');
const Sale = require('../models/saleModel');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

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
    let query = Product.find(tenantFilter(req)).sort({ stock: -1 });

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

    const salesInRange = await Sale.find({ ...tenantFilter(req), ...matchByProduct,
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

    const sales = await Sale.find({ ...tenantFilter(req), 'products.product': product._id })
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
    // ── Plan limit: max products per tenant ──
    if (req.tenantId && req.tenant) {
      const currentCount = await Product.countDocuments({ tenantId: req.tenantId });
      const maxProducts = req.tenant.maxProducts || 500;
      if (currentCount >= maxProducts) {
        return res.status(403).json({
          message: `Limite atteinte : votre plan autorise ${maxProducts} produit(s) maximum. Contactez le support pour augmenter la limite.`,
        });
      }
    }

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

    const product = new Product({ tenantId: req.tenantId,
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
    const products = await Product.find(tenantFilter(req)).lean();
    const sales = await Sale.find({ ...tenantFilter(req), saleDate: { $gte: startDate },
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
    const products = await Product.find(tenantFilter(req)).lean();
    

    const sales = await Sale.find(tenantFilter(req)).select('products').lean();
    

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
// Shared: group products by a field (supplier / container / warehouse) and
// compute rich inventory + sales statistics over a date range.
// ==========================
const rangeStartDate = (range) => {
  const now = new Date();
  const d = new Date(now);
  switch (range) {
    case 'day':   d.setDate(now.getDate() - 1); return d;
    case 'week':  d.setDate(now.getDate() - 7); return d;
    case 'month': d.setMonth(now.getMonth() - 1); return d;
    case 'year':  d.setFullYear(now.getFullYear() - 1); return d;
    default:      return new Date(0);
  }
};

const round2 = (n) => Number((Number(n) || 0).toFixed(2));

/**
 * @param req       request (for tenant scope)
 * @param groupField product field to group on ('supplierName'|'container'|'warehouse')
 * @param range      day|week|month|year|all
 * @param fallback   label used when the field is empty
 */
const buildGroupedInventory = async (req, groupField, range = 'month', fallback = 'Non défini') => {
  const startDate = rangeStartDate(range);

  const [products, sales] = await Promise.all([
    Product.find(tenantFilter(req)).lean(),
    Sale.find({ ...tenantFilter(req), saleDate: { $gte: startDate }, status: { $ne: 'cancelled' } })
      .populate({ path: 'products.product', select: 'name category price costPrice supplierName supplierPhone container warehouse' })
      .lean(),
  ]);

  // Aggregate sales per product id over the range
  const salesByProduct = {};
  for (const sale of sales) {
    for (const item of sale.products || []) {
      const p = item.product;
      if (!p || !p._id) continue;
      const id = p._id.toString();
      const qty = item.quantity || 0;
      const priceAtSale = item.priceAtSale || p.price || 0;
      const cost = p.costPrice || 0;
      const entry = salesByProduct[id] || (salesByProduct[id] = { sold: 0, revenue: 0, profit: 0 });
      entry.sold += qty;
      entry.revenue += priceAtSale * qty;
      entry.profit += (priceAtSale - cost) * qty;
    }
  }

  const groups = {};
  for (const product of products) {
    const rawValue = product[groupField];
    const name = (typeof rawValue === 'string' && rawValue.trim()) || fallback;

    const g = groups[name] || (groups[name] = {
      name,
      supplierPhone: '',
      totalProducts: 0,
      totalStock: 0,
      stockValue: 0,       // selling value (price × stock)
      stockCostValue: 0,   // money tied up (cost × stock)
      potentialProfit: 0,  // unrealised profit if all stock sells
      totalRevenue: 0,
      totalProfit: 0,
      totalUnitsSold: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      deadStockCount: 0,
      averageMargin: 0,
      sellThroughRate: 0,
      topProduct: null,
      _categories: new Set(),
      products: [],
    });

    if (groupField === 'supplierName' && !g.supplierPhone && product.supplierPhone) {
      g.supplierPhone = product.supplierPhone;
    }

    const stock = Number(product.stock) || 0;
    const price = Number(product.price) || 0;
    const cost = Number(product.costPrice) || 0;
    const stockValue = price * stock;
    const stockCostValue = cost * stock;
    const s = salesByProduct[product._id.toString()] || { sold: 0, revenue: 0, profit: 0 };
    const margin = s.revenue > 0 ? round2((s.profit / s.revenue) * 100) : 0;
    const isDead = stock > 0 && s.sold === 0;

    g.totalProducts += 1;
    g.totalStock += stock;
    g.stockValue += stockValue;
    g.stockCostValue += stockCostValue;
    g.potentialProfit += (price - cost) * stock;
    g.totalRevenue += s.revenue;
    g.totalProfit += s.profit;
    g.totalUnitsSold += s.sold;
    if (stock === 0) g.outOfStockCount += 1;
    if (stock > 0 && stock <= 5) g.lowStockCount += 1;
    if (isDead) g.deadStockCount += 1;
    if (product.category) g._categories.add(product.category);

    g.products.push({
      _id: product._id,
      name: product.name,
      category: product.category || 'Non catégorisé',
      sku: product.sku || '',
      stock,
      price,
      costPrice: cost,
      stockValue: round2(stockValue),
      sold: s.sold,
      revenue: round2(s.revenue),
      profit: round2(s.profit),
      margin,
      isDead,
    });
  }

  const list = Object.values(groups).map((g) => {
    const denom = g.totalUnitsSold + g.totalStock;
    g.averageMargin = g.totalRevenue > 0 ? round2((g.totalProfit / g.totalRevenue) * 100) : 0;
    g.sellThroughRate = denom > 0 ? round2((g.totalUnitsSold / denom) * 100) : 0;
    g.categoryCount = g._categories.size;
    g.products.sort((a, b) => b.revenue - a.revenue);
    g.topProduct = g.products[0] ? { name: g.products[0].name, revenue: g.products[0].revenue } : null;
    delete g._categories;
    return {
      ...g,
      stockValue: round2(g.stockValue),
      stockCostValue: round2(g.stockCostValue),
      potentialProfit: round2(g.potentialProfit),
      totalRevenue: round2(g.totalRevenue),
      totalProfit: round2(g.totalProfit),
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totals = list.reduce((acc, g) => {
    acc.stockValue += g.stockValue;
    acc.stockCostValue += g.stockCostValue;
    acc.potentialProfit += g.potentialProfit;
    acc.revenue += g.totalRevenue;
    acc.profit += g.totalProfit;
    acc.unitsSold += g.totalUnitsSold;
    acc.deadStockCount += g.deadStockCount;
    return acc;
  }, { stockValue: 0, stockCostValue: 0, potentialProfit: 0, revenue: 0, profit: 0, unitsSold: 0, deadStockCount: 0 });

  return {
    range,
    generatedAt: new Date().toISOString(),
    groups: list,
    totals: {
      groupCount: list.length,
      productCount: products.length,
      stockValue: round2(totals.stockValue),
      stockCostValue: round2(totals.stockCostValue),
      potentialProfit: round2(totals.potentialProfit),
      revenue: round2(totals.revenue),
      profit: round2(totals.profit),
      unitsSold: totals.unitsSold,
      deadStockCount: totals.deadStockCount,
    },
  };
};

// @desc Products grouped by supplier  @route GET /api/products/by-supplier
const getProductsBySupplier = async (req, res) => {
  try {
    const data = await buildGroupedInventory(req, 'supplierName', req.query.range || 'month', 'Inconnu');
    // Backward-compat: also expose `suppliers` + `supplierName` keys
    const suppliers = data.groups.map((g) => ({ ...g, supplierName: g.name }));
    res.json({ ...data, suppliers, totals: { ...data.totals, supplierCount: data.totals.groupCount } });
  } catch (error) {
    console.error('❌ getProductsBySupplier error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Products grouped by container  @route GET /api/products/by-container
const getProductsByContainer = async (req, res) => {
  try {
    const data = await buildGroupedInventory(req, 'container', req.query.range || 'month', 'Non défini');
    const containers = data.groups.map((g) => ({ ...g, containerName: g.name }));
    res.json({ ...data, containers, totals: { ...data.totals, containerCount: data.totals.groupCount } });
  } catch (error) {
    console.error('❌ getProductsByContainer error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Products grouped by warehouse  @route GET /api/products/by-warehouse
const getProductsByWarehouse = async (req, res) => {
  try {
    const data = await buildGroupedInventory(req, 'warehouse', req.query.range || 'month', 'Non défini');
    const warehouses = data.groups.map((g) => ({ ...g, warehouseName: g.name }));
    res.json({ ...data, warehouses, totals: { ...data.totals, warehouseCount: data.totals.groupCount } });
  } catch (error) {
    console.error('❌ getProductsByWarehouse error:', error);
    res.status(500).json({ message: error.message });
  }
};


// @desc    Bulk import products from JSON array
// @route   POST /api/products/import
// @access  Private/Admin
const importProducts = async (req, res) => {
  try {
    const { products: rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à importer. Envoyez un tableau "products".' });
    }

    const userId = req.user?._id;
    const userName = req.user?.name || 'Admin';
    const results = { created: 0, skipped: 0, errors: [] };

    // ── Plan limit: block imports that would exceed the tenant's product quota ──
    if (req.tenantId && req.tenant) {
      const currentCount = await Product.countDocuments({ tenantId: req.tenantId });
      const maxProducts = req.tenant.maxProducts || 500;
      const remaining = Math.max(maxProducts - currentCount, 0);
      if (rows.length > remaining) {
        return res.status(403).json({
          message: `Import refusé : votre plan autorise ${maxProducts} produit(s). Vous en avez ${currentCount}, il reste ${remaining} place(s) pour ${rows.length} ligne(s). Contactez le support pour augmenter la limite.`,
          code: 'PLAN_LIMIT',
          remaining,
        });
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (1 = header)

      // Validate required fields
      const name = String(row.name || row.Name || row.Nom || row.nom || '').trim();
      if (!name) {
        results.errors.push({ row: rowNum, message: 'Nom du produit manquant' });
        results.skipped++;
        continue;
      }

      const price = parseFloat(row.price || row.Price || row.Prix || row.prix);
      if (isNaN(price) || price < 0) {
        results.errors.push({ row: rowNum, message: `Prix invalide: "${row.price || row.Prix}"` });
        results.skipped++;
        continue;
      }

      const stock = parseInt(row.stock || row.Stock || row.Quantité || row.quantite || row.qty || 0, 10);
      if (isNaN(stock) || stock < 0) {
        results.errors.push({ row: rowNum, message: `Stock invalide: "${row.stock || row.Stock}"` });
        results.skipped++;
        continue;
      }

      const description = String(row.description || row.Description || row.Description || row.desc || '').trim() || `${name} - Importé`;
      const category = String(row.category || row.Category || row.Catégorie || row.categorie || '').trim() || 'Non catégorisé';

      // Optional fields
      const costPrice = parseFloat(row.costPrice || row.costprice || row['Prix de revient'] || row['prix de revient'] || row.cost || 0);
      const supplierName = String(row.supplierName || row.supplier || row.Fournisseur || row.fournisseur || '').trim();
      const supplierPhone = String(row.supplierPhone || row['Téléphone fournisseur'] || row.telephone || '').trim();
      const container = String(row.container || row.Conteneur || row.conteneur || '').trim();
      const warehouse = String(row.warehouse || row.Entrepôt || row.entrepot || '').trim();
      const sku = String(row.sku || row.SKU || row.Référence || row.reference || '').trim().toUpperCase() || undefined;
      const minStockLevel = parseInt(row.minStockLevel || row['Stock minimum'] || row['stock minimum'] || 5, 10);
      const image = String(row.image || row.Image || row.imageUrl || row.photo || '').trim();

      // Check for duplicate SKU
      if (sku) {
        const existing = await Product.findOne({ ...tenantFilter(req), sku });
        if (existing) {
          results.errors.push({ row: rowNum, message: `SKU "${sku}" existe déjà (${existing.name})` });
          results.skipped++;
          continue;
        }
      }

      try {
        await Product.create({
          name,
          description,
          price,
          costPrice: costPrice || undefined,
          stock,
          category,
          supplierName,
          supplierPhone,
          container,
          warehouse,
          sku,
          minStockLevel,
          image: image || undefined,
          createdBy: userId,
          updatedBy: userId,
          activities: [{
            type: 'creation',
            description: `Produit importé par ${userName}`,
            user: userId,
          }],
        });
        results.created++;
      } catch (err) {
        results.errors.push({ row: rowNum, message: err.message });
        results.skipped++;
      }
    }

    res.json({
      success: true,
      message: `${results.created} produit(s) créé(s), ${results.skipped} ignoré(s)`,
      ...results,
    });
  } catch (error) {
    console.error('❌ Erreur import produits:', error);
    res.status(500).json({ message: 'Erreur serveur lors de l\'import' });
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
  getProductSalesHistory,
  importProducts
};
