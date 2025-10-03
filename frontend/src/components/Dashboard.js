import React, { useState, useEffect, useContext, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import AuthContext from '../context/AuthContext';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, Target } from 'lucide-react';

// Lazy loading des composants lourds
const DayDetailsModal = lazy(() => import('./DayDetailsModal'));

const StatisticsCard = ({ title, value, color, textColor, icon }) => (
  <div className={`p-5 rounded-2xl ${color} flex items-center gap-4 backdrop-blur-sm bg-white/80 border border-gray-200/50 shadow-sm`}>
    <div className={`p-3 rounded-xl ${textColor} bg-white bg-opacity-70`}>
      {icon}
    </div>
    <div>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className={`text-2xl font-semibold ${textColor}`}>
        {typeof value === 'number' ? value.toLocaleString() + ' CFA' : value}
      </div>
    </div>
  </div>
);

const ProfitAnalysisCard = ({ title, value, change, trend, description, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700"
  };

  const iconColors = {
    blue: "text-blue-600",
    green: "text-green-600",
    purple: "text-purple-600",
    orange: "text-orange-600"
  };

  return (
    <div className={`p-4 rounded-xl border-2 ${colorClasses[color]} hover:shadow-md transition-all duration-200`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold opacity-80 mb-1">{title}</h3>
          <div className="text-2xl font-bold mb-2">{value}</div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-medium ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trend === 'up' ? <TrendingUp size={16} /> : trend === 'down' ? <TrendingDown size={16} /> : null}
              {change > 0 ? '+' : ''}{change}%
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white ${iconColors[color]}`}>
          <DollarSign size={20} />
        </div>
      </div>
      {description && (
        <p className="text-xs opacity-70 mt-2">{description}</p>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [expensesData, setExpensesData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  const [timeRange, setTimeRange] = useState('week');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetails, setDayDetails] = useState({ sales: [], expenses: [], payments: [] });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [salesStatusData, setSalesStatusData] = useState({
    completed: { count: 0, totalAmount: 0, totalPaid: 0, outstandingBalance: 0 },
    partially_paid: { count: 0, totalAmount: 0, totalPaid: 0, outstandingBalance: 0 },
    pending: { count: 0, totalAmount: 0, totalPaid: 0, outstandingBalance: 0 }
  });
  const [paymentAnalysis, setPaymentAnalysis] = useState({
    totalPayments: 0,
    paymentMethods: {},
    paymentsByUser: {}
  });
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (!showExportMenu) return;

    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Vérification si l'utilisateur est admin
  // Calcul des métriques de bénéfices
  const calculateProfitMetrics = (sales, expenses, payments) => {
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    
    // Calcul du bénéfice brut (encaissements - dépenses)
    const grossProfit = totalPayments - totalExpenses;
    
    // Calcul du bénéfice net (revenus - dépenses)
    const netProfit = totalRevenue - totalExpenses;
    
    // Taux de marge
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Efficacité opérationnelle
    const operationalEfficiency = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    
    // Retour sur investissement (simplifié)
    const roi = totalExpenses > 0 ? (grossProfit / totalExpenses) * 100 : 0;
    
    return {
      grossProfit,
      netProfit,
      profitMargin,
      netMargin,
      operationalEfficiency,
      roi,
      totalRevenue,
      totalExpenses,
      totalPayments
    };
  };

  // Analyse des tendances des bénéfices
  const analyzeProfitTrends = (combinedData) => {
    if (combinedData.length < 2) return { dailyGrowth: 0, weeklyGrowth: 0, monthlyGrowth: 0 };
    
    const currentDay = combinedData[combinedData.length - 1];
    const previousDay = combinedData[combinedData.length - 2];
    
    const dailyGrowth = previousDay.paid > 0 
      ? ((currentDay.paid - previousDay.paid) / previousDay.paid) * 100 
      : 0;
    
    // Calcul de la croissance hebdomadaire (moyenne des 7 derniers jours vs 7 jours précédents)
    const last7Days = combinedData.slice(-7);
    const previous7Days = combinedData.slice(-14, -7);
    
    const avgLast7Days = last7Days.reduce((sum, day) => sum + day.paid, 0) / (last7Days.length || 1);
    const avgPrevious7Days = previous7Days.reduce((sum, day) => sum + day.paid, 0) / (previous7Days.length || 1);
    
    const weeklyGrowth = avgPrevious7Days > 0 
      ? ((avgLast7Days - avgPrevious7Days) / avgPrevious7Days) * 100 
      : 0;
    
    return {
      dailyGrowth: Math.round(dailyGrowth * 100) / 100,
      weeklyGrowth: Math.round(weeklyGrowth * 100) / 100,
      monthlyGrowth: Math.round(weeklyGrowth * 4 * 100) / 100 // Estimation mensuelle
    };
  };

  // Catégorisation de la performance
  const getPerformanceCategory = (margin) => {
    if (margin >= 40) return { category: "Excellente", color: "green", trend: "up" };
    if (margin >= 25) return { category: "Bonne", color: "blue", trend: "up" };
    if (margin >= 15) return { category: "Moyenne", color: "orange", trend: "stable" };
    return { category: "Faible", color: "red", trend: "down" };
  };

  const getDateRange = (range) => {
    const now = new Date();
    switch (range) {
      case 'day':
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case 'week':
        return {
          start: startOfWeek(now, { locale: fr }),
          end: endOfWeek(now, { locale: fr })
        };
      case 'year':
        return {
          start: startOfYear(now),
          end: endOfYear(now)
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  };

  const processSalesStatusData = (sales) => {
    const statusData = {
      completed: { count: 0, totalAmount: 0, totalPaid: 0 },
      partially_paid: { count: 0, totalAmount: 0, totalPaid: 0 },
      pending: { count: 0, totalAmount: 0, totalPaid: 0 }
    };

    sales.forEach(sale => {
      const totalPaid = sale.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

      if (sale.status === 'completed') {
        statusData.completed.count += 1;
        statusData.completed.totalAmount += sale.totalAmount || 0;
        statusData.completed.totalPaid += totalPaid;
      } else if (sale.status === 'partially_paid') {
        statusData.partially_paid.count += 1;
        statusData.partially_paid.totalAmount += sale.totalAmount || 0;
        statusData.partially_paid.totalPaid += totalPaid;
      } else if (sale.status === 'pending') {
        statusData.pending.count += 1;
        statusData.pending.totalAmount += sale.totalAmount || 0;
        statusData.pending.totalPaid += totalPaid;
      }
    });

    statusData.completed.outstandingBalance = statusData.completed.totalAmount - statusData.completed.totalPaid;
    statusData.partially_paid.outstandingBalance = statusData.partially_paid.totalAmount - statusData.partially_paid.totalPaid;
    statusData.pending.outstandingBalance = statusData.pending.totalAmount - statusData.pending.totalPaid;

    return statusData;
  };

  const processPaymentAnalysis = (payments, users) => {
    const analysis = {
      totalPayments: 0,
      paymentMethods: {
        cash: 0,
        MobileMoney: 0,
        credit: 0
      },
      paymentsByUser: {}
    };

    users.forEach(user => {
      analysis.paymentsByUser[user._id] = {
        name: user.name || user.username || `Utilisateur ${user._id.substring(0, 6)}`,
        amount: 0,
        count: 0
      };
    });

    payments.forEach(payment => {
      analysis.totalPayments += payment.amount || 0;

      if (analysis.paymentMethods[payment.method]) {
        analysis.paymentMethods[payment.method] += payment.amount || 0;
      }

      if (payment.user && analysis.paymentsByUser[payment.user]) {
        analysis.paymentsByUser[payment.user].amount += payment.amount || 0;
        analysis.paymentsByUser[payment.user].count += 1;
      }
    });

    return analysis;
  };

  const fetchReminders = async () => {
    try {
      const response = await api.get('/sales/reminders/upcoming');
      setUpcomingReminders(response.data.upcoming || []);
      setOverdueReminders(response.data.overdue || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { start, end } = getDateRange(timeRange);

        const requests = [
          api.get(`/sales/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
          api.get(`/expenses/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
          api.get(`/sales/payments/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
        ];

        // Seulement récupérer les données utilisateurs si admin
        if (isAdmin) {
          requests.push(api.get('/users'));
        }

        const [salesRes, expensesRes, paymentsRes, usersRes] = await Promise.all(requests);

        setSalesData(salesRes.data);
        setExpensesData(expensesRes.data);
        setPaymentsData(paymentsRes.data);

        if (isAdmin) {
          const users = usersRes?.data || [];
          const statusData = processSalesStatusData(salesRes.data);
          setSalesStatusData(statusData);

          const paymentAnal = processPaymentAnalysis(paymentsRes.data, users);
          setPaymentAnalysis(paymentAnal);
        }

        const processedData = processCombinedData(salesRes.data, expensesRes.data, paymentsRes.data);
        setCombinedData(processedData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange, isAdmin]);

  const processCombinedData = (sales, expenses, payments) => {
    const dateMap = {};

    sales.forEach(sale => {
      const date = format(new Date(sale.createdAt), 'yyyy-MM-dd');
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          sales: 0,
          paid: 0,
          expenses: 0,
          transactionCount: 0,
          productCount: 0
        };
      }

      dateMap[date].sales += sale.totalAmount || 0;
      dateMap[date].transactionCount += 1;
      dateMap[date].productCount += sale.products?.length || 0;
    });

    expenses.forEach(expense => {
      const date = format(new Date(expense.createdAt), 'yyyy-MM-dd');
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          sales: 0,
          paid: 0,
          expenses: 0,
          transactionCount: 0,
          productCount: 0
        };
      }
      dateMap[date].expenses += expense.amount || 0;
    });

    payments.forEach(payment => {
      const paymentDate = payment?.paymentDate ? new Date(payment.paymentDate) : null;
      if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
        return;
      }

      const date = format(paymentDate, 'yyyy-MM-dd');
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          sales: 0,
          paid: 0,
          expenses: 0,
          transactionCount: 0,
          productCount: 0
        };
      }
      dateMap[date].paid += payment.amount || 0;
    });

    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const totalSales = combinedData.reduce((sum, item) => sum + item.sales, 0);
  const totalPaid = combinedData.reduce((sum, item) => sum + item.paid, 0);
  const totalExpenses = combinedData.reduce((sum, item) => sum + item.expenses, 0);
  const outstandingBalance = totalSales - totalPaid;
  const profit = totalPaid - totalExpenses;
  const totalTransactions = combinedData.reduce((sum, item) => sum + item.transactionCount, 0);
  const formatDate = (date) => {
    const dateObj = new Date(date);
    switch (timeRange) {
      case 'year': return format(dateObj, 'yyyy-MM');
      case 'month': return format(dateObj, 'dd MMM', { locale: fr });
      case 'week': return format(dateObj, 'EEE dd', { locale: fr });
      case 'day': return format(dateObj, 'HH:mm');
      default: return format(dateObj, 'dd MMM', { locale: fr });
    }
  };

  const handleBarClick = (data, index) => {
    if (!data || !data.activePayload) return;

    const payload = data.activePayload[0]?.payload;
    if (!payload) return;

    const date = payload.date;
    setSelectedDate(date);

    const daySales = salesData.filter(sale =>
      format(new Date(sale.createdAt), 'yyyy-MM-dd') === date
    );

    const dayExpenses = expensesData.filter(expense =>
      format(new Date(expense.createdAt), 'yyyy-MM-dd') === date
    );

    const dayPayments = paymentsData.filter(payment => {
      if (!payment?.paymentDate) return false;
      const paymentDate = new Date(payment.paymentDate);
      if (Number.isNaN(paymentDate.getTime())) return false;
      return format(paymentDate, 'yyyy-MM-dd') === date;
    });

    setDayDetails({
      sales: daySales,
      expenses: dayExpenses,
      payments: dayPayments
    });

    setIsModalOpen(true);
  };

  const resetExportFilters = () => {
    setExportStartDate('');
    setExportEndDate('');
  };

  const exportToExcel = () => {
    if (exportStartDate && exportEndDate) {
      const start = new Date(`${exportStartDate}T00:00:00`);
      const end = new Date(`${exportEndDate}T23:59:59.999`);

      if (start > end) {
        alert('La date de début doit être antérieure à la date de fin');
        return;
      }
    }

    const startBoundary = exportStartDate ? new Date(`${exportStartDate}T00:00:00`) : null;
    const endBoundary = exportEndDate ? new Date(`${exportEndDate}T23:59:59.999`) : null;

    const filteredData = combinedData.filter(item => {
      const itemDate = new Date(item.date);
      if (Number.isNaN(itemDate.getTime())) return false;
      if (startBoundary && itemDate < startBoundary) return false;
      if (endBoundary && itemDate > endBoundary) return false;
      return true;
    });

    const exportData = filteredData.map(item => ({
      Date: format(new Date(item.date), 'dd/MM/yyyy'),
      'Chiffre d\'affaires': item.sales,
      'Montant payé': item.paid,
      Dépenses: item.expenses,
      Profit: item.paid - item.expenses,
      Transactions: item.transactionCount,
      'Produits vendus': item.productCount
    }));

    if (filteredData.length > 0) {
      const totals = filteredData.reduce((acc, item) => {
        acc.sales += item.sales || 0;
        acc.paid += item.paid || 0;
        acc.expenses += item.expenses || 0;
        acc.transactions += item.transactionCount || 0;
        acc.products += item.productCount || 0;
        return acc;
      }, { sales: 0, paid: 0, expenses: 0, transactions: 0, products: 0 });

      const totalProfit = totals.paid - totals.expenses;

      exportData.push({
        Date: 'TOTAL',
        'Chiffre d\'affaires': totals.sales,
        'Montant payé': totals.paid,
        Dépenses: totals.expenses,
        Profit: totalProfit,
        Transactions: totals.transactions,
        'Produits vendus': totals.products
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    if (exportData.length > 1) {
      const totalRowExcelIndex = exportData.length + 1;
      const totalColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      totalColumns.forEach(col => {
        const cellAddress = `${col}${totalRowExcelIndex}`;
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: 'FF1F2937' } },
            fill: { patternType: 'solid', fgColor: { rgb: 'FFFDE68A' } }
          };
        }
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, "Données du tableau de bord");

    let filename = `tableau-de-bord-${format(new Date(), 'yyyy-MM-dd')}`;
    if (exportStartDate || exportEndDate) {
      const startLabel = exportStartDate ? exportStartDate : 'debut';
      const endLabel = exportEndDate ? exportEndDate : 'fin';
      filename = `tableau-de-bord-${startLabel}-au-${endLabel}`;
    }

    XLSX.writeFile(wb, `${filename}.xlsx`);
    setShowExportMenu(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <div className="mt-4 text-gray-600">Chargement des données...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Tableau de Bord</h1>
            <p className="text-gray-600 mt-1">Aperçu des performances et des indicateurs clés</p>
            {!isAdmin && (
              <div className="mt-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
                Vue limitée - Utilisateur standard
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="pl-4 pr-10 py-2.5 border border-gray-300 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="day">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="year">Cette année</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {isAdmin && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(prev => !prev)}
                  className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-300 transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exporter
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 space-y-4 z-50">
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-gray-500 mb-1">Début personnalisé</label>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-gray-500 mb-1">Fin personnalisée</label>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="flex justify-between gap-2">
                      <button
                        type="button"
                        onClick={resetExportFilters}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Réinitialiser
                      </button>
                      <button
                        type="button"
                        onClick={exportToExcel}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Exporter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatisticsCard
            title="Chiffre d'Affaires"
            value={totalSales}
            color="bg-green-50"
            textColor="text-green-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
          <StatisticsCard
            title="Encaissements"
            value={totalPaid}
            color="bg-blue-50"
            textColor="text-blue-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
          <StatisticsCard
            title="Dépenses"
            value={totalExpenses}
            color="bg-red-50"
            textColor="text-red-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatisticsCard
            title="Profit Net"
            value={profit}
            color="bg-purple-50"
            textColor="text-purple-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>

        {/* Main Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Analyse Financière</h2>
            <div className="text-sm text-gray-500">
              {timeRange === 'day' && format(new Date(), 'dd MMMM yyyy', { locale: fr })}
              {timeRange === 'week' && `${format(startOfWeek(new Date(), { locale: fr }), 'dd MMM')} - ${format(endOfWeek(new Date(), { locale: fr }), 'dd MMM yyyy')}`}
              {timeRange === 'month' && format(new Date(), 'MMMM yyyy', { locale: fr })}
              {timeRange === 'year' && format(new Date(), 'yyyy')}
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={combinedData}
                onClick={handleBarClick}
                cursor="pointer"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={value => `${Math.round(value / 1000)}k`}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    backgroundColor: 'rgba(255,255,255,0.95)'
                  }}
                  formatter={(value, name) => [
                    `${value.toLocaleString('fr-FR')} CFA`,
                    name === 'sales' ? 'Ventes' :
                      name === 'paid' ? 'Encaissements' :
                        name === 'expenses' ? 'Dépenses' : name
                  ]}
                  labelFormatter={label => {
                    const date = new Date(label);
                    return timeRange === 'day'
                      ? format(date, 'HH:mm')
                      : format(date, 'dd MMM yyyy', { locale: fr });
                  }}
                />
                <Legend
                  iconSize={12}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                  formatter={(value) => (
                    <span className="text-gray-600">
                      {value === 'sales' ? 'Ventes' :
                        value === 'paid' ? 'Encaissements' :
                          value === 'expenses' ? 'Dépenses' : value}
                    </span>
                  )}
                />
                <Bar
                  dataKey="sales"
                  name="Ventes"
                  fill="#34C759"
                  radius={[4, 4, 0, 0]}
                  barSize={timeRange === 'day' ? 40 : 20}
                />
                <Bar
                  dataKey="paid"
                  name="Encaissements"
                  fill="#007AFF"
                  radius={4}
                  barSize={timeRange === 'day' ? 40 : 20}
                />
                <Bar
                  dataKey="expenses"
                  name="Dépenses"
                  fill="#FF3B30"
                  radius={[4, 4, 0, 0]}
                  barSize={timeRange === 'day' ? 40 : 20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Metrics - Seulement pour les admins */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Analyse des Bénéfices */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-lg">
                  <PieChartIcon size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Analyse des Bénéfices</h2>
                  <p className="text-sm text-gray-600">Performance financière détaillée</p>
                </div>
              </div>
              
              {(() => {
                const profitMetrics = calculateProfitMetrics(salesData, expensesData, paymentsData);
                const trends = analyzeProfitTrends(combinedData);
                const performance = getPerformanceCategory(profitMetrics.profitMargin);
                
                return (
                  <div className="space-y-4">
                    <ProfitAnalysisCard
                      title="Bénéfice Brut"
                      value={`${Math.round(profitMetrics.grossProfit).toLocaleString()} CFA`}
                      change={trends.dailyGrowth}
                      trend={trends.dailyGrowth >= 0 ? 'up' : 'down'}
                      description="Encaissements - Dépenses"
                      color="green"
                    />
                    
                    <ProfitAnalysisCard
                      title="Marge Commerciale"
                      value={`${profitMetrics.profitMargin.toFixed(1)}%`}
                      change={trends.weeklyGrowth}
                      trend={performance.trend}
                      description={`Performance: ${performance.category}`}
                      color={performance.color}
                    />
                    
                    <ProfitAnalysisCard
                      title="ROI Opérationnel"
                      value={`${profitMetrics.roi.toFixed(1)}%`}
                      change={trends.monthlyGrowth}
                      trend={profitMetrics.roi >= 20 ? 'up' : 'stable'}
                      description="Retour sur investissement"
                      color="purple"
                    />
                    
                    <ProfitAnalysisCard
                      title="Efficacité"
                      value={`${profitMetrics.operationalEfficiency.toFixed(1)}%`}
                      description="Rendement opérationnel"
                      color="blue"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Indicateurs Clés */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-2 rounded-lg">
                  <Target size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Indicateurs Clés</h2>
                  <p className="text-sm text-gray-600">Métriques de performance</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <KeyMetric
                  title="Panier Moyen"
                  value={totalTransactions > 0 ? `${Math.round(totalSales / totalTransactions).toLocaleString()} CFA` : 'N/A'}
                  icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
                <KeyMetric
                  title="Taux d'Encaissement"
                  value={totalSales > 0 ? `${((totalPaid / totalSales) * 100).toFixed(1)}%` : 'N/A'}
                  icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
                <KeyMetric
                  title="Solde Restant"
                  value={`${outstandingBalance.toLocaleString()} CFA`}
                  icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <KeyMetric
                  title="Marge Nette"
                  value={totalSales > 0 ? `${((profit / totalSales) * 100).toFixed(1)}%` : 'N/A'}
                  icon="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </div>
            </div>

            {/* Analyse des Performances */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Analyse des Performances</h2>
              
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-100 border border-green-200">
                  <h3 className="font-medium text-green-800 mb-2">Ventes Complétées</h3>
                  <div className="text-2xl font-semibold text-green-900">{salesStatusData.completed.count}</div>
                  <div className="text-sm text-green-700 mt-1">
                    {salesStatusData.completed.totalAmount.toLocaleString()} CFA
                  </div>
                </div>
                
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-100 border border-blue-200">
                  <h3 className="font-medium text-blue-800 mb-2">Paiements Partiels</h3>
                  <div className="text-2xl font-semibold text-blue-900">{salesStatusData.partially_paid.count}</div>
                  <div className="text-sm text-blue-700 mt-1">
                    {salesStatusData.partially_paid.totalAmount.toLocaleString()} CFA
                  </div>
                </div>
                
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-violet-100 border border-purple-200">
                  <h3 className="font-medium text-purple-800 mb-2">Encaissements Totaux</h3>
                  <div className="text-2xl font-semibold text-purple-900">
                    {paymentAnalysis.totalPayments.toLocaleString()} CFA
                  </div>
                </div>
              </div>

              {/* Graphique de répartition des bénéfices */}
              <div className="p-4 rounded-xl border border-gray-200">
                <h3 className="font-medium text-gray-700 mb-4">Répartition des Revenus</h3>
                {(() => {
                  const profitMetrics = calculateProfitMetrics(salesData, expensesData, paymentsData);
                  const revenueData = [
                    { name: 'Bénéfice Net', value: Math.max(0, profitMetrics.netProfit), color: '#10B981' },
                    { name: 'Dépenses', value: profitMetrics.totalExpenses, color: '#EF4444' },
                    { name: 'En Attente', value: Math.max(0, profitMetrics.totalRevenue - profitMetrics.totalPayments), color: '#F59E0B' }
                  ].filter(item => item.value > 0);
                  
                  return revenueData.length > 0 ? (
                    <>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={revenueData}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={50}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {revenueData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => [`${Number(value).toLocaleString()} CFA`, 'Montant']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 space-y-2">
                        {revenueData.map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <div className="flex items-center">
                              <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-medium">{item.name}</span>
                            </div>
                            <span>{item.value.toLocaleString()} CFA</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-gray-500">
                      Aucune donnée de revenus
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Reminders Section - Seulement pour les admins */}
        {isAdmin && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Overdue Reminders */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-600">
                  Rappels en Retard ({overdueReminders.length})
                </h3>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {overdueReminders.length > 0 ? (
                  overdueReminders.map((sale) => (
                    <Link
                      key={sale._id}
                      to={`/sales/${sale._id}`}
                      className="block p-4 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-red-900">
                            {sale.client?.name || 'Client inconnu'}
                          </div>
                          <div className="text-sm text-red-700 mb-2">
                            Solde: {sale.balance?.toLocaleString()} CFA
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full">
                            EN RETARD
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucun rappel en retard</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Reminders */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-orange-600">
                  Rappels à Venir ({upcomingReminders.length})
                </h3>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {upcomingReminders.length > 0 ? (
                  upcomingReminders.map((sale) => {
                    const reminderDateRaw = sale.paymentReminder?.reminderDate;
                    const reminderDate = reminderDateRaw ? new Date(reminderDateRaw) : null;
                    const hasValidReminderDate = reminderDate && !Number.isNaN(reminderDate.getTime());
                    const isToday = hasValidReminderDate && new Date().toDateString() === reminderDate.toDateString();

                    return (
                      <Link
                        key={sale._id}
                        to={`/sales/${sale._id}`}
                        className="block p-4 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-orange-900">
                              {sale.client?.name || 'Client inconnu'}
                            </div>
                            <div className="text-sm text-orange-700 mb-2">
                              Solde: {sale.balance?.toLocaleString()} CFA
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-xs px-2 py-1 rounded-full ${
                                isToday ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'
                              }`}
                            >
                              {isToday ? "AUJOURD'HUI" : "À VENIR"}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucun rappel programmé</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <div className="mt-4 text-gray-600">Chargement des détails...</div>
            </div>
          </div>
        }>
          <DayDetailsModal
            date={selectedDate}
            sales={dayDetails.sales}
            expenses={dayDetails.expenses}
            payments={dayDetails.payments}
            onClose={() => setIsModalOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

const KeyMetric = ({ title, value, icon }) => (
  <div className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
    <div className="flex items-center gap-3 mb-2">
      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <div className="text-sm font-medium text-gray-600">{title}</div>
    </div>
    <div className="text-xl font-semibold text-gray-800">{value}</div>
  </div>
);

export default Dashboard;
