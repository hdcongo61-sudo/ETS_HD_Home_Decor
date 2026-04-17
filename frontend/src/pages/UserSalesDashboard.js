import React, { useContext, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, endOfDay, startOfDay, startOfYear, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import AppLoader from '../components/AppLoader';
import {
  calculateSaleProfit,
  calculateSaleTotals,
  getPaymentStructureKey,
  getSaleTypeText,
  getStatusClass,
  getStatusText,
  parseDateSafely,
} from '../utils/saleUtils';

const RANGE_OPTIONS = [
  { value: '30days', label: '30 jours' },
  { value: '90days', label: '90 jours' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Dates' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'completed', label: 'Payées' },
  { value: 'partially_paid', label: 'Partielles' },
  { value: 'pending', label: 'En attente' },
  { value: 'cancelled', label: 'Annulées' },
];

const SALE_TYPE_OPTIONS = [
  { value: 'all', label: 'Tous types' },
  { value: 'retail', label: 'Vente normale' },
  { value: 'wholesale', label: 'Vente en gros' },
];

const PAYMENT_STRUCTURE_OPTIONS = [
  { value: 'all', label: 'Tous paiements' },
  { value: 'full_payment', label: 'Paiement unique' },
  { value: 'multiple_payments', label: 'Paiements multiples' },
  { value: 'pending_payment', label: 'Encore ouverts' },
];

const HISTORY_VIEW_OPTIONS = [
  { value: 'all', label: 'Toutes les cartes' },
  { value: 'outstanding', label: 'Reste à encaisser' },
  { value: 'wholesale', label: 'Vente en gros' },
  { value: 'multiple_payments', label: 'Paiements multiples' },
  { value: 'high_profit', label: 'Plus rentables' },
];

const HISTORY_SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'oldest', label: 'Plus anciennes' },
  { value: 'amount_desc', label: 'Montant décroissant' },
  { value: 'paid_desc', label: 'Encaissement décroissant' },
  { value: 'profit_desc', label: 'Bénéfice décroissant' },
];

const PAYMENT_STRUCTURE_META = {
  full_payment: {
    label: 'Paiement unique',
    accent: 'bg-emerald-100 text-emerald-700',
    chartColor: '#059669',
  },
  multiple_payments: {
    label: 'Paiements multiples',
    accent: 'bg-sky-100 text-sky-700',
    chartColor: '#0284c7',
  },
  pending_payment: {
    label: 'Paiement incomplet',
    accent: 'bg-amber-100 text-amber-700',
    chartColor: '#d97706',
  },
};

const PAYMENT_METHOD_COLORS = ['#0f766e', '#0284c7', '#ea580c', '#7c3aed', '#dc2626'];

const safeNumber = (value) => Number(value) || 0;

const formatCFA = (amount) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: 'code',
  })
    .format(safeNumber(amount))
    .replace(/\s?XOF/g, ' CFA');

const formatCompactNumber = (value) =>
  new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(safeNumber(value));

const formatPercent = (value) => `${safeNumber(value).toFixed(1)}%`;

const formatDateLabel = (value, pattern = 'dd MMM yyyy') => {
  const parsed = parseDateSafely(value);
  return parsed ? format(parsed, pattern, { locale: fr }) : 'Date indisponible';
};

const formatDateTimeLabel = (value) => {
  const parsed = parseDateSafely(value);
  return parsed ? format(parsed, 'dd MMM yyyy • HH:mm', { locale: fr }) : 'Date indisponible';
};

const getDateRange = (rangePreset, startDate, endDate) => {
  const now = new Date();
  const todayEnd = endOfDay(now);

  switch (rangePreset) {
    case '30days':
      return { start: startOfDay(subDays(now, 29)), end: todayEnd };
    case '90days':
      return { start: startOfDay(subDays(now, 89)), end: todayEnd };
    case 'year':
      return { start: startOfYear(now), end: todayEnd };
    case 'custom': {
      const start = startDate ? startOfDay(new Date(startDate)) : null;
      const end = endDate ? endOfDay(new Date(endDate)) : null;
      return { start, end };
    }
    case 'all':
    default:
      return { start: null, end: null };
  }
};

const sanitizeFilePart = (value) =>
  (value || 'utilisateur')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'utilisateur';

const getRangeSummary = (rangePreset, startDate, endDate) => {
  const { start, end } = getDateRange(rangePreset, startDate, endDate);

  if (rangePreset === 'custom') {
    if (start && end) {
      return `Du ${formatDateLabel(start)} au ${formatDateLabel(end)}`;
    }
    if (start) {
      return `À partir du ${formatDateLabel(start)}`;
    }
    if (end) {
      return `Jusqu'au ${formatDateLabel(end)}`;
    }
    return 'Dates libres';
  }

  const option = RANGE_OPTIONS.find((item) => item.value === rangePreset);
  if (option?.label) {
    return option.label;
  }

  if (start || end) {
    return `${start ? formatDateLabel(start) : 'Début'} - ${end ? formatDateLabel(end) : 'Fin'}`;
  }

  return 'Toutes les dates';
};

