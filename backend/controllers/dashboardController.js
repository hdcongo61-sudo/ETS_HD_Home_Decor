const Sale = require('../models/saleModel');
const Product = require('../models/productModel');
const Client = require('../models/clientModel');
const BankTransaction = require('../models/bankTransactionModel');
const Expense = require('../models/expenseModel');
const Employee = require('../models/employeeModel');
const { computeAccountingSummary } = require('./comptabiliteController');

// @desc    Get consolidated dashboard overview data
// @route   GET /api/dashboard/overview
// @access  Private
exports.getOverview = async (req, res) => {
  try {
    const { range = '30days' } = req.query;
    const userId = req.user._id;
    const isAdmin = req.user.isAdmin === true;
    const tenantId = req.user.tenantId;

    // Date calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Calculate date range
    let startDate = new Date(today);
    if (range === '30days') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (range === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (range === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const response = {};

    if (isAdmin) {
      // Admin gets full dashboard data
      const [
        salesData,
        productsData,
        clientsData,
        bankData,
        comptaData,
        remindersData,
        deliveryData,
        paymentsTodayData
      ] = await Promise.allSettled([
        // 1. Sales dashboard
        getSalesDashboard(tenantId, startDate, todayKey),
        // 2. Products dashboard
        getProductsDashboard(tenantId),
        // 3. Clients stats
        getClientsStats(tenantId),
        // 4. Bank transactions
        getBankTransactions(tenantId),
        // 5. Comptabilite summary
        getComptaSummary(tenantId),
        // 6. Sales reminders
        getSalesReminders(tenantId),
        // 7. Delivery stats
        getDeliveryStats(tenantId),
        // 8. Payments received today (encaissements du jour)
        getPaymentsToday(tenantId)
      ]);

      response.sales = salesData.status === 'fulfilled' ? salesData.value : null;
      response.products = productsData.status === 'fulfilled' ? productsData.value : null;
      response.clients = clientsData.status === 'fulfilled' ? clientsData.value : null;
      response.bank = bankData.status === 'fulfilled' ? bankData.value : null;
      response.compta = comptaData.status === 'fulfilled' ? comptaData.value : null;
      response.reminders = remindersData.status === 'fulfilled' ? remindersData.value : null;
      response.delivery = deliveryData.status === 'fulfilled' ? deliveryData.value : null;
      response.paymentsToday = paymentsTodayData.status === 'fulfilled'
        ? paymentsTodayData.value
        : { total: 0, count: 0 };

      response.errors = [
        salesData, productsData, clientsData, bankData, comptaData, remindersData, deliveryData, paymentsTodayData
      ].filter(r => r.status === 'rejected').length;
    } else {
      // Regular user: their own sales + the store-wide daily figures shown on
      // the home page for sellers (CA du jour, encaissements du jour).
      const [userSales, paymentsTodayData, todaySalesData, todayExpensesData] = await Promise.allSettled([
        getUserSales(tenantId, userId),
        getPaymentsToday(tenantId),
        getTodaySales(tenantId),
        getTodayExpenses(tenantId)
      ]);

      response.userSales = userSales.status === 'fulfilled'
        ? userSales.value
        : { total: 0, count: 0, sales: [] };
      response.paymentsToday = paymentsTodayData.status === 'fulfilled'
        ? paymentsTodayData.value
        : { total: 0, count: 0 };
      response.todaySales = todaySalesData.status === 'fulfilled'
        ? todaySalesData.value
        : { total: 0, count: 0 };
      response.todayExpenses = todayExpensesData.status === 'fulfilled'
        ? todayExpensesData.value
        : { total: 0, count: 0 };
      response.errors = [userSales, paymentsTodayData, todaySalesData, todayExpensesData]
        .filter((r) => r.status === 'rejected').length;
    }

    res.json(response);
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ message: 'Erreur lors du chargement du tableau de bord' });
  }
};

