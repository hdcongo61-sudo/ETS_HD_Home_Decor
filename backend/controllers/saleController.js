const asyncHandler = require('express-async-handler');
const Sale = require('../models/saleModel');
const Product = require('../models/productModel');
const Client = require('../models/clientModel');
const User = require('../models/userModel');
const Expense = require('../models/expenseModel');
const DeletedSale = require('../models/deletedSaleModel');
const {
  notifySaleCreated,
  notifyPaymentRecorded
} = require('../utils/pushNotifications');

const mongoose = require('mongoose');

const normalizeSaleType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (['vente en gros', 'gros', 'grossiste', 'gross', 'wholesale'].includes(normalized)) {
    return 'wholesale';
  }

  return 'normal';
};

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

const isAdminUser = (user) => Boolean(user?.isAdmin);

const buildSaleAccessFilter = (user, baseFilter = {}) => {
  if (isAdminUser(user)) {
    return baseFilter;
  }

  return {
    ...baseFilter,
    user: user?._id
  };
};

const assertSaleAccess = (sale, user) => {
  if (!sale) {
    return { allowed: false, status: 404, message: 'Vente non trouvée' };
  }

  if (isAdminUser(user)) {
    return { allowed: true };
  }

  const saleOwnerId = normalizeObjectId(sale.user);
  const requesterId = normalizeObjectId(user?._id);

  if (saleOwnerId && requesterId && saleOwnerId === requesterId) {
    return { allowed: true };
  }

  return { allowed: false, status: 403, message: 'Non autorisé à accéder à cette vente' };
};

const formatGroupedSummary = (rows = [], expectedKeys = []) => {
  const totalCount = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);

  return expectedKeys.reduce((acc, key) => {
    const match = rows.find((row) => row._id === key);
    const count = Number(match?.count) || 0;
    const totalAmount = Number(match?.totalAmount) || 0;

    acc[key] = {
      count,
      totalAmount,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
    };

    return acc;
  }, {});
};

const parseOptionalSaleDate = (value) => {
  if (value === undefined || value === null) {
    return { value: null };
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return { value: null };
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return { error: 'Format de date de vente invalide' };
  }

  return { value: parsed };
};

const recalculateClientPurchaseMetrics = async (clientId, session) => {
  const normalizedClientId = normalizeObjectId(clientId);

  if (!normalizedClientId || !mongoose.Types.ObjectId.isValid(normalizedClientId)) {
    return null;
  }

  const aggregateQuery = Sale.aggregate([
    {
      $match: {
        client: new mongoose.Types.ObjectId(normalizedClientId)
      }
    },
    {
      $group: {
        _id: '$client',
        totalPurchases: { $sum: '$totalAmount' },
        purchaseCount: { $sum: 1 },
        lastPurchaseDate: { $max: '$saleDate' }
      }
    }
  ]);

  if (session) {
    aggregateQuery.session(session);
  }

  const [summary] = await aggregateQuery;

  await Client.findByIdAndUpdate(
    normalizedClientId,
    {
      $set: {
        totalPurchases: Number(summary?.totalPurchases) || 0,
        purchaseCount: Number(summary?.purchaseCount) || 0,
        lastPurchaseDate: summary?.lastPurchaseDate || null
      }
    },
    { session }
  );

  return summary || null;
};