const buildTrendData = (sales, rangePreset, dateRange) => {
  if (!sales.length) {
    return { data: [], granularity: 'jour' };
  }

  const hasBoundedRange = dateRange.start && dateRange.end;
  const daysSpan = hasBoundedRange
    ? Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000))
    : null;
  const granularity = rangePreset === 'all' || rangePreset === 'year' || (daysSpan && daysSpan > 120) ? 'month' : 'day';
  const bucketMap = new Map();

  sales.forEach((sale) => {
    const date = sale.saleDateObject;
    const key = granularity === 'month' ? format(date, 'yyyy-MM') : format(date, 'yyyy-MM-dd');
    const current = bucketMap.get(key) || { revenue: 0, paid: 0, label: '' };
    current.revenue += sale.totalAmount;
    current.paid += sale.totalPaid;
    current.label =
      granularity === 'month'
        ? format(date, 'MMM yyyy', { locale: fr })
        : format(date, 'dd MMM', { locale: fr });
    bucketMap.set(key, current);
  });

  return {
    granularity: granularity === 'month' ? 'mois' : 'jour',
    data: [...bucketMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({
        key,
        label: value.label,
        revenue: value.revenue,
        paid: value.paid,
      })),
  };
};

const buildFilterEntries = ({ rangePreset, startDate, endDate, search, status, saleType, paymentStructure }) => [
  ['Période', getRangeSummary(rangePreset, startDate, endDate)],
  ['Recherche', search?.trim() || 'Toutes les ventes'],
  ['Statut', STATUS_OPTIONS.find((item) => item.value === status)?.label || 'Tous statuts'],
  ['Type', SALE_TYPE_OPTIONS.find((item) => item.value === saleType)?.label || 'Tous types'],
  [
    'Structure de paiement',
    PAYMENT_STRUCTURE_OPTIONS.find((item) => item.value === paymentStructure)?.label || 'Tous paiements',
  ],
];