// Helper functions for each data section
async function getSalesDashboard(tenantId, startDate, todayKey) {
  const sales = await Sale.find({
    tenantId,
    saleDate: { $gte: startDate },
    status: { $nin: ['deleted', 'cancelled'] }
  })
    .populate('products.product', 'name price')
    .lean();

  const summary = {
    total: 0,
    count: 0,
    profit: 0,
    today: 0,
    todayCount: 0
  };

  const trendMap = {};
  const topProductsMap = {};

  sales.forEach(sale => {
    const amount = sale.totalAmount || 0;
    const profit = (sale.profitData && sale.profitData.totalProfit) || sale.profit || 0;
    summary.total += amount;
    summary.count += 1;
    summary.profit += profit;

    const saleDate = new Date(sale.saleDate || sale.createdAt);
    saleDate.setHours(0, 0, 0, 0);
    const dateKey = saleDate.toISOString().split('T')[0];

    if (dateKey === todayKey) {
      summary.today += amount;
      summary.todayCount += 1;
    }

    if (!trendMap[dateKey]) {
      trendMap[dateKey] = 0;
    }
    trendMap[dateKey] += amount;

    (sale.products || []).forEach(item => {
      const p = item.product;
      const pid = p && p._id ? String(p._id) : 'unknown';
      if (!topProductsMap[pid]) {
        topProductsMap[pid] = {
          product: p
            ? { _id: p._id, name: p.name || 'Produit inconnu', price: p.price || 0 }
            : { name: 'Produit inconnu' },
          quantity: 0
        };
      }
      topProductsMap[pid].quantity += item.quantity || 0;
    });
  });

  const salesTrend = Object.entries(trendMap).map(([date, total]) => ({
    date,
    total
  })).sort((a, b) => a.date.localeCompare(b.date));

  // Répartition par statut (hors supprimées) — alimente « À solder ».
  const statusRows = await Sale.aggregate([
    { $match: { tenantId, status: { $ne: 'deleted' } } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } }
  ]);

  const statusStats = {
    pending: { count: 0, totalAmount: 0 },
    partially_paid: { count: 0, totalAmount: 0 },
    completed: { count: 0, totalAmount: 0 },
    cancelled: { count: 0, totalAmount: 0 }
  };
  statusRows.forEach(row => {
    if (statusStats[row._id]) {
      statusStats[row._id] = { count: row.count, totalAmount: row.totalAmount };
    }
  });

  const topProducts = Object.values(topProductsMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return { summary, salesTrend, topProducts, statusStats };
}

async function getProductsDashboard(tenantId) {
  const products = await Product.find({ tenantId }).lean();

  const lowStockProducts = products.filter(p => (p.stock || 0) < 5);
  const outOfStock = products.filter(p => (p.stock || 0) === 0);

  const totalValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
  const lowStockValue = lowStockProducts.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);

  return {
    totalProducts: products.length,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStock.length,
    totalValue,
    lowStockValue,
    lowStockProducts: lowStockProducts.slice(0, 10)
  };
}