// @desc    Get all sales with filters
// @route   GET /api/sales
// @access  Private (admin: all sales, user: own sales)
const getSales = asyncHandler(async (req, res) => {
  try {
    const summaryMode = String(req.query.summary || '').trim().toLowerCase();
    const isCompactSummary = summaryMode === 'compact';
    const isListSummary = summaryMode === 'list';

    // Build filter object
    const filter = {};

    // Client filter
    if (req.query.client) {
      filter.client = req.query.client;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.saleDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Payment method filter
    if (req.query.paymentMethod) {
      filter.paymentMethod = req.query.paymentMethod;
    }

    if (req.query.saleType) {
      filter.saleType = normalizeSaleType(req.query.saleType);
    }

    let query = Sale.find(buildSaleAccessFilter(req.user, filter)).sort({ saleDate: -1 });

    if (isCompactSummary) {
      query = query
        .select('_id client totalAmount payments saleDate status updatedAt createdAt')
        .populate('client', 'name email');
    } else if (isListSummary) {
      query = query
        .select('_id client products totalAmount payments saleType saleDate status deliveryStatus deliveryDate deliveryNote updatedAt createdAt profitData profitCategory modificationHistory._id')
        .populate('client', 'name email')
        .populate({
          path: 'products.product',
          select: 'name container',
          model: 'Product'
        });
    } else {
      query = query
        .populate('client', 'name email')
        .populate({
          path: 'products.product',
          select: 'name costPrice container',
          model: 'Product'
        })
        .populate('user', 'name');
    }

    const sales = await query.lean();

    // Format sales data
    const formattedSales = sales.map(sale => {
      // Calculate payment totals (defensive: ensure numbers)
      const payments = Array.isArray(sale.payments) ? sale.payments : [];
      const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      const totalAmount = Number(sale.totalAmount) || 0;
      const balance = totalAmount - totalPaid;

      if (isCompactSummary) {
        return {
          ...sale,
          totalPaid,
          balance
        };
      }

      if (isListSummary) {
        return {
          ...sale,
          products: (sale.products || []).map((p) => ({
            ...p,
            product: p.product || { name: "Produit supprimé", container: '' }
          })),
          modificationCount: Array.isArray(sale.modificationHistory) ? sale.modificationHistory.length : 0,
          totalPaid,
          balance
        };
      }

      return {
        ...sale,
        formattedDate: new Date(sale.saleDate).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        products: sale.products.map(p => ({
          ...p,
          product: p.product || { name: "Produit supprimé", costPrice: 0 }
        })),
        totalPaid,
        balance
      };
    });

    res.json(formattedSales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get sales by user for dashboard
// @route   GET /api/sales/user/:userId
// @access  Private/Admin or Own user
const getUserSales = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Vérifier les permissions
  if (req.user.id !== userId && !req.user.isAdmin) {
    res.status(403);
    throw new Error('Non autorisé à accéder à ces données');
  }

  const user = await User.findById(userId)
    .select('name email phone photo isAdmin createdAt lastLogin')
    .lean();

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur introuvable');
  }

  // Récupérer les ventes avec les données associées
  const sales = await Sale.find({ user: userId })
    .populate('client', 'name')
    .populate({
      path: 'products.product',
      select: 'name costPrice container'
    })
    .sort({ saleDate: -1 })
    .lean();

  if (!sales || sales.length === 0) {
    return res.json({
      user,
      sales: [],
      stats: null
    });
  }

  // Calculer les statistiques
  const stats = calculateSalesStats(sales);

  res.json({
    user,
    sales,
    stats
  });
});

// Fonction pour calculer les statistiques des ventes
const calculateSalesStats = (sales) => {
  const stats = {
    totalSales: sales.length,
    totalAmount: 0,
    totalProfit: 0,
    totalPaid: 0,
    pendingSales: 0,
    partiallyPaidSales: 0,
    completedSales: 0,
    cancelledSales: 0,
    topProducts: {},
    paymentMethods: {
      cash: 0,
      MobileMoney: 0,
      credit: 0
    },
    salesByDay: {},
    salesByMonth: {},
    salesByYear: {}
  };

  sales.forEach(sale => {
    stats.totalAmount += sale.totalAmount;
    stats.totalProfit += sale.profit;
    stats.totalPaid += sale.totalPaid;

    // Compter par statut
    switch (sale.status) {
      case 'pending':
        stats.pendingSales++;
        break;
      case 'partially_paid':
        stats.partiallyPaidSales++;
        break;
      case 'completed':
        stats.completedSales++;
        break;
      case 'cancelled':
        stats.cancelledSales++;
        break;
    }

    // Compter par méthode de paiement
    sale.payments.forEach(payment => {
      stats.paymentMethods[payment.method] += payment.amount;
    });

    // Top produits
    sale.products.forEach(item => {
      const productId = item.product?._id || 'unknown';
      const productName = item.product?.name || 'Produit inconnu';

      if (!stats.topProducts[productId]) {
        stats.topProducts[productId] = {
          name: productName,
          quantity: 0,
          totalSales: 0,
          profit: 0
        };
      }

      const costPrice = item.product?.costPrice || 0;
      const profitPerItem = item.priceAtSale - costPrice;

      stats.topProducts[productId].quantity += item.quantity;
      stats.topProducts[productId].totalSales += item.priceAtSale * item.quantity;
      stats.topProducts[productId].profit += profitPerItem * item.quantity;
    });

    // Ventes par jour/mois/année
    const saleDate = new Date(sale.saleDate);
    const dayKey = saleDate.toISOString().split('T')[0];
    const monthKey = saleDate.getFullYear() + '-' + (saleDate.getMonth() + 1).toString().padStart(2, '0');
    const yearKey = saleDate.getFullYear().toString();

    if (!stats.salesByDay[dayKey]) stats.salesByDay[dayKey] = 0;
    if (!stats.salesByMonth[monthKey]) stats.salesByMonth[monthKey] = 0;
    if (!stats.salesByYear[yearKey]) stats.salesByYear[yearKey] = 0;

    stats.salesByDay[dayKey] += sale.totalAmount;
    stats.salesByMonth[monthKey] += sale.totalAmount;
    stats.salesByYear[yearKey] += sale.totalAmount;
  });

  // Trier les produits les plus vendus
  stats.topProducts = Object.values(stats.topProducts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return stats;
};

// @desc    Create a sale
// @route   POST /api/sales
// @access  Private
const createSale = asyncHandler(async (req, res) => {
  const {
    client,
    products,
    paymentMethod,
    note,
    reminderDate,
    reminderNote,
    saleType,
    initialPaymentAmount,
    markAsDelivered,
    saleDate
  } = req.body;

  let session;

  try {
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Ajoutez au moins un produit à la vente' });
    }

    let totalAmount = 0;
    const populatedProducts = [];
    const requestedItems = products.map((item) => ({
      productId: normalizeObjectId(item.product),
      quantity: Number(item.quantity),
      salePrice: Number(item.price)
    }));
    const uniqueProductIds = [...new Set(requestedItems.map((item) => item.productId).filter(Boolean))];
    const productDocuments = await Product.find({ _id: { $in: uniqueProductIds } })
      .select('_id name stock costPrice')
      .lean();
    const productMap = new Map(productDocuments.map((product) => [String(product._id), product]));
    const requestedQuantities = new Map();

    // Validate and calculate total
    for (const item of requestedItems) {
      const product = productMap.get(item.productId);

      if (!product) {
        return res.status(404).json({ message: `Produit introuvable` });
      }

      const quantity = item.quantity;
      const salePrice = item.salePrice;

      // Validation numérique robuste
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          message: `Quantité invalide pour ${product.name}`
        });
      }

      if (isNaN(salePrice)) {
        return res.status(400).json({
          message: `Prix invalide pour ${product.name}`
        });
      }

      if (salePrice < product.costPrice) {
        return res.status(400).json({
          message: `Prix de vente trop bas pour ${product.name} (min: ${product.costPrice} CFA)`
        });
      }

      const nextRequestedQuantity = (requestedQuantities.get(item.productId) || 0) + quantity;
      requestedQuantities.set(item.productId, nextRequestedQuantity);

      if (product.stock < nextRequestedQuantity) {
        return res.status(400).json({
          message: `Stock insuffisant pour ${product.name} (${product.stock} disponibles)`
        });
      }

      totalAmount += salePrice * quantity;

      populatedProducts.push({
        product: product._id,
        quantity: quantity,
        priceAtSale: salePrice
      });
    }

    const normalizedInitialPayment = Math.max(0, Number(initialPaymentAmount) || 0);

    if (normalizedInitialPayment > totalAmount) {
      return res.status(400).json({ message: 'Le montant payé ne peut pas dépasser le total de la vente' });
    }

    if (markAsDelivered && normalizedInitialPayment < totalAmount) {
      return res.status(400).json({ message: 'La livraison immédiate nécessite un paiement complet' });
    }

    const parsedSaleDate = parseOptionalSaleDate(saleDate);
    if (parsedSaleDate.error) {
      return res.status(400).json({ message: parsedSaleDate.error });
    }
    if (parsedSaleDate.value && !isAdminUser(req.user)) {
      return res.status(403).json({ message: 'Seul un administrateur peut definir une date de vente manuelle' });
    }

    const effectiveSaleDate = parsedSaleDate.value || new Date();

    // Create sale with reminder data
    const resolvedSaleType = isAdminUser(req.user)
      ? normalizeSaleType(saleType)
      : 'normal';

    const saleData = {
      client,
      products: populatedProducts,
      totalAmount,
      saleType: resolvedSaleType,
      paymentMethod,
      note,
      saleDate: effectiveSaleDate,
      user: req.user._id,
      // Stock is deducted explicitly below in the controller.
      stockDeducted: true
    };

    if (normalizedInitialPayment > 0) {
      saleData.payments = [{
        amount: normalizedInitialPayment,
        method: paymentMethod,
        paymentDate: effectiveSaleDate,
        user: req.user._id
      }];
    }

    if (markAsDelivered && normalizedInitialPayment >= totalAmount) {
      saleData.deliveryStatus = 'delivered';
      saleData.deliveryDate = effectiveSaleDate;
    }

    // Add reminder if provided
    if (reminderDate && normalizedInitialPayment < totalAmount) {
      saleData.paymentReminder = {
        isSet: true,
        reminderDate: new Date(reminderDate),
        reminderNote: reminderNote || '',
        status: 'pending'
      };
    }

    const stockOperations = [...requestedQuantities.entries()].map(([productId, quantity]) => ({
      updateOne: {
        filter: { _id: productId },
        update: { $inc: { stock: -quantity } }
      }
    }));

    session = await mongoose.startSession();
    session.startTransaction();

    const [sale] = await Sale.create([saleData], { session });

    const updatedClient = await Client.findByIdAndUpdate(
      client,
      {
        $addToSet: { purchases: sale._id }
      },
      { new: true, select: 'name', session }
    );

    if (stockOperations.length > 0) {
      await Product.bulkWrite(stockOperations, { session });
    }

    await recalculateClientPurchaseMetrics(client, session);

    await session.commitTransaction();
    session.endSession();
    session = null;

    const clientNameForNotification = updatedClient?.name || '';

    notifySaleCreated({
      saleId: sale._id,
      totalAmount,
      clientName: clientNameForNotification,
      actorId: req.user?._id
    }).catch((error) => {
      console.error('Push notification error (sale created):', error);
    });

    res.status(201).json(sale);

  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Add payment to existing sale
// @route   POST /api/sales/:id/payments
// @access  Private
const addPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, method, paymentDate, markAsDelivered } = req.body;

  try {
    const sale = await Sale.findById(id);
    const access = assertSaleAccess(sale, req.user);
    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    if (sale.status === 'cancelled') {
      return res.status(400).json({ message: 'Impossible d\'ajouter un paiement à une vente annulée' });
    }

    const parsedPaymentDate = parseOptionalSaleDate(paymentDate);
    if (parsedPaymentDate.error) {
      return res.status(400).json({ message: 'Format de date de paiement invalide' });
    }
    if (parsedPaymentDate.value) {
      if (!isAdminUser(req.user)) {
        return res.status(403).json({ message: 'Seul un administrateur peut definir une date de paiement manuelle' });
      }
      if (!req.user?.adminPreferences?.manualPaymentDateEnabled) {
        return res.status(403).json({ message: 'La date de paiement manuelle est désactivée dans les paramètres' });
      }
    }

    const effectivePaymentDate = parsedPaymentDate.value || new Date();

    sale.payments.push({
      amount,
      method,
      paymentDate: effectivePaymentDate,
      user: req.user._id // Inclure l'utilisateur
    });

    const updatedTotalPaid = (sale.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const saleTotalAmount = Number(sale.totalAmount) || 0;
    const remainingBalance = Math.max(saleTotalAmount - updatedTotalPaid, 0);

    if (markAsDelivered) {
      if (remainingBalance > 0) {
        return res.status(400).json({ message: 'La vente doit être entièrement payée pour être marquée comme livrée' });
      }

      sale.deliveryStatus = 'delivered';
      sale.deliveryDate = effectivePaymentDate;
    }

    await sale.save();

    await sale.populate([
      { path: 'client', select: 'name email phone' },
      { path: 'products.product', select: 'name price costPrice slug' },
      { path: 'payments.user', select: 'name email isAdmin role' },
      { path: 'modificationHistory.user', select: 'name email isAdmin role' },
      { path: 'user', select: 'name email isAdmin role' }
    ]);

    notifyPaymentRecorded({
      saleId: sale._id,
      amount,
      clientName: sale.client?.name || '',
      remainingBalance,
      actorId: req.user?._id
    }).catch((error) => {
      console.error('Push notification error (payment recorded):', error);
    });

    const saleObject = sale.toObject();
    const responseTotalPaid = (saleObject.payments || []).reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0
    );

    res.status(200).json({
      ...saleObject,
      totalPaid: responseTotalPaid,
      balance: (Number(saleObject.totalAmount) || 0) - responseTotalPaid
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Get sales statistics
// @route   GET /api/sales/stats
// @access  Private/Admin
const getSalesStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Sale.aggregate([
      {
        $match: {
          status: { $ne: 'cancelled' }
        }
      },
      {
        $project: {
          totalAmount: 1,
          totalPaid: {
            $reduce: {
              input: { $ifNull: ["$payments", []] },
              initialValue: 0,
              in: { $add: ["$$value", "$$this.amount"] }
            }
          },
          productsCount: { $size: { $ifNull: ["$products", []] } }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$totalPaid" },
          averageSale: { $avg: "$totalAmount" },
          totalProductsSold: { $sum: "$productsCount" },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalPaid: 1,
          outstandingBalance: { $subtract: ["$totalSales", "$totalPaid"] }, // Solde restant
          averageSale: 1,
          totalProductsSold: 1,
          transactionCount: 1
        }
      }
    ]);

    // Si pas de données, renvoyer un objet vide
    const result = stats[0] || {
      totalSales: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      averageSale: 0,
      totalProductsSold: 0,
      transactionCount: 0
    };

    res.json(result);

  } catch (error) {
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add this to your sales controller
const getSalesStatsByStatus = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Sale.aggregate([
      {
        $match: matchStage
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalPaid: { 
            $sum: {
              $reduce: {
                input: "$payments",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.amount"] }
              }
            }
          }
        }
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          totalAmount: 1,
          totalPaid: 1,
          outstandingBalance: { $subtract: ["$totalAmount", "$totalPaid"] },
          _id: 0
        }
      }
    ]);

    // Format the response
    const result = {
      completed: { count: 0, totalAmount: 0, totalPaid: 0, outstandingBalance: 0 },
      partially_paid: { count: 0, totalAmount: 0, totalPaid: 0, outstandingBalance: 0 },
      pending: { count: 0, totalAmount: 0, totalPaid: 0, outstandingBalance: 0 }
    };

    stats.forEach(stat => {
      if (result[stat.status]) {
        result[stat.status] = stat;
      }
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// @desc    Get sales by date range
// @route   GET /api/sales/date-range
// @access  Private
const getSalesByDateRange = asyncHandler(async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    const summaryMode = String(req.query.summary || '').trim().toLowerCase();
    const isDashboardSummary = summaryMode === 'dashboard';

    // Default to last 30 days if no dates provided
    if (!startDate) {
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);
      startDate = defaultStart.toISOString();
    }
    if (!endDate) endDate = new Date();

    // Convert to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: 'Format de date invalide' });
    }

    const dateFilter = buildSaleAccessFilter(req.user, {
      saleDate: {
        $gte: start,
        $lte: end
      }
    });

    let query = Sale.find(dateFilter).sort('saleDate');

    if (isDashboardSummary) {
      query = query
        .select('_id saleNumber client products totalAmount saleType saleDate createdAt')
        .populate('client', 'name')
        .populate('products.product', 'name price');
    } else {
      query = query
        .populate('client', 'name')
        .populate('products.product', 'name price')
        .populate('payments');
    }

    const sales = await query.lean();

    res.json(sales);

  } catch (error) {
    console.error('Erreur getSalesByDateRange:', error);
    res.status(500).json({
      message: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Nouvelle route pour les paiements par plage de dates
const getPaymentsByDateRange = asyncHandler(async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    const summaryMode = String(req.query.summary || '').trim().toLowerCase();
    const isDashboardSummary = summaryMode === 'dashboard';
    const now = new Date();

    if (!startDate) startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    if (!endDate) endDate = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    const paymentsMatch = buildSaleAccessFilter(req.user, {
      payments: {
        $elemMatch: {
          paymentDate: { $gte: start, $lte: end }
        }
      }
    });

    const payments = await Sale.aggregate([
      {
        $match: paymentsMatch
      },
      { $unwind: "$payments" },
      {
        $match: {
          "payments.paymentDate": {
            $gte: start,
            $lte: end
          }
        }
      },
      {
        $project: {
          _id: "$payments._id",
          amount: "$payments.amount",
          method: "$payments.method",
          paymentDate: "$payments.paymentDate",
          user: "$payments.user",
          saleId: "$_id",
          saleNumber: "$saleNumber",
          client: "$client",
          createdAt: "$createdAt"
        }
      },
      {
        $lookup: {
          from: "clients",
          localField: "client",
          foreignField: "_id",
          as: "client"
        }
      },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      ...(isDashboardSummary
        ? [
            {
              $project: {
                _id: 1,
                amount: 1,
                method: 1,
                paymentDate: 1,
                saleId: 1,
                saleNumber: 1,
                createdAt: 1,
                client: {
                  _id: "$client._id",
                  name: "$client.name"
                }
              }
            }
          ]
        : [
            {
              $project: {
                _id: 1,
                amount: 1,
                method: 1,
                paymentDate: 1,
                user: "$user",
                saleId: "$saleId",
                saleNumber: "$saleNumber",
                createdAt: 1,
                client: 1
              }
            }
          ])
    ]);

    res.json(payments);
  } catch (error) {
    console.error('Erreur getPaymentsByDateRange:', error);
    res.status(500).json({
      message: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get client's purchase history
// @route   GET /api/sales/client/:clientId
// @access  Private
const getClientPurchases = asyncHandler(async (req, res) => {
  try {
    const clientId = req.params.clientId;

    // Validate client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    const purchases = await Sale.find(buildSaleAccessFilter(req.user, { client: clientId }))
      .populate('products.product', 'name price')
      .sort({ saleDate: -1 })
      .lean();

    // Calculate client statistics
    const totalSpent = purchases.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const purchaseCount = purchases.length;
    const lastPurchaseDate = purchaseCount > 0
      ? new Date(Math.max(...purchases.map(s => new Date(s.saleDate))))
      : null;
    const averagePurchase = purchaseCount > 0 ? totalSpent / purchaseCount : 0;

    res.json({
      client: {
        _id: client._id,
        name: client.name,
        email: client.email
      },
      statistics: {
        totalSpent,
        purchaseCount,
        lastPurchaseDate,
        averagePurchase
      },
      purchases
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get sales dashboard data
// @route   GET /api/sales/dashboard-sale
// @access  Private/Admin
const getDashboardData = asyncHandler(async (req, res) => {
  try {
    const { range = '30days', summaryDate } = req.query;
    let startDate = new Date();
    const endDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Calcul de la période
    switch (range) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate = new Date(0); // Toutes les données
    }

    // Calcul des dates pour le résumé journalier
    let summaryStart = new Date();
    summaryStart.setHours(0, 0, 0, 0);

    let summaryEnd = new Date();
    summaryEnd.setHours(23, 59, 59, 999);

    if (summaryDate) {
      const parsedStart = new Date(`${summaryDate}T00:00:00`);
      if (!Number.isNaN(parsedStart.getTime())) {
        summaryStart = parsedStart;
        summaryEnd = new Date(`${summaryDate}T23:59:59.999`);
      }
    }

    // Requêtes en parallèle
    const [
      totalSalesResult,
      averageSaleResult,
      topProducts,
      salesTrend,
      paymentMethods,
      saleTypes,
      paymentStructures,
      neverPaidSalesData,
      salesByStatus,
      todaySales,
      todayPayments,
      allPayments, // Nouvelle requête pour tous les paiements
      bestSalesDay,
      bestPaymentDay,
      bestExpenseDay
    ] = await Promise.all([
      // Total des ventes et comptage
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$totalAmount" },
            salesCount: { $sum: 1 },
            totalProducts: { $sum: { $size: "$products" } }
          }
        }
      ]),

      // Vente moyenne
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: null,
            averageSale: { $avg: "$totalAmount" }
          }
        }
      ]),

      // Top produits
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        { $unwind: "$products" },
        {
          $group: {
            _id: "$products.product",
            quantity: { $sum: "$products.quantity" }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product"
          }
        },
        { $unwind: "$product" }
      ]),

      // Tendance des ventes
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
            total: { $sum: "$totalAmount" }
          }
        },
        { $sort: { "_id": 1 } },
        {
          $project: {
            date: "$_id",
            total: 1,
            _id: 0
          }
        }
      ]),

      // Méthodes de paiement
      Sale.aggregate([
        {
          $match: {
            payments: {
              $elemMatch: {
                paymentDate: { $gte: startDate, $lte: endDate }
              }
            },
            status: { $ne: "cancelled" }
          }
        },
        { $unwind: "$payments" },
        {
          $match: {
            "payments.paymentDate": { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: "$payments.method",
            totalAmount: { $sum: "$payments.amount" },
            count: { $sum: 1 }
          }
        }
      ]),

      // Types de vente
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: { $ifNull: ["$saleType", "normal"] },
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" }
          }
        }
      ]),

      // Structure de paiement des commandes
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $project: {
            totalAmount: 1,
            paymentsCount: { $size: { $ifNull: ["$payments", []] } },
            totalPaid: {
              $reduce: {
                input: { $ifNull: ["$payments", []] },
                initialValue: 0,
                in: { $add: ["$$value", "$$this.amount"] }
              }
            }
          }
        },
        {
          $addFields: {
            paymentStructure: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $gt: ["$paymentsCount", 1] },
                        { $gte: ["$totalPaid", "$totalAmount"] }
                      ]
                    },
                    then: "multiple_payments"
                  },
                  {
                    case: {
                      $and: [
                        { $gt: ["$paymentsCount", 0] },
                        { $lte: ["$paymentsCount", 1] },
                        { $gte: ["$totalPaid", "$totalAmount"] }
                      ]
                    },
                    then: "full_payment"
                  }
                ],
                default: "pending_payment"
              }
            }
          }
        },
        {
          $group: {
            _id: "$paymentStructure",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" }
          }
        }
      ]),

      // Ventes sans aucun paiement enregistré
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $addFields: {
            paymentsCount: { $size: { $ifNull: ["$payments", []] } }
          }
        },
        {
          $match: {
            paymentsCount: 0
          }
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  totalAmount: { $sum: "$totalAmount" }
                }
              }
            ],
            sales: [
              { $sort: { saleDate: -1 } },
              { $limit: 8 },
              {
                $lookup: {
                  from: "clients",
                  localField: "client",
                  foreignField: "_id",
                  as: "client"
                }
              },
              { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 1,
                  saleDate: 1,
                  totalAmount: 1,
                  status: 1,
                  saleType: { $ifNull: ["$saleType", "normal"] },
                  client: {
                    _id: "$client._id",
                    name: "$client.name"
                  }
                }
              }
            ]
          }
        }
      ]),

      // Statuts des ventes
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" }
          }
        }
      ]),

      // Résumé journalier des ventes
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: summaryStart, $lte: summaryEnd },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
            avgSale: { $avg: "$totalAmount" },
            pending: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "pending"] },
                  1,
                  0
                ]
              }
            },
            completed: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "completed"] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),

      // Paiements journaliers
      Sale.aggregate([
        {
          $match: {
            payments: {
              $elemMatch: {
                paymentDate: {
                  $gte: summaryStart,
                  $lte: summaryEnd
                }
              }
            },
            status: { $ne: "cancelled" }
          }
        },
        { $unwind: "$payments" },
        {
          $match: {
            "payments.paymentDate": {
              $gte: summaryStart,
              $lte: summaryEnd
            }
          }
        },
        {
          $group: {
            _id: null,
            paymentsCount: { $sum: 1 },
            paymentsTotal: { $sum: "$payments.amount" }
          }
        }
      ]),

      // NOUVEAU: Tous les paiements sur la période
      Sale.aggregate([
        {
          $match: {
            payments: {
              $elemMatch: {
                paymentDate: { $gte: startDate, $lte: endDate }
              }
            },
            status: { $ne: "cancelled" }
          }
        },
        { $unwind: "$payments" },
        {
          $match: {
            "payments.paymentDate": { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            allPaymentsCount: { $sum: 1 },
            allPaymentsTotal: { $sum: "$payments.amount" }
          }
        }
      ]),

      // Meilleur jour de ventes
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
            totalAmount: { $sum: "$totalAmount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 1 }
      ]),

      // Meilleur jour d'encaissements
      Sale.aggregate([
        {
          $match: {
            payments: {
              $elemMatch: {
                paymentDate: { $gte: startDate, $lte: endDate }
              }
            },
            status: { $ne: "cancelled" }
          }
        },
        { $unwind: "$payments" },
        {
          $match: {
            "payments.paymentDate": { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$payments.paymentDate" } },
            totalAmount: { $sum: "$payments.amount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 1 }
      ]),

      // Jour de dépense le plus élevé
      Expense.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 1 }
      ])
    ]);

    // Helpers
    const safeFirst = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);

    // Formatage des données du résumé journalier des ventes
    const dailySummary = todaySales[0] || {
      count: 0,
      totalAmount: 0,
      avgSale: 0,
      pending: 0,
      completed: 0
    };

    // Formatage des paiements journaliers
    const paymentsToday = todayPayments[0] || {
      paymentsCount: 0,
      paymentsTotal: 0
    };

    // Formatage de tous les paiements
    const allPaymentsData = allPayments[0] || {
      allPaymentsCount: 0,
      allPaymentsTotal: 0
    };

    const bestSalesEntry = safeFirst(bestSalesDay);
    const bestPaymentEntry = safeFirst(bestPaymentDay);
    const bestExpenseEntry = safeFirst(bestExpenseDay);

    const formatTopDay = (entry) => {
      if (!entry) return null;
      return {
        date: entry._id,
        totalAmount: entry.totalAmount,
        count: entry.count || 0
      };
    };

    // Formatage des méthodes de paiement
    const paymentMethodsData = {};
    let paymentTotalAmount = 0;

    paymentMethods.forEach(method => {
      paymentTotalAmount += Number(method.totalAmount) || 0;
    });

    paymentMethods.forEach(method => {
      const methodName = method._id || "non spécifié";
      const methodTotalAmount = Number(method.totalAmount) || 0;
      const methodCount = Number(method.count) || 0;

      paymentMethodsData[methodName] = {
        totalAmount: methodTotalAmount,
        count: methodCount,
        percentage: paymentTotalAmount > 0
          ? (methodTotalAmount / paymentTotalAmount) * 100
          : 0
      };
    });

    const saleTypeSummary = formatGroupedSummary(saleTypes, ['normal', 'wholesale']);
    const paymentStructureSummary = formatGroupedSummary(
      paymentStructures,
      ['full_payment', 'multiple_payments', 'pending_payment']
    );
    const neverPaidSummaryEntry = safeFirst(neverPaidSalesData?.[0]?.summary);
    const neverPaidSales = {
      count: Number(neverPaidSummaryEntry?.count) || 0,
      totalAmount: Number(neverPaidSummaryEntry?.totalAmount) || 0,
      sales: neverPaidSalesData?.[0]?.sales || []
    };

    // Formatage des ventes par statut
    const statusStats = {
      pending: { count: 0, totalAmount: 0 },
      partially_paid: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 }
    };

    salesByStatus.forEach(status => {
      if (statusStats.hasOwnProperty(status._id)) {
        statusStats[status._id] = {
          count: status.count,
          totalAmount: status.totalAmount
        };
      }
    });

    const result = {
      totalSales: totalSalesResult[0]?.totalSales || 0,
      salesCount: totalSalesResult[0]?.salesCount || 0,
      totalProducts: totalSalesResult[0]?.totalProducts || 0,
      averageSale: averageSaleResult[0]?.averageSale || 0,
      topProducts,
      salesTrend,
      paymentMethods: paymentMethodsData,
      saleTypeSummary,
      paymentStructureSummary,
      neverPaidSales,
      statusStats,
      dailySummary: {
        salesCount: dailySummary.count,
        totalAmount: dailySummary.totalAmount,
        averageSale: dailySummary.avgSale,
        pendingSales: dailySummary.pending,
        completedSales: dailySummary.completed,
        paymentsCount: paymentsToday.paymentsCount,
        paymentsTotal: paymentsToday.paymentsTotal
      },
      // Nouveaux indicateurs de paiements
      paymentsSummary: {
        paymentsCount: allPaymentsData.allPaymentsCount,
        paymentsTotal: allPaymentsData.allPaymentsTotal
      },
      bestDays: {
        sales: formatTopDay(bestSalesEntry),
        payments: formatTopDay(bestPaymentEntry),
        expenses: formatTopDay(bestExpenseEntry)
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Erreur dans getDashboardData:', error);
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// @desc    Get a sale by ID
// @route   GET /api/sales/:id
// @access  Private
const getSaleById = asyncHandler(async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate({
        path: 'products.product',
        select: 'name price costPrice slug',
        model: 'Product'
      })
      .populate({
        path: 'payments.user',
        select: 'name email isAdmin role',
        model: 'User'
      })
      .populate({
        path: 'modificationHistory.user',
        select: 'name email isAdmin role',
        model: 'User'
      })
      .populate('user', 'name email isAdmin role')
      .lean();

    const access = assertSaleAccess(sale, req.user);
    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    // Calculate payment totals (defensive: ensure numbers, handle missing payments)
    const payments = Array.isArray(sale.payments) ? sale.payments : [];
    const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const totalAmount = Number(sale.totalAmount) || 0;
    const balance = totalAmount - totalPaid;

    // Format payment dates
    const formattedSale = {
      ...sale,
      formattedDate: new Date(sale.saleDate).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      payments: sale.payments.map(p => ({
        ...p,
        formattedDate: new Date(p.paymentDate).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      })),
      totalPaid,
      balance
    };

    res.json(formattedSale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get sales statistics by user with accurate profit calculation
// @route   GET /api/sales/user-stats
// @access  Private/Admin
const getUserSalesStats = asyncHandler(async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: 'Non autorisé à accéder à ces statistiques' });
    }

    const { range = '30days' } = req.query;
    let startDate = new Date();

    // Définir la période en fonction du paramètre range
    switch (range) {
      case 'today': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today;
        break;
      }
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate = new Date(0); // Toutes les données
    }

    const stats = await Sale.aggregate([
      // Étape 1: Filtrer les ventes dans la période
      {
        $match: {
          saleDate: { $gte: startDate },
          status: { $ne: 'cancelled' } // Exclure les ventes annulées
        }
      },

      // Étape 2: Décomposer les tableaux de produits
      { $unwind: "$products" },

      // Étape 3: Joindre les informations des produits
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },

      // Étape 4: Calculer le profit pour chaque produit
      {
        $addFields: {
          "products.profitPerItem": {
            $subtract: [
              "$products.priceAtSale",
              "$productDetails.costPrice"
            ]
          },
          "products.totalProfit": {
            $multiply: [
              { $subtract: ["$products.priceAtSale", "$productDetails.costPrice"] },
              "$products.quantity"
            ]
          }
        }
      },

      // Étape 5: Regrouper d'abord par vente pour éviter de dupliquer totalAmount/salesCount
      {
        $group: {
          _id: "$_id",
          user: { $first: "$user" },
          client: { $first: "$client" },
          totalAmount: { $first: "$totalAmount" },
          totalPaid: {
            $first: {
              $reduce: {
                input: "$payments",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.amount"] }
              }
            }
          },
          totalProfit: { $sum: "$products.totalProfit" },
          productsSold: { $sum: "$products.quantity" }
        }
      },

      // Étape 6: Regrouper par utilisateur
      {
        $group: {
          _id: "$user",

          // Informations sur les ventes
          totalAmount: { $sum: "$totalAmount" },
          totalProfit: { $sum: "$totalProfit" },
          salesCount: { $sum: 1 },

          // Clients distincts
          clients: { $addToSet: "$client" },

          // Produits vendus
          productsSold: { $sum: "$productsSold" },

          // Détails des paiements
          totalPaid: { $sum: "$totalPaid" }
        }
      },

      // Étape 7: Joindre les informations utilisateur
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userData"
        }
      },
      { $unwind: "$userData" },

      // Étape 8: Formater les résultats
      {
        $project: {
          _id: 0,
          userId: "$_id",
          userName: "$userData.name",
          userEmail: "$userData.email",

          // Statistiques financières
          totalAmount: 1,
          totalProfit: 1,
          totalPaid: 1,
          balance: { $subtract: ["$totalAmount", "$totalPaid"] },

          // Statistiques commerciales
          salesCount: 1,
          clientsCount: { $size: "$clients" },
          productsSold: 1,

          // Moyennes
          averageSale: { $divide: ["$totalAmount", "$salesCount"] },
          averageProfit: { $divide: ["$totalProfit", "$salesCount"] }
        }
      },

      // Étape 9: Trier par chiffre d'affaires décroissant
      { $sort: { totalAmount: -1 } }
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Error in getUserSalesStats:', error);
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


const updateSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { products, note, saleType, saleDate } = req.body;
  const user = req.user;

  // Validation de l'ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "ID de vente invalide" });
  }

  // Vérification des permissions
  if (!user.isAdmin) {
    return res.status(403).json({
      message: "Seul un administrateur peut modifier une vente"
    });
  }

  try {
    // Récupération de la vente existante avec toutes les relations
    const existingSale = await Sale.findById(id)
      .populate('client')
      .populate('products.product')
      .populate('user');

    if (!existingSale) {
      return res.status(404).json({
        message: "Vente non trouvée",
        providedId: id
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, 'saleType') &&
      normalizeSaleType(saleType) !== normalizeSaleType(existingSale.saleType)
    ) {
      return res.status(400).json({
        message: "Le type de vente ne peut pas être modifié après création"
      });
    }

    const hasSaleDateOverride = Object.prototype.hasOwnProperty.call(req.body, 'saleDate');
    const parsedSaleDate = parseOptionalSaleDate(saleDate);
    if (parsedSaleDate.error || (hasSaleDateOverride && !parsedSaleDate.value)) {
      return res.status(400).json({
        message: parsedSaleDate.error || 'La date de vente est requise'
      });
    }

    const clientId = existingSale.client?._id || existingSale.client || null;
    const previousSaleDate = existingSale.saleDate ? new Date(existingSale.saleDate) : null;
    const nextSaleDate = parsedSaleDate.value || previousSaleDate;
    const saleDateChanged = Boolean(
      nextSaleDate &&
      previousSaleDate &&
      nextSaleDate.getTime() !== previousSaleDate.getTime()
    );

    // Sauvegarde des anciennes valeurs pour restauration des stocks
    const oldProductQuantities = existingSale.products.map(item => ({
      productId: item.product._id,
      quantity: item.quantity
    }));

    // Calcul de l'ancien montant total
    const oldTotalAmount = existingSale.totalAmount;

    // Validation et calcul du nouveau total
    let newTotalAmount = 0;
    const productUpdates = [];
    const updatedProducts = [];

    // Vérification de chaque produit
    for (const item of products) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          message: `Produit introuvable: ${item.product}`
        });
      }

      const quantity = Number(item.quantity);
      const salePrice = Number(item.price);

      // Validation des données numériques
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          message: `Quantité invalide pour ${product.name}`
        });
      }

      if (isNaN(salePrice) || salePrice <= 0) {
        return res.status(400).json({
          message: `Prix invalide pour ${product.name}`
        });
      }

      // Calcul du stock disponible (stock actuel + ancienne quantité)
      const oldQty = oldProductQuantities.find(p =>
        p.productId.equals(product._id)
      )?.quantity || 0;

      const availableStock = product.stock + oldQty;

      if (quantity > availableStock) {
        return res.status(400).json({
          message: `Stock insuffisant pour ${product.name} (${availableStock} disponibles)`
        });
      }

      if (salePrice < product.costPrice) {
        return res.status(400).json({
          message: `Prix de vente trop bas pour ${product.name} (min: ${product.costPrice} CFA)`
        });
      }

      newTotalAmount += salePrice * quantity;
      productUpdates.push({
        productId: product._id,
        quantity,
        oldQuantity: oldQty
      });
      updatedProducts.push({
        product: product._id,
        quantity,
        priceAtSale: salePrice
      });
    }

    // Mise à jour des stocks en transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Restaurer les anciennes quantités
      for (const item of oldProductQuantities) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      // 2. Appliquer les nouvelles quantités
      for (const update of productUpdates) {
        await Product.findByIdAndUpdate(
          update.productId,
          { $inc: { stock: -update.quantity } },
          { session }
        );
      }

      // 3. Calculer le nouveau solde et statut
      const balance = newTotalAmount - existingSale.totalPaid;
      const newStatus = balance <= 0 ? 'completed' :
        balance < newTotalAmount ? 'partially_paid' : 'pending';

      // 4. Créer l'historique de modification
      const saleDateNote = saleDateChanged
        ? `Date de vente ajustée du ${previousSaleDate.toLocaleString('fr-FR')} au ${nextSaleDate.toLocaleString('fr-FR')}`
        : '';
      const oldProductChangeRows = existingSale.products.map(oldItem => {
        const oldProductId = oldItem.product._id.toString();
        const newItem = products.find(p => p.product === oldProductId);

        return {
          product: oldItem.product._id,
          oldQuantity: oldItem.quantity,
          newQuantity: newItem?.quantity || 0,
          oldPrice: oldItem.priceAtSale,
          newPrice: newItem?.price || 0
        };
      });

      const oldProductIds = new Set(
        existingSale.products.map(oldItem => oldItem.product._id.toString())
      );
      const addedProductChangeRows = products
        .filter(newItem => !oldProductIds.has(newItem.product))
        .map(newItem => ({
          product: newItem.product,
          oldQuantity: 0,
          newQuantity: newItem.quantity || 0,
          oldPrice: 0,
          newPrice: newItem.price || 0
        }));

      const modificationEntry = {
        user: user._id,
        date: new Date(),
        note: [note || '', saleDateNote].filter(Boolean).join(' | '),
        changeType: saleDateChanged ? 'sale_updated' : 'products_updated',
        changes: {
          products: [...oldProductChangeRows, ...addedProductChangeRows]
        }
      };

      // 5. Mettre à jour la vente en utilisant save pour recalculer les bénéfices
      existingSale.products = updatedProducts;
      existingSale.totalAmount = newTotalAmount;
      existingSale.status = newStatus;
      existingSale.saleDate = nextSaleDate;
      if (!Array.isArray(existingSale.modificationHistory)) {
        existingSale.modificationHistory = [];
      }
      existingSale.modificationHistory.push(modificationEntry);
      existingSale.markModified('products');
      existingSale.markModified('modificationHistory');

      const updatedSaleDoc = await existingSale.save({ session });

      // 6. Mettre à jour le client si nécessaire
      if (clientId) {
        await recalculateClientPurchaseMetrics(clientId, session);
      }

      await session.commitTransaction();
      session.endSession();

      const populatedSale = await Sale.findById(updatedSaleDoc._id)
        .populate('client')
        .populate('products.product')
        .populate('user', 'name email isAdmin role')
        .populate({
          path: 'payments.user',
          select: 'name email isAdmin role'
        })
        .populate({
          path: 'modificationHistory.user',
          select: 'name email isAdmin role'
        });

      const saleObject = populatedSale.toObject();
      const totalPaid = saleObject.payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
      const safeTotalAmount = saleObject.totalAmount || 0;

      saleObject.totalPaid = totalPaid;
      saleObject.balance = Math.max(0, safeTotalAmount - totalPaid);

      res.json(saleObject);

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

const deleteSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reason = (req.body?.reason || '').trim();
  let session;

  try {
    if (!reason) {
      return res.status(400).json({ message: 'Une raison de suppression est requise' });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const sale = await Sale.findById(id)
      .populate('client', 'name email')
      .populate({
        path: 'products.product',
        select: 'name costPrice'
      })
      .populate('user', 'name email')
      .session(session);
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      session = null;
      return res.status(404).json({ message: 'Vente non trouvée' });
    }

    await DeletedSale.create([{
      saleId: sale._id,
      saleSnapshot: sale.toObject(),
      deletionReason: reason,
      deletedBy: req.user._id,
      deletedAt: new Date()
    }], { session });

    // Annuler les effets de la vente
    // 1. Restaurer le stock des produits
    if (sale.stockDeducted) {
      for (const item of sale.products) {
        const productId = item.product?._id || item.product;
        if (!productId) continue;
        await Product.findByIdAndUpdate(productId, {
          $inc: { stock: item.quantity }
        }, { session });
      }
    }

    // 2. Mettre à jour le client
    if (sale.client) {
      const clientId = sale.client?._id || sale.client;
      await Client.findByIdAndUpdate(clientId, {
        $pull: { purchases: sale._id }
      }, { session });
      await recalculateClientPurchaseMetrics(clientId, session);
    }

    // 3. Supprimer la vente
    await Sale.deleteOne({ _id: id }, { session });

    await session.commitTransaction();
    session.endSession();
    session = null;

    res.status(200).json({ message: 'Vente supprimée avec succès' });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    res.status(500).json({
      message: 'Erreur lors de la suppression',
      error: error.message
    });
  }
});