const DashboardStatCard = ({ label, value, helper, tone = 'slate' }) => {
  const toneClass = {
    slate: 'from-slate-900 via-slate-800 to-slate-700 text-white',
    teal: 'from-teal-600 via-emerald-600 to-green-500 text-white',
    amber: 'from-amber-400 via-orange-400 to-red-400 text-slate-950',
    sky: 'from-sky-500 via-cyan-500 to-teal-400 text-white',
  }[tone];

  return (
    <div className={`rounded-3xl bg-gradient-to-br p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm opacity-85">{helper}</p>
    </div>
  );
};

const FilterChip = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
      active
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
    }`}
  >
    {label}
  </button>
);

const MiniInsightCard = ({ title, value, helper, accent = 'text-slate-900' }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm text-slate-500">{title}</p>
    <p className={`mt-2 text-xl font-semibold ${accent}`}>{value}</p>
    <p className="mt-1 text-sm text-slate-500">{helper}</p>
  </div>
);

const SaleBadge = ({ className, label }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${className}`}>{label}</span>
);

const EmptyState = ({ title, helper, action }) => (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm text-slate-500">{helper}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

const UserSalesDashboard = () => {
  const { userId } = useParams();
  const { auth } = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangePreset, setRangePreset] = useState('90days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [saleType, setSaleType] = useState('all');
  const [paymentStructure, setPaymentStructure] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyView, setHistoryView] = useState('all');
  const [historySort, setHistorySort] = useState('recent');
  const [exporting, setExporting] = useState('');

  const deferredSearch = useDeferredValue(search);
  const deferredHistorySearch = useDeferredValue(historySearch);
  const isAdmin = Boolean(auth?.isAdmin || auth?.user?.isAdmin);
  const isOwner = Boolean(auth?.user?._id && auth.user._id === userId);
  const isUnauthorized = !isAdmin && !isOwner;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/sales/user/${userId}`);
        const payload = response?.data || {};
        setUser(payload.user || null);
        setSales(Array.isArray(payload.sales) ? payload.sales : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Échec du chargement des statistiques utilisateur');
      } finally {
        setLoading(false);
      }
    };

    if (auth?.isLoading) {
      return;
    }

    if (isAdmin || isOwner) {
      fetchData();
    }
  }, [auth?.isLoading, isAdmin, isOwner, userId]);

  const normalizedSales = useMemo(
    () =>
      (Array.isArray(sales) ? sales : [])
        .map((sale) => {
          const totalAmount = safeNumber(sale?.totalAmount);
          const { totalPaid, balance } = calculateSaleTotals(sale);
          const profit = calculateSaleProfit(sale);
          const products = Array.isArray(sale?.products) ? sale.products : [];
          const productNames = products
            .map((item) => item?.product?.name || item?.productName || null)
            .filter(Boolean);
          const containers = [...new Set(products.map((item) => item?.product?.container).filter(Boolean))];
          const itemsCount = products.reduce((sum, item) => sum + safeNumber(item?.quantity), 0);
          const payments = Array.isArray(sale?.payments) ? sale.payments : [];
          const paymentMethods = [...new Set(payments.map((payment) => payment?.method || 'Non renseigné'))];
          const saleDateObject =
            parseDateSafely(sale?.saleDate) ||
            parseDateSafely(sale?.updatedAt) ||
            parseDateSafely(sale?.createdAt) ||
            new Date();

          return {
            ...sale,
            saleDateObject,
            totalAmount,
            totalPaid: safeNumber(totalPaid),
            balance: Math.max(safeNumber(balance), 0),
            profit,
            itemsCount,
            productNames,
            containers,
            paymentMethods,
            paymentStructure: getPaymentStructureKey(sale),
            clientName: sale?.client?.name || 'Client comptoir',
          };
        })
        .sort((left, right) => right.saleDateObject.getTime() - left.saleDateObject.getTime()),
    [sales]
  );

  const activeDateRange = useMemo(
    () => getDateRange(rangePreset, startDate, endDate),
    [rangePreset, startDate, endDate]
  );

  const filteredSales = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    return normalizedSales.filter((sale) => {
      const saleTime = sale.saleDateObject.getTime();

      if (activeDateRange.start && saleTime < activeDateRange.start.getTime()) {
        return false;
      }

      if (activeDateRange.end && saleTime > activeDateRange.end.getTime()) {
        return false;
      }

      if (status !== 'all' && sale.status !== status) {
        return false;
      }

      if (saleType !== 'all') {
        const targetType = sale.saleType === 'wholesale' ? 'wholesale' : 'retail';
        if (targetType !== saleType) {
          return false;
        }
      }

      if (paymentStructure !== 'all' && sale.paymentStructure !== paymentStructure) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        sale.clientName,
        sale.productNames.join(' '),
        sale.containers.join(' '),
        sale.paymentMethods.join(' '),
        sale._id,
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [activeDateRange.end, activeDateRange.start, deferredSearch, normalizedSales, paymentStructure, saleType, status]);

  const analytics = useMemo(() => {
    const initial = {
      totalSales: filteredSales.length,
      totalAmount: 0,
      totalPaid: 0,
      outstandingAmount: 0,
      totalProfit: 0,
      totalItems: 0,
      totalPayments: 0,
      activeDays: 0,
      averageTicket: 0,
      averageItemsPerSale: 0,
      collectionRate: 0,
      marginRate: 0,
      wholesale: { count: 0, amount: 0 },
      fullPayment: { count: 0, amount: 0 },
      multiplePayments: { count: 0, amount: 0 },
      pendingPayments: { count: 0, amount: 0 },
      bestClient: null,
      topProduct: null,
      bestMonth: null,
      busiestDay: null,
      favoritePaymentMethod: null,
      largestSale: null,
      statusBreakdown: [],
      paymentStructureBreakdown: [],
      paymentMethodBreakdown: [],
      topClients: [],
      topProducts: [],
    };

    if (!filteredSales.length) {
      return initial;
    }

    const clientMap = new Map();
    const productMap = new Map();
    const monthMap = new Map();
    const dayMap = new Map();
    const paymentMethodMap = new Map();
    const statusMap = new Map();
    const paymentStructureMap = new Map();

    filteredSales.forEach((sale) => {
      initial.totalAmount += sale.totalAmount;
      initial.totalPaid += sale.totalPaid;
      initial.outstandingAmount += sale.balance;
      initial.totalProfit += sale.profit;
      initial.totalItems += sale.itemsCount;
      initial.totalPayments += Array.isArray(sale.payments) ? sale.payments.length : 0;

      if (sale.saleType === 'wholesale') {
        initial.wholesale.count += 1;
        initial.wholesale.amount += sale.totalAmount;
      }

      if (sale.paymentStructure === 'full_payment') {
        initial.fullPayment.count += 1;
        initial.fullPayment.amount += sale.totalAmount;
      } else if (sale.paymentStructure === 'multiple_payments') {
        initial.multiplePayments.count += 1;
        initial.multiplePayments.amount += sale.totalAmount;
      } else {
        initial.pendingPayments.count += 1;
        initial.pendingPayments.amount += sale.totalAmount;
      }

      const clientEntry = clientMap.get(sale.clientName) || { name: sale.clientName, sales: 0, amount: 0 };
      clientEntry.sales += 1;
      clientEntry.amount += sale.totalAmount;
      clientMap.set(sale.clientName, clientEntry);

      (Array.isArray(sale.products) ? sale.products : []).forEach((item) => {
        const productName = item?.product?.name || item?.productName;
        if (!productName) {
          return;
        }

        const quantity = safeNumber(item?.quantity) || 1;
        const productEntry = productMap.get(productName) || { name: productName, quantity: 0, amount: 0 };
        productEntry.quantity += quantity;
        productEntry.amount += quantity * safeNumber(item?.priceAtSale);
        productMap.set(productName, productEntry);
      });

      const monthKey = format(sale.saleDateObject, 'yyyy-MM');
      const monthEntry = monthMap.get(monthKey) || {
        label: format(sale.saleDateObject, 'MMMM yyyy', { locale: fr }),
        amount: 0,
      };
      monthEntry.amount += sale.totalAmount;
      monthMap.set(monthKey, monthEntry);

      const dayKey = format(sale.saleDateObject, 'yyyy-MM-dd');
      const dayEntry = dayMap.get(dayKey) || {
        label: format(sale.saleDateObject, 'dd MMM yyyy', { locale: fr }),
        amount: 0,
        sales: 0,
      };
      dayEntry.amount += sale.totalAmount;
      dayEntry.sales += 1;
      dayMap.set(dayKey, dayEntry);

      const normalizedStatus = sale.status || 'pending';
      statusMap.set(normalizedStatus, (statusMap.get(normalizedStatus) || 0) + 1);
      paymentStructureMap.set(sale.paymentStructure, (paymentStructureMap.get(sale.paymentStructure) || 0) + 1);

      (Array.isArray(sale.payments) ? sale.payments : []).forEach((payment) => {
        const method = payment?.method || 'Non renseigné';
        paymentMethodMap.set(method, (paymentMethodMap.get(method) || 0) + safeNumber(payment?.amount));
      });

      if (!initial.largestSale || sale.totalAmount > initial.largestSale.totalAmount) {
        initial.largestSale = sale;
      }
    });

    initial.activeDays = dayMap.size;
    initial.averageTicket = initial.totalAmount / filteredSales.length;
    initial.averageItemsPerSale = initial.totalItems / filteredSales.length;
    initial.collectionRate = initial.totalAmount ? (initial.totalPaid / initial.totalAmount) * 100 : 0;
    initial.marginRate = initial.totalAmount ? (initial.totalProfit / initial.totalAmount) * 100 : 0;
    initial.bestClient = [...clientMap.values()].sort((left, right) => right.amount - left.amount)[0] || null;
    initial.topProduct = [...productMap.values()].sort((left, right) => right.quantity - left.quantity)[0] || null;
    initial.bestMonth = [...monthMap.values()].sort((left, right) => right.amount - left.amount)[0] || null;
    initial.busiestDay =
      [...dayMap.values()].sort((left, right) => right.amount - left.amount || right.sales - left.sales)[0] || null;
    initial.favoritePaymentMethod =
      [...paymentMethodMap.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([method, amount]) => ({ method, amount }))[0] || null;
    initial.topClients = [...clientMap.values()].sort((left, right) => right.amount - left.amount).slice(0, 5);
    initial.topProducts = [...productMap.values()].sort((left, right) => right.quantity - left.quantity).slice(0, 5);
    initial.statusBreakdown = [...statusMap.entries()].map(([key, count]) => ({
      key,
      label: getStatusText(key),
      count,
    }));
    initial.paymentStructureBreakdown = [...paymentStructureMap.entries()].map(([key, count]) => ({
      key,
      label: PAYMENT_STRUCTURE_META[key]?.label || key,
      count,
      color: PAYMENT_STRUCTURE_META[key]?.chartColor || '#64748b',
    }));
    initial.paymentMethodBreakdown = [...paymentMethodMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([method, amount], index) => ({
        method,
        amount,
        color: PAYMENT_METHOD_COLORS[index % PAYMENT_METHOD_COLORS.length],
      }));

    return initial;
  }, [filteredSales]);

  const trendChart = useMemo(
    () => buildTrendData(filteredSales, rangePreset, activeDateRange),
    [activeDateRange, filteredSales, rangePreset]
  );

  const historySales = useMemo(() => {
    const query = deferredHistorySearch.trim().toLowerCase();

    const filteredHistory = filteredSales.filter((sale) => {
      if (historyView === 'outstanding' && sale.balance <= 0) {
        return false;
      }

      if (historyView === 'wholesale' && sale.saleType !== 'wholesale') {
        return false;
      }

      if (historyView === 'multiple_payments' && sale.paymentStructure !== 'multiple_payments') {
        return false;
      }

      if (historyView === 'high_profit' && sale.profit <= 0) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        sale.clientName,
        sale.productNames.join(' '),
        sale.containers.join(' '),
        sale.paymentMethods.join(' '),
        sale._id,
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });

    return [...filteredHistory].sort((left, right) => {
      switch (historySort) {
        case 'oldest':
          return left.saleDateObject.getTime() - right.saleDateObject.getTime();
        case 'amount_desc':
          return right.totalAmount - left.totalAmount;
        case 'paid_desc':
          return right.totalPaid - left.totalPaid;
        case 'profit_desc':
          return right.profit - left.profit;
        case 'recent':
        default:
          return right.saleDateObject.getTime() - left.saleDateObject.getTime();
      }
    });
  }, [deferredHistorySearch, filteredSales, historySort, historyView]);

  const filterEntries = useMemo(
    () => buildFilterEntries({ rangePreset, startDate, endDate, search, status, saleType, paymentStructure }),
    [endDate, paymentStructure, rangePreset, saleType, search, startDate, status]
  );

  const resetFilters = () => {
    setRangePreset('90days');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setStatus('all');
    setSaleType('all');
    setPaymentStructure('all');
    setHistorySearch('');
    setHistoryView('all');
    setHistorySort('recent');
  };

  const exportFileBase = useMemo(() => {
    const dateLabel = format(new Date(), 'yyyyMMdd');
    return `ventes-${sanitizeFilePart(user?.name)}-${dateLabel}`;
  }, [user?.name]);

  const handleExportExcel = async () => {
    if (!filteredSales.length) {
      return;
    }

    try {
      setExporting('excel');
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const statsSheet = XLSX.utils.aoa_to_sheet([
        ['Utilisateur', user?.name || 'Utilisateur'],
        ['Email', user?.email || ''],
        ['Ventes filtrées', analytics.totalSales],
        ['Chiffre d’affaires', analytics.totalAmount],
        ['Encaissements', analytics.totalPaid],
        ['Reste à encaisser', analytics.outstandingAmount],
        ['Bénéfice', analytics.totalProfit],
        ['Ventes en gros', analytics.wholesale.count],
        ['Paiement unique', analytics.fullPayment.count],
        ['Paiements multiples', analytics.multiplePayments.count],
      ]);

      const filtersSheet = XLSX.utils.aoa_to_sheet(filterEntries);
      const salesSheet = XLSX.utils.json_to_sheet(
        filteredSales.map((sale) => ({
          Date: formatDateLabel(sale.saleDateObject),
          Client: sale.clientName,
          Produits: sale.productNames.join(', '),
          Conteneurs: sale.containers.join(', '),
          Type: getSaleTypeText(sale.saleType),
          Statut: getStatusText(sale.status),
          'Structure paiement': PAYMENT_STRUCTURE_META[sale.paymentStructure]?.label || sale.paymentStructure,
          'Montant total': sale.totalAmount,
          Encaisse: sale.totalPaid,
          Reste: sale.balance,
          Benefice: sale.profit,
          'Nb articles': sale.itemsCount,
          'Methodes paiement': sale.paymentMethods.join(', '),
        }))
      );

      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistiques');
      XLSX.utils.book_append_sheet(workbook, filtersSheet, 'Filtres');
      XLSX.utils.book_append_sheet(workbook, salesSheet, 'Ventes');
      XLSX.writeFile(workbook, `${exportFileBase}.xlsx`);
    } finally {
      setExporting('');
    }
  };

  const handleExportPdf = async () => {
    if (!filteredSales.length) {
      return;
    }

    try {
      setExporting('pdf');
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default?.jsPDF || jsPDFModule.default;
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(18);
      doc.text('Statistiques utilisateur', 40, 42);
      doc.setFontSize(11);
      doc.text(`${user?.name || 'Utilisateur'} • ${user?.email || ''}`, 40, 62);

      let currentY = 86;
      filterEntries.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`, 40, currentY);
        currentY += 16;
      });

      autoTable(doc, {
        startY: currentY + 8,
        head: [['KPI', 'Valeur']],
        body: [
          ['Ventes filtrées', `${analytics.totalSales}`],
          ['Chiffre d’affaires', formatCFA(analytics.totalAmount)],
          ['Encaissements', formatCFA(analytics.totalPaid)],
          ['Reste à encaisser', formatCFA(analytics.outstandingAmount)],
          ['Bénéfice', formatCFA(analytics.totalProfit)],
          ['Ventes en gros', `${analytics.wholesale.count} (${formatCFA(analytics.wholesale.amount)})`],
          ['Paiement unique', `${analytics.fullPayment.count} (${formatCFA(analytics.fullPayment.amount)})`],
          [
            'Paiements multiples',
            `${analytics.multiplePayments.count} (${formatCFA(analytics.multiplePayments.amount)})`,
          ],
        ],
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [15, 23, 42] },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [[
          'Date',
          'Client',
          'Produits',
          'Type',
          'Statut',
          'Paiement',
          'Total',
          'Encaisse',
          'Reste',
        ]],
        body: filteredSales.map((sale) => [
          formatDateLabel(sale.saleDateObject),
          sale.clientName,
          sale.productNames.join(', '),
          getSaleTypeText(sale.saleType),
          getStatusText(sale.status),
          PAYMENT_STRUCTURE_META[sale.paymentStructure]?.label || sale.paymentStructure,
          formatCFA(sale.totalAmount),
          formatCFA(sale.totalPaid),
          formatCFA(sale.balance),
        ]),
        styles: { fontSize: 8, cellPadding: 5, valign: 'top' },
        headStyles: { fillColor: [15, 118, 110] },
        columnStyles: {
          2: { cellWidth: 170 },
        },
      });

      doc.save(`${exportFileBase}.pdf`);
    } finally {
      setExporting('');
    }
  };

  if (auth?.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <AppLoader fullScreen={false} text="Chargement..." />
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <EmptyState
          title="Accès non autorisé"
          helper="Cette page est réservée à l'administrateur ou au propriétaire du compte."
          action={
            <Link
              to="/"
              className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Retour à l'accueil
            </Link>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <AppLoader fullScreen={false} text="Chargement..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <EmptyState
          title="Chargement impossible"
          helper={error}
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Recharger
            </button>
          }
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <EmptyState
          title="Utilisateur introuvable"
          helper="Le profil demandé n'existe pas ou n'est plus disponible."
          action={
            <Link
              to={isAdmin ? '/users/stats' : '/profile'}
              className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Retour
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-900 text-white shadow-xl">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to={isAdmin ? '/users/stats' : '/profile'}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur"
              >
                <span aria-hidden="true">←</span>
                {isAdmin ? 'Retour aux utilisateurs' : 'Retour au profil'}
              </Link>
              <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-100">
                Dashboard commercial
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-emerald-200/80">Vue utilisateur</p>
                <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{user.name}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                  Toutes les statistiques, les insights commerciaux, les exportations et l'historique de ventes
                  suivent les filtres actifs ci-dessous. L'interface est pensée d'abord pour mobile puis s'étend en
                  cartes sur les grands écrans.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <p className="text-sm text-emerald-100/80">Email</p>
                    <p className="mt-2 text-sm font-medium text-white">{user.email || 'Non renseigné'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <p className="text-sm text-emerald-100/80">Dernière connexion</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatDateTimeLabel(user.lastLogin)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                    <p className="text-sm text-emerald-100/80">Inscrit le</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatDateLabel(user.createdAt)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <DashboardStatCard
                  label="Encaissement"
                  value={formatCFA(analytics.totalPaid)}
                  helper={`${formatPercent(analytics.collectionRate)} du chiffre d'affaires filtré`}
                  tone="teal"
                />
                <DashboardStatCard
                  label="Reste à encaisser"
                  value={formatCFA(analytics.outstandingAmount)}
                  helper={`${analytics.pendingPayments.count} vente(s) encore ouvertes`}
                  tone="amber"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Filtres et export</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Les statistiques, les graphiques et les exports PDF/Excel suivent uniquement les ventes filtrées.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={!filteredSales.length || exporting.length > 0}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting === 'pdf' ? 'Export PDF...' : 'Exporter PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={!filteredSales.length || exporting.length > 0}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting === 'excel' ? 'Export Excel...' : 'Exporter Excel'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  active={rangePreset === option.value}
                  label={option.label}
                  onClick={() => setRangePreset(option.value)}
                />
              ))}
            </div>

            {rangePreset === 'custom' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-600">
                  <span>Date de début</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-600">
                  <span>Date de fin</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm text-slate-600">
                <span>Recherche</span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Client, produit, conteneur..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span>Statut</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span>Type de vente</span>
                <select
                  value={saleType}
                  onChange={(event) => setSaleType(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {SALE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span>Structure de paiement</span>
                <select
                  value={paymentStructure}
                  onChange={(event) => setPaymentStructure(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {PAYMENT_STRUCTURE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                {filterEntries.map(([label, value]) => (
                  <span key={label} className="rounded-full bg-white px-3 py-1 shadow-sm">
                    <strong className="font-medium text-slate-900">{label}:</strong> {value}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Ventes filtrées"
            value={`${analytics.totalSales}`}
            helper={`${filteredSales.length} sur ${normalizedSales.length} vente(s)`}
            tone="slate"
          />
          <DashboardStatCard
            label="Chiffre d'affaires"
            value={formatCFA(analytics.totalAmount)}
            helper={`Ticket moyen ${formatCFA(analytics.averageTicket)}`}
            tone="teal"
          />
          <DashboardStatCard
            label="Bénéfice"
            value={formatCFA(analytics.totalProfit)}
            helper={`Marge moyenne ${formatPercent(analytics.marginRate)}`}
            tone="sky"
          />
          <DashboardStatCard
            label="Articles vendus"
            value={formatCompactNumber(analytics.totalItems)}
            helper={`${analytics.averageItemsPerSale.toFixed(1)} article(s) par vente`}
            tone="amber"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Performance commerciale</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chiffre d'affaires et encaissements par {trendChart.granularity}.
                </p>
              </div>
            </div>

            {trendChart.data.length ? (
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={formatCompactNumber} />
                    <RechartsTooltip
                      formatter={(value) => formatCFA(value)}
                      contentStyle={{ borderRadius: 16, borderColor: '#e2e8f0' }}
                    />
                    <Bar dataKey="revenue" radius={[10, 10, 0, 0]} fill="#0f766e" name="Chiffre d'affaires" />
                    <Bar dataKey="paid" radius={[10, 10, 0, 0]} fill="#0f172a" name="Encaissements" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="Aucune vente à tracer"
                  helper="Ajustez les filtres pour afficher une tendance commerciale."
                />
              </div>
            )}
          </div>

          <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-semibold text-slate-900">Structures de paiement</h2>
            <p className="mt-1 text-sm text-slate-500">
              Paiement unique, paiements multiples et ventes encore ouvertes.
            </p>

            {analytics.paymentStructureBreakdown.length ? (
              <>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.paymentStructureBreakdown}
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="label"
                      >
                        {analytics.paymentStructureBreakdown.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value, _name, item) => [`${value} vente(s)`, item.payload.label]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <MiniInsightCard
                    title="Paiement unique"
                    value={`${analytics.fullPayment.count}`}
                    helper={formatCFA(analytics.fullPayment.amount)}
                    accent="text-emerald-700"
                  />
                  <MiniInsightCard
                    title="Paiements multiples"
                    value={`${analytics.multiplePayments.count}`}
                    helper={formatCFA(analytics.multiplePayments.amount)}
                    accent="text-sky-700"
                  />
                  <MiniInsightCard
                    title="Encore ouverts"
                    value={`${analytics.pendingPayments.count}`}
                    helper={formatCFA(analytics.pendingPayments.amount)}
                    accent="text-amber-700"
                  />
                </div>
              </>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="Aucune structure de paiement"
                  helper="Aucune vente filtrée disponible pour la répartition."
                />
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <MiniInsightCard
            title="Vente en gros"
            value={`${analytics.wholesale.count}`}
            helper={`${formatCFA(analytics.wholesale.amount)} sur la sélection`}
            accent="text-fuchsia-700"
          />
          <MiniInsightCard
            title="Meilleur client"
            value={analytics.bestClient?.name || 'Aucun'}
            helper={analytics.bestClient ? formatCFA(analytics.bestClient.amount) : 'Pas encore de donnée'}
            accent="text-slate-900"
          />
          <MiniInsightCard
            title="Produit dominant"
            value={analytics.topProduct?.name || 'Aucun'}
            helper={
              analytics.topProduct
                ? `${analytics.topProduct.quantity} article(s) • ${formatCFA(analytics.topProduct.amount)}`
                : 'Pas encore de donnée'
            }
            accent="text-teal-700"
          />
          <MiniInsightCard
            title="Meilleur mois"
            value={analytics.bestMonth?.label || 'Aucun'}
            helper={analytics.bestMonth ? formatCFA(analytics.bestMonth.amount) : 'Pas encore de donnée'}
            accent="text-sky-700"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-semibold text-slate-900">Synthèse intelligente</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quelques signaux directement utiles pour piloter l'activité de cet utilisateur.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Méthode de paiement dominante</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {analytics.favoritePaymentMethod?.method || 'Aucune'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {analytics.favoritePaymentMethod ? formatCFA(analytics.favoritePaymentMethod.amount) : 'Aucune donnée'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Jour le plus fort</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{analytics.busiestDay?.label || 'Aucun'}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {analytics.busiestDay
                    ? `${formatCFA(analytics.busiestDay.amount)} • ${analytics.busiestDay.sales} vente(s)`
                    : 'Aucune donnée'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Plus grosse vente</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {analytics.largestSale ? formatCFA(analytics.largestSale.totalAmount) : 'Aucune'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {analytics.largestSale
                    ? `${analytics.largestSale.clientName} • ${formatDateLabel(analytics.largestSale.saleDateObject)}`
                    : 'Aucune donnée'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Rythme d'activité</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{analytics.activeDays} jour(s) actifs</p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatPercent(analytics.collectionRate)} de recouvrement • {analytics.totalPayments} paiement(s)
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-semibold text-slate-900">Top clients</h2>
              <div className="mt-4 space-y-3">
                {analytics.topClients.length ? (
                  analytics.topClients.map((client, index) => (
                    <div key={`${client.name}-${index}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{client.name}</p>
                        <p className="text-sm text-slate-500">{client.sales} vente(s)</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCFA(client.amount)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Aucun client sur la sélection.</p>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-semibold text-slate-900">Top produits</h2>
              <div className="mt-4 space-y-3">
                {analytics.topProducts.length ? (
                  analytics.topProducts.map((product, index) => (
                    <div
                      key={`${product.name}-${index}`}
                      className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-500">{product.quantity} article(s)</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCFA(product.amount)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Aucun produit sur la sélection.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Historique filtré</h2>
              <p className="mt-1 text-sm text-slate-500">
                {historySales.length} vente(s) affichée(s) sur {filteredSales.length} vente(s) déjà retenues par les
                filtres globaux. Chaque carte reprend les
                indicateurs utiles sans forcer le passage sur desktop.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <label className="space-y-2 text-sm text-slate-600">
              <span>Recherche dans l'historique</span>
              <input
                type="text"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Client, produit, conteneur..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span>Vue rapide</span>
              <select
                value={historyView}
                onChange={(event) => setHistoryView(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
              >
                {HISTORY_VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span>Trier par</span>
              <select
                value={historySort}
                onChange={(event) => setHistorySort(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
              >
                {HISTORY_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">
              <strong className="font-medium text-slate-900">Vue:</strong>{' '}
              {HISTORY_VIEW_OPTIONS.find((option) => option.value === historyView)?.label || 'Toutes les cartes'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              <strong className="font-medium text-slate-900">Tri:</strong>{' '}
              {HISTORY_SORT_OPTIONS.find((option) => option.value === historySort)?.label || 'Plus récentes'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              <strong className="font-medium text-slate-900">Recherche:</strong>{' '}
              {historySearch.trim() || 'Aucune'}
            </span>
          </div>

          {historySales.length ? (
            <div className="mt-5 grid gap-4">
              {historySales.map((sale) => (
                <article key={sale._id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <SaleBadge className={getStatusClass(sale.status)} label={getStatusText(sale.status)} />
                        <SaleBadge
                          className={sale.saleType === 'wholesale' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-cyan-100 text-cyan-700'}
                          label={getSaleTypeText(sale.saleType)}
                        />
                        <SaleBadge
                          className={PAYMENT_STRUCTURE_META[sale.paymentStructure]?.accent || 'bg-slate-100 text-slate-700'}
                          label={PAYMENT_STRUCTURE_META[sale.paymentStructure]?.label || sale.paymentStructure}
                        />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{sale.clientName}</h3>
                        <p className="text-sm text-slate-500">{formatDateTimeLabel(sale.saleDateObject)}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Produits</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {sale.productNames.length ? sale.productNames.join(', ') : 'Aucun produit'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Conteneurs / paiements</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {[...sale.containers, ...sale.paymentMethods].filter(Boolean).join(' • ') || 'Aucun détail'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[22rem]">
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-500">Montant total</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{formatCFA(sale.totalAmount)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-500">Encaisse</p>
                        <p className="mt-2 text-lg font-semibold text-emerald-700">{formatCFA(sale.totalPaid)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-500">Reste</p>
                        <p className="mt-2 text-lg font-semibold text-amber-700">{formatCFA(sale.balance)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-500">Bénéfice</p>
                        <p className="mt-2 text-lg font-semibold text-sky-700">{formatCFA(sale.profit)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="Aucune vente pour ce filtre d'historique"
                helper="Essayez une autre vue, retirez la recherche locale ou utilisez la réinitialisation."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearch('');
                      setHistoryView('all');
                      setHistorySort('recent');
                    }}
                    className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Réinitialiser l'historique
                  </button>
                }
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default UserSalesDashboard;