async function getClientsStats(tenantId) {
  const clients = await Client.find({ tenantId }).lean();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalClients = clients.length;
  // totalPurchases = montant cumulé, purchaseCount = nombre d'achats.
  const loyalClients = clients.filter(c => (c.purchaseCount || 0) >= 5).length;
  const vipClients = clients.filter(c => (c.totalPurchases || 0) >= 500000).length;
  const newThisMonth = clients.filter(c => c.createdAt && new Date(c.createdAt) >= monthStart).length;
  const totalSpent = clients.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);
  const topClients = clients
    .map(c => ({
      _id: c._id,
      name: c.name || 'Client',
      totalSpent: c.totalPurchases || 0,
      totalSales: c.purchaseCount || 0
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  return {
    totalClients,
    loyalClients,
    vipClients,
    newThisMonth,
    totalSpent,
    topClients
  };
}

async function getBankTransactions(tenantId) {
  const transactions = await BankTransaction.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return transactions;
}

async function getComptaSummary(tenantId) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Même moteur de calcul que le module Comptabilité : les chiffres de
  // l'accueil restent identiques à ceux de /comptabilite/summary.
  const data = await computeAccountingSummary({ tenantId, start: firstDay, end: lastDay });
  return { data };
}

async function getSalesReminders(tenantId) {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [overdue, upcoming, neverPaid, salaryEmployees] = await Promise.all([
    Sale.find({
      tenantId,
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
      tenantId,
      'paymentReminder.isSet': true,
      'paymentReminder.reminderDate': { $gt: now, $lte: sevenDaysFromNow },
      'paymentReminder.status': 'pending',
      status: { $in: ['pending', 'partially_paid'] }
    })
      .populate('client', 'name email phone')
      .select('_id client totalAmount payments paymentReminder saleDate saleType status')
      .lean()
      .sort({ 'paymentReminder.reminderDate': 1 }),

    Sale.find({
      tenantId,
      status: 'pending',
      $expr: { $eq: [{ $size: { $ifNull: ['$payments', []] } }, 0] }
    })
      .populate('client', 'name email phone')
      .select('_id client totalAmount payments paymentReminder saleDate saleType status')
      .lean()
      .sort({ saleDate: 1 }),

    Employee.find({
      tenantId,
      isActive: { $ne: false },
      $expr: { $eq: [{ $dayOfMonth: '$hireDate' }, currentDay] },
      paySlips: { $not: { $elemMatch: { month: currentMonth, year: currentYear } } }
    })
      .select('_id name slug position department salary hireDate photo paySlips')
      .lean()
      .sort({ name: 1 })
  ]);

  const processReminders = (reminders) => reminders.map(sale => {
    const totalPaid = sale.payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
    const balance = Math.max(0, (sale.totalAmount || 0) - totalPaid);
    return { ...sale, totalPaid, balance };
  });

  return {
    overdue: processReminders(overdue),
    upcoming: processReminders(upcoming),
    neverPaid: processReminders(neverPaid),
    salaryReminders: salaryEmployees.map((employee) => ({
      _id: employee._id,
      name: employee.name,
      slug: employee.slug,
      position: employee.position,
      department: employee.department,
      salary: employee.salary || 0,
      hireDate: employee.hireDate,
      photo: employee.photo || '',
      month: currentMonth,
      year: currentYear,
      dueDate: now
    }))
  };
}

async function getDeliveryStats(tenantId) {
  const sales = await Sale.find({
    tenantId,
    status: { $nin: ['deleted', 'cancelled'] }
  }).lean();

  const pending = sales.filter(s => s.deliveryStatus === 'pending').length;
  const notDelivered = sales.filter(s => s.deliveryStatus === 'not_delivered').length;
  const delivered = sales.filter(s => s.deliveryStatus === 'delivered').length;

  return {
    pending: { count: pending },
    not_delivered: { count: notDelivered },
    delivered: { count: delivered },
    total: sales.length
  };
}

// Encaissements du jour : paiements reçus aujourd'hui sur les ventes
// (date de paiement), indépendamment de la date de création de la vente.
async function getPaymentsToday(tenantId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [agg] = await Sale.aggregate([
    {
      $match: {
        tenantId,
        status: { $nin: ['deleted', 'cancelled'] },
        payments: { $elemMatch: { paymentDate: { $gte: start, $lte: end } } }
      }
    },
    { $unwind: '$payments' },
    { $match: { 'payments.paymentDate': { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        total: { $sum: '$payments.amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    total: (agg && agg.total) || 0,
    count: (agg && agg.count) || 0
  };
}

// CA du jour : total et nombre de ventes dont la date de vente est aujourd'hui.
async function getTodaySales(tenantId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [agg] = await Sale.aggregate([
    {
      $match: {
        tenantId,
        status: { $nin: ['deleted', 'cancelled'] },
        saleDate: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    total: (agg && agg.total) || 0,
    count: (agg && agg.count) || 0
  };
}

// Dépenses du jour : total et nombre de dépenses datées d'aujourd'hui.
async function getTodayExpenses(tenantId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [agg] = await Expense.aggregate([
    {
      $match: {
        tenantId,
        date: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    total: (agg && agg.total) || 0,
    count: (agg && agg.count) || 0
  };
}

async function getUserSales(tenantId, userId) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const sales = await Sale.find({
    tenantId,
    createdBy: userId,
    createdAt: { $gte: startDate },
    status: { $ne: 'deleted' }
  }).lean();

  const total = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const count = sales.length;

  return {
    total,
    count,
    sales: sales.slice(0, 10)
  };
}

// @desc    Export weekly analytical summary
// @route   GET /api/dashboard/export/weekly
// @access  Private/Admin
exports.exportWeeklySummary = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const now = new Date();
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - 7);
    startWeek.setHours(0, 0, 0, 0);

    // Récupérer les ventes de la semaine
    const sales = await Sale.find({
      tenantId,
      saleDate: { $gte: startWeek },
      status: { $nin: ['deleted', 'cancelled'] }
    })
      .populate('client', 'name')
      .populate('products.product', 'name price')
      .populate('createdBy', 'name email')
      .lean();

    // Agrégation par utilisateur
    const userStats = {};
    sales.forEach(sale => {
      const userId = sale.createdBy?._id?.toString() || 'unknown';
      if (!userStats[userId]) {
        userStats[userId] = {
          userName: sale.createdBy?.name || 'Utilisateur inconnu',
          userEmail: sale.createdBy?.email || '',
          totalAmount: 0,
          totalProfit: 0,
          totalPaid: 0,
          salesCount: 0
        };
      }

      const totalPaid = (sale.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const profit = (sale.profitData && sale.profitData.totalProfit) || sale.profit || 0;

      userStats[userId].totalAmount += sale.totalAmount || 0;
      userStats[userId].totalProfit += profit;
      userStats[userId].totalPaid += totalPaid;
      userStats[userId].salesCount += 1;
    });

    // Conversion en tableau et calculs
    const ranking = Object.values(userStats).map(entry => ({
      ...entry,
      balance: entry.totalAmount - entry.totalPaid,
      collectionRate: entry.totalAmount > 0 ? (entry.totalPaid / entry.totalAmount) * 100 : 0,
      averageSale: entry.salesCount > 0 ? entry.totalAmount / entry.salesCount : 0
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // Calculs globaux
    const totals = ranking.reduce(
      (acc, curr) => {
        acc.revenue += curr.totalAmount;
        acc.profit += curr.totalProfit;
        acc.paid += curr.totalPaid;
        acc.balance += curr.balance;
        acc.sales += curr.salesCount;
        return acc;
      },
      { revenue: 0, profit: 0, paid: 0, balance: 0, sales: 0 }
    );

    const excel = require('exceljs');
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Résumé hebdomadaire');

    // Titre et période
    worksheet.mergeCells('A1:G1');
    const titleRow = worksheet.getCell('A1');
    titleRow.value = 'Résumé analytique hebdomadaire';
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:G2');
    const periodRow = worksheet.getCell('A2');
    periodRow.value = `Période: ${startWeek.toLocaleDateString('fr-FR')} - ${now.toLocaleDateString('fr-FR')}`;
    periodRow.font = { size: 12, color: { argb: 'FF64748B' } };
    periodRow.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]);

    // Section : Indicateurs globaux
    worksheet.addRow(['INDICATEURS GLOBAUX']);
    const globalHeaderRow = worksheet.lastRow;
    globalHeaderRow.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    globalHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };

    worksheet.addRow(['Vendeurs actifs', ranking.length]);
    worksheet.addRow(['Nombre de ventes', totals.sales]);
    worksheet.addRow(['Chiffre d\'affaires', totals.revenue, 'CFA']);
    worksheet.addRow(['Bénéfice total', totals.profit, 'CFA']);
    worksheet.addRow(['Encaissements', totals.paid, 'CFA']);
    worksheet.addRow(['Reste à encaisser', totals.balance, 'CFA']);
    worksheet.addRow(['Taux de recouvrement', totals.revenue > 0 ? ((totals.paid / totals.revenue) * 100).toFixed(1) : 0, '%']);
    worksheet.addRow(['Panier moyen', totals.sales > 0 ? (totals.revenue / totals.sales).toFixed(0) : 0, 'CFA']);

    worksheet.addRow([]);

    // Section : Classement par vendeur
    worksheet.addRow(['CLASSEMENT PAR VENDEUR']);
    const rankingHeaderRow = worksheet.lastRow;
    rankingHeaderRow.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    rankingHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };

    worksheet.addRow([]);

    // En-têtes du tableau
    const tableHeaders = [
      'Vendeur',
      'Email',
      'Ventes',
      'CA (CFA)',
      'Bénéfice (CFA)',
      'Encaissement (%)',
      'Solde (CFA)',
      'Panier moyen (CFA)'
    ];
    worksheet.addRow(tableHeaders);
    const headerRow = worksheet.lastRow;
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Données des vendeurs
    ranking.forEach((entry, index) => {
      const row = worksheet.addRow([
        entry.userName,
        entry.userEmail,
        entry.salesCount,
        entry.totalAmount,
        entry.totalProfit,
        entry.collectionRate.toFixed(1),
        entry.balance,
        entry.averageSale.toFixed(0)
      ]);

      // Mise en forme
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Highlight du meilleur vendeur
        if (index === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0FDF4' }
          };
        }

        // Formatage des montants
        if ([4, 5, 7, 8].includes(colNumber)) {
          cell.numFmt = '#,##0';
        }
        if (colNumber === 6) {
          cell.numFmt = '0.0';
        }
      });
    });

    // Ajuster les largeurs de colonnes
    worksheet.columns = [
      { width: 25 },
      { width: 30 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 20 }
    ];

    // Générer le fichier
    const filename = `resume-analytique-hebdo-${now.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erreur export résumé hebdomadaire:', err);
    res.status(500).json({ message: 'Erreur lors de l\'export du résumé hebdomadaire' });
  }
};