// @desc    Get deleted sales history
// @route   GET /api/sales/deleted
// @access  Private/Admin
const getDeletedSales = asyncHandler(async (req, res) => {
  const deletedSales = await DeletedSale.find({})
    .populate('deletedBy', 'name email')
    .sort({ deletedAt: -1 })
    .lean();

  res.json(deletedSales);
});

// @desc    Delete a payment
// @route   DELETE /api/sales/:saleId/payments/:paymentId
// @access  Private/Admin
const deletePayment = asyncHandler(async (req, res) => {
  const { saleId, paymentId } = req.params;

  try {
    const sale = await Sale.findById(saleId);

    if (!sale) {
      return res.status(404).json({ message: 'Vente non trouvée' });
    }

    // Trouver l'index du paiement
    const paymentIndex = sale.payments.findIndex(
      p => p._id.toString() === paymentId
    );

    if (paymentIndex === -1) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    // Supprimer le paiement
    const [deletedPayment] = sale.payments.splice(paymentIndex, 1);

    // Recalculer le total payé (defensive: ensure numbers)
    const totalPaid = (sale.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalAmount = Number(sale.totalAmount) || 0;
    sale.totalPaid = totalPaid;
    sale.balance = totalAmount - totalPaid;

    // Mettre à jour le statut
    if (sale.balance <= 0) {
      sale.status = 'completed';
    } else if (sale.totalPaid > 0) {
      sale.status = 'partially_paid';
    } else {
      sale.status = 'pending';
    }

    await sale.save();

    await sale.populate([
      { path: 'client', select: 'name email phone' },
      { path: 'products.product', select: 'name price costPrice slug' },
      { path: 'payments.user', select: 'name email isAdmin role' },
      { path: 'modificationHistory.user', select: 'name email isAdmin role' },
      { path: 'user', select: 'name email isAdmin role' }
    ]);

    res.status(200).json({
      message: 'Paiement supprimé',
      sale,
      deletedPayment
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Get upcoming reminders
// @route   GET /api/sales/reminders/upcoming
// @access  Private
const getUpcomingReminders = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const baseReminderFilter = isAdminUser(req.user) ? {} : { user: req.user._id };

    const [overdue, upcoming, neverPaid] = await Promise.all([
      Sale.find({
        ...baseReminderFilter,
        'paymentReminder.isSet': true,
        'paymentReminder.reminderDate': { $lte: now },
        'paymentReminder.status': 'pending',
        status: { $in: ['pending', 'partially_paid'] }
      })
        .populate('client', 'name email phone')
        .select('_id client totalAmount payments paymentReminder saleDate saleType status')
        .lean()
        .sort({ 'paymentReminder.reminderDate': 1 }),

      Sale.find({
        ...baseReminderFilter,
        'paymentReminder.isSet': true,
        'paymentReminder.reminderDate': {
          $gt: now,
          $lte: sevenDaysFromNow
        },
        'paymentReminder.status': 'pending',
        status: { $in: ['pending', 'partially_paid'] }
      })
        .populate('client', 'name email phone')
        .select('_id client totalAmount payments paymentReminder saleDate saleType status')
        .lean()
        .sort({ 'paymentReminder.reminderDate': 1 }),

      Sale.find({
        ...baseReminderFilter,
        status: 'pending',
        $expr: {
          $eq: [{ $size: { $ifNull: ['$payments', []] } }, 0]
        }
      })
        .populate('client', 'name email phone')
        .select('_id client totalAmount payments paymentReminder saleDate saleType status')
        .lean()
        .sort({ saleDate: 1 })
    ]);

    // Calculate balance and totalPaid manually
    const processReminders = (reminders) => {
      return reminders.map(sale => {
        const totalPaid = sale.payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
        const balance = Math.max(0, (sale.totalAmount || 0) - totalPaid);
        
        return {
          ...sale,
          totalPaid,
          balance
        };
      });
    };

    res.json({
      overdue: processReminders(overdue),
      upcoming: processReminders(upcoming),
      neverPaid: processReminders(neverPaid)
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur serveur interne',
      error: error.message 
    });
  }
});

// @desc    Send reminder
// @route   POST /api/sales/:id/send-reminder
// @access  Private
const sendReminder = asyncHandler(async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    const access = assertSaleAccess(sale, req.user);
    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    if (!sale.paymentReminder.isSet) {
      return res.status(404).json({ message: 'Rappel non trouvé' });
    }

    // Here you would integrate with your email/SMS service
    // For now, we'll just update the status
    sale.paymentReminder.status = 'sent';
    sale.paymentReminder.sentAt = new Date();
    sale.paymentReminder.sentBy = req.user._id;

    await sale.save();

    res.json(sale);
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de l\'envoi du rappel',
      error: error.message 
    });
  }
});

// @desc    Update reminder
// @route   PATCH /api/sales/:id/reminder
// @access  Private
const updateReminder = asyncHandler(async (req, res) => {
  try {
    const { reminderDate, reminderNote, isSet } = req.body;
    const sale = await Sale.findById(req.params.id);
    const access = assertSaleAccess(sale, req.user);
    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    if (isSet && reminderDate) {
      sale.paymentReminder = {
        isSet: true,
        reminderDate: new Date(reminderDate),
        reminderNote: reminderNote || '',
        status: 'pending'
      };
    } else {
      sale.paymentReminder = {
        isSet: false,
        status: 'cancelled'
      };
    }

    await sale.save();
    res.json(sale);
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour du rappel',
      error: error.message 
    });
  }
});

// @desc    Delete reminder
// @route   DELETE /api/sales/:id/reminder
// @access  Private
const deleteReminder = asyncHandler(async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    const access = assertSaleAccess(sale, req.user);
    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    sale.paymentReminder = {
      isSet: false,
      reminderDate: null,
      reminderNote: '',
      status: 'cancelled',
      sentAt: null,
      sentBy: null
    };

    await sale.save();
    res.json(sale);
  } catch (error) {
    res.status(500).json({
      message: 'Erreur lors de la suppression du rappel',
      error: error.message
    });
  }
});

// @desc    Update delivery status
// @route   PUT /api/sales/:id/delivery
// @access  Private
const updateDelivery = asyncHandler(async (req, res) => {
  try {
    const { deliveryStatus, deliveryNote, deliveryDate } = req.body;
    const sale = await Sale.findById(req.params.id);
    const access = assertSaleAccess(sale, req.user);
    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    if (sale.status !== 'completed') {
      return res.status(400).json({ message: 'La livraison ne peut être mise à jour que pour les ventes payées' });
    }

    sale.deliveryStatus = deliveryStatus;
    sale.deliveryNote = deliveryNote;
    if (deliveryDate) {
      sale.deliveryDate = deliveryDate;
    }

    await sale.save();
    res.json(sale);
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour du statut de livraison',
      error: error.message 
    });
  }
});

// @desc    Get delivery statistics
// @route   GET /api/sales/stats/delivery
// @access  Private/Admin
const getDeliveryStats = asyncHandler(async (req, res) => {
  try {
    const deliveryMatch = {
      status: 'completed',
      ...(isAdminUser(req.user) ? {} : { user: req.user._id })
    };

    const stats = await Sale.aggregate([
      {
        $match: deliveryMatch
      },
      {
        $group: {
          _id: '$deliveryStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Format the response
    const result = {
      delivered: { count: 0, totalAmount: 0 },
      not_delivered: { count: 0, totalAmount: 0 },
      pending: { count: 0, totalAmount: 0 }
    };

    stats.forEach(stat => {
      if (result[stat._id]) {
        result[stat._id] = stat;
      }
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des statistiques de livraison',
      error: error.message 
    });
  }
});

// @desc    Best days for sales, payments and expenses
// @route   GET /api/sales/best-days
// @access  Private/Admin
const getBestDays = asyncHandler(async (req, res) => {
  const { range = '30days' } = req.query;

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  switch (range) {
    case '7days':
      start.setDate(start.getDate() - 7);
      break;
    case '30days':
      start.setDate(start.getDate() - 30);
      break;
    case 'year':
      start.setDate(start.getDate() - 365);
      break;
    default:
      start.setTime(0);
  }

  const [bestSales, bestPayments, bestExpenses] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 1 }
    ]),
    Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      { $unwind: '$payments' },
      {
        $match: {
          'payments.paymentDate': { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$payments.paymentDate' } },
          totalAmount: { $sum: '$payments.amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 1 }
    ]),
    Expense.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 1 }
    ])
  ]);

  const formatEntry = (entry) => {
    if (!entry) return null;
    return {
      date: entry._id,
      totalAmount: entry.totalAmount,
      count: entry.count || 0
    };
  };

  res.json({
    range,
    sales: formatEntry(bestSales[0]),
    payments: formatEntry(bestPayments[0]),
    expenses: formatEntry(bestExpenses[0])
  });
});

module.exports = {
  createSale,
  addPayment,
  getSales,
  getSalesStats,
  getSalesByDateRange,
  getClientPurchases,
  getDashboardData,
  getUserSales,
  getSaleById,
  getSalesStatsByStatus,
  updateSale,
  getPaymentsByDateRange,
  getUserSalesStats,
  deletePayment,
  getUpcomingReminders,
  sendReminder,
  updateReminder,
  deleteReminder,
  deleteSale,
  getDeletedSales,
  updateDelivery,
  getDeliveryStats
  ,
  getBestDays
};
