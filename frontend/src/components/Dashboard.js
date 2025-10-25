// src/components/Dashboard.js
import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  lazy,
  Suspense,
  useCallback,
} from "react";
import {
  // Graphique financier composé
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  // Graphes section statistiques des ventes
  LineChart,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subYears,
} from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import api from "../services/api";
import AuthContext from "../context/AuthContext";
import {
  Loader2,
  DollarSign,
  TrendingDown,
  PieChart as PieIcon,
  Sun,
  Moon,
  CalendarDays,
  Coins,
  Truck,
  PackageCheck,
  Clock3,
  XCircle,
  ShoppingCart,
  TrendingUp,
  Package,
  Wand2,   // 🔹 lissage
  Download // 🔹 export stats ventes
} from "lucide-react";

import AnalyticsSection from "../components/AnalyticsSection";
import RemindersPanel from "../components/RemindersPanel";
import ExportModal from "../components/ExportModal";
import BusinessAnalyticsDashboard from "../components/BusinessAnalyticsDashboard";

const DayDetailsModal = lazy(() => import("./DayDetailsModal"));

const Dashboard = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);

  // ===== THEME =====
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // ===== RANGE + COMPARE (graphique financier) =====
  const [timeRange, setTimeRange] = useState("week"); // day|week|month|year
  const [compareMode, setCompareMode] = useState("none"); // none|prev-week|prev-month|prev-year

  // ===== DATA (courant) =====
  const [salesData, setSalesData] = useState([]);
  const [expensesData, setExpensesData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [combinedData, setCombinedData] = useState([]);

  // ===== DATA (comparaison) =====
  const [prevCombinedData, setPrevCombinedData] = useState([]);

  // ===== Delivery (utilisé dans l’encart du bloc Statistiques des ventes) =====
  const [deliveryStats, setDeliveryStats] = useState(null);

  // ===== Reminders / UI =====
  const [loading, setLoading] = useState(true);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ===== 🔹 STATISTIQUES DES VENTES (nouvelle section) =====
  const [salesStatsRange, setSalesStatsRange] = useState("30days"); // 7days|30days|90days|all
  const [salesStatsData, setSalesStatsData] = useState(null);
  // 🔹 Switch lissage (persisté)
  const [smoothTrend, setSmoothTrend] = useState(
    localStorage.getItem("smoothTrend") === "true"
  );
  useEffect(() => {
    localStorage.setItem("smoothTrend", String(smoothTrend));
  }, [smoothTrend]);
  // 🔹 Couleurs du Pie
  const SALES_PIE_COLORS = ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"];

  // ===== Helpers période =====
  const getDateRange = (range) => {
    const now = new Date();
    switch (range) {
      case "day":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return {
          start: startOfWeek(now, { locale: fr }),
          end: endOfWeek(now, { locale: fr }),
        };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const getPrevPeriod = (range, mode) => {
    if (mode === "prev-week") {
      const { start, end } = getDateRange("week");
      return { start: subWeeks(start, 1), end: subWeeks(end, 1) };
    }
    if (mode === "prev-month") {
      const { start, end } = getDateRange("month");
      return { start: subMonths(start, 1), end: subMonths(end, 1) };
    }
    if (mode === "prev-year") {
      const { start, end } = getDateRange("year");
      return { start: subYears(start, 1), end: subYears(end, 1) };
    }
    return null;
  };

  // Construit série (par jour) à partir de tableaux bruts
  const processCombinedData = (sales, expenses, payments) => {
    const map = {};
    const ensure = (d) =>
      (map[d] ||= { date: d, sales: 0, paid: 0, expenses: 0 });

    sales.forEach((s) => {
      const d = format(new Date(s.createdAt), "yyyy-MM-dd");
      ensure(d).sales += s.totalAmount || 0;
    });
    expenses.forEach((e) => {
      const d = format(new Date(e.createdAt), "yyyy-MM-dd");
      ensure(d).expenses += e.amount || 0;
    });
    payments.forEach((p) => {
      const dt = p?.paymentDate || p?.createdAt;
      if (!dt) return;
      const d = format(new Date(dt), "yyyy-MM-dd");
      ensure(d).paid += p.amount || 0;
    });

    return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // ===== FETCH: période courante =====
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange(timeRange);
      const [salesRes, expensesRes, paymentsRes, deliveryRes] = await Promise.all([
        api.get(
          `/sales/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
        ),
        api.get(
          `/expenses/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
        ),
        api.get(
          `/sales/payments/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
        ),
        api.get(`/sales/stats/delivery`),
      ]);
      setSalesData(salesRes.data || []);
      setExpensesData(expensesRes.data || []);
      setPaymentsData(paymentsRes.data || []);
      setDeliveryStats(deliveryRes.data || null);
      setCombinedData(
        processCombinedData(
          salesRes.data || [],
          expensesRes.data || [],
          paymentsRes.data || []
        )
      );
    } catch (e) {
      console.error("Erreur de chargement :", e);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // ===== FETCH: période comparée (manuelle) =====
  const fetchPrevData = useCallback(async () => {
    if (compareMode === "none") {
      setPrevCombinedData([]);
      return;
    }
    try {
      const prev = getPrevPeriod(timeRange, compareMode);
      if (!prev) {
        setPrevCombinedData([]);
        return;
      }
      const [salesRes, expensesRes, paymentsRes] = await Promise.all([
        api.get(
          `/sales/date-range?startDate=${prev.start.toISOString()}&endDate=${prev.end.toISOString()}`
        ),
        api.get(
          `/expenses/date-range?startDate=${prev.start.toISOString()}&endDate=${prev.end.toISOString()}`
        ),
        api.get(
          `/sales/payments/date-range?startDate=${prev.start.toISOString()}&endDate=${prev.end.toISOString()}`
        ),
      ]);
      const prevCombined = processCombinedData(
        salesRes.data || [],
        expensesRes.data || [],
        paymentsRes.data || []
      );
      setPrevCombinedData(prevCombined);
    } catch (e) {
      console.error("Erreur chargement période comparée :", e);
      setPrevCombinedData([]);
    }
  }, [compareMode, timeRange]);

  // ===== Reminders =====
  const fetchReminders = async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/sales/reminders/upcoming");
      setUpcomingReminders(response.data.upcoming || []);
      setOverdueReminders(response.data.overdue || []);
    } catch (err) {
      console.error("Erreur de rappels:", err);
    }
  };

  useEffect(() => {
    fetchData();
    if (isAdmin) fetchReminders();
  }, [timeRange, isAdmin, fetchData]);

  useEffect(() => {
    fetchPrevData();
  }, [fetchPrevData]);

  // ===== Aligne séries (courante vs comparée) pour le graphique financier =====
  const mergedForChart = useMemo(() => {
    if (!combinedData.length) return [];
    if (!prevCombinedData.length)
      return combinedData.map((d) => ({
        ...d,
        prevSales: null,
        prevProfit: null,
      }));

    const len = combinedData.length;
    const prevLen = prevCombinedData.length;
    return combinedData.map((d, i) => {
      const j = Math.min(
        Math.round((i / Math.max(1, len - 1)) * Math.max(0, prevLen - 1)),
        prevLen - 1
      );
      const prev = prevCombinedData[j] || {};
      const prevProfit = (prev.paid || 0) - (prev.expenses || 0);
      return {
        ...d,
        prevSales: prev.sales ?? null,
        prevProfit: prevProfit ?? null,
      };
    });
  }, [combinedData, prevCombinedData]);

  // ===== METRICS =====
  const totalSales = useMemo(
    () => combinedData.reduce((s, d) => s + d.sales, 0),
    [combinedData]
  );
  const totalPaid = useMemo(
    () => combinedData.reduce((s, d) => s + d.paid, 0),
    [combinedData]
  );
  const totalExpenses = useMemo(
    () => combinedData.reduce((s, d) => s + d.expenses, 0),
    [combinedData]
  );
  const profit = totalPaid - totalExpenses;

  // Tendances vs semaine précédente (simple)
  const prevWeek = getPrevPeriod("week", "prev-week");
  const prevWeekStats = useMemo(() => {
    if (!prevWeek) return { s: 0, p: 0, e: 0, pr: 0 };
    const prevSales = salesData
      .filter(
        (s) =>
          new Date(s.createdAt) >= prevWeek.start &&
          new Date(s.createdAt) <= prevWeek.end
      )
      .reduce((a, b) => a + (b.totalAmount || 0), 0);
    const prevPaid = paymentsData
      .filter((p) => {
        const dt = p.paymentDate || p.createdAt;
        return new Date(dt) >= prevWeek.start && new Date(dt) <= prevWeek.end;
      })
      .reduce((a, b) => a + (b.amount || 0), 0);
    const prevExp = expensesData
      .filter(
        (e) =>
          new Date(e.createdAt) >= prevWeek.start &&
          new Date(e.createdAt) <= prevWeek.end
      )
      .reduce((a, b) => a + (b.amount || 0), 0);
    return { s: prevSales, p: prevPaid, e: prevExp, pr: prevPaid - prevExp };
  }, [prevWeek, salesData, paymentsData, expensesData]);

  const pct = (cur, prev) => {
    if (!prev || prev === 0) return "+0%";
    const d = ((cur - prev) / prev) * 100;
    const sym = d >= 0 ? "+" : "−";
    return `${sym}${Math.abs(d).toFixed(1)}%`;
  };

  const salesTrend = pct(totalSales, prevWeekStats.s);
  const expenseTrend = pct(totalExpenses, prevWeekStats.e);
  const profitTrend = pct(profit, prevWeekStats.pr);

  // ===== EXPORT principal (tableau combiné) =====
  const exportToExcel = () => {
    const rows = combinedData.map((d) => ({
      Date: format(new Date(d.date), "dd/MM/yyyy"),
      Ventes: d.sales,
      Encaissements: d.paid,
      Dépenses: d.expenses,
      Profit: d.paid - d.expenses,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Données");
    XLSX.writeFile(wb, `dashboard-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    setShowExportMenu(false);
  };

  // ===== MODAL Jour =====
  const handleOpenDayDetails = (date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  // ===== 🔹 FETCH Statistiques des ventes (section condensée) =====
  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get(`/sales/dashboard-sale?range=${salesStatsRange}`);
        setSalesStatsData(res.data || null);
      } catch (e) {
        console.error("Erreur chargement statistiques des ventes:", e);
        setSalesStatsData(null);
      }
    };
    run();
  }, [salesStatsRange]);

  // ===== 🔹 Lissage de la tendance (moyenne mobile 3 points) =====
  const movingAverage = (arr, windowSize = 3) => {
    if (!arr || arr.length === 0) return [];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(arr.length, start + windowSize);
      const slice = arr.slice(start, end);
      const avg =
        slice.reduce((s, x) => s + (Number(x.total) || 0), 0) / slice.length;
      out.push({ ...arr[i], total: avg });
    }
    return out;
  };

  // ===== 🔹 Données transformées pour la section Statistiques des ventes =====
  const trendDataRaw = salesStatsData?.salesTrend || [];
  const trendDataDisplay = smoothTrend
    ? movingAverage(trendDataRaw, 3)
    : trendDataRaw;

  // 🔹 Pie: lire les méthodes du backend patché (map: method -> { totalAmount, percentage, count })
  const paymentPieData = useMemo(() => {
    const map = salesStatsData?.paymentMethods || {};
    const rows = Object.entries(map).map(([name, val]) => ({
      name: name || "Non spécifié",
      value: Number(val?.totalAmount || 0),
      percentage: Number(val?.percentage || 0),
      count: Number(val?.count || 0),
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [salesStatsData]);

  // 🔹 Bar: statuts des ventes (nom -> totalAmount)
  const statusData =
    salesStatsData?.statusStats
      ? Object.entries(salesStatsData.statusStats).map(([key, val]) => ({
          name: key,
          total: val.totalAmount || 0,
        }))
      : [];

  const topProducts = salesStatsData?.topProducts || [];

  // ===== 🔹 Export des Statistiques de ventes (option B : TOUTES données) =====
  const exportSalesStatsAll = async () => {
    try {
      const res = await api.get(`/sales/dashboard-sale?range=all`);
      const d = res.data || {};

      const wb = XLSX.utils.book_new();

      // Résumé
      const resumeRows = [
        {
          "Total ventes (CFA)": Math.round(d.totalSales || 0),
          "Vente moyenne (CFA)": Math.round(d.averageSale || 0),
          "Produits vendus": d.totalProducts || 0,
          "Nombre de ventes": d.salesCount || 0,
          "Paiements (total)": d.paymentsSummary?.paymentsTotal || 0,
          "Paiements (nombre)": d.paymentsSummary?.paymentsCount || 0,
        },
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(resumeRows),
        "Résumé"
      );

      // Tendance
      const trendRows = (d.salesTrend || []).map((x) => ({
        Date: x.date,
        Total: x.total,
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(trendRows),
        "Tendance"
      );

      // Méthodes de paiement
      const payRows = Object.entries(d.paymentMethods || {}).map(
        ([name, v]) => ({
          Méthode: name,
          "Montant (CFA)": Number(v?.totalAmount || 0),
          "% du total": Number(v?.percentage || 0),
          "Nombre de paiements": Number(v?.count || 0),
        })
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(payRows),
        "MéthodesPaiement"
      );

      // Statuts des ventes
      const statusRows = Object.entries(d.statusStats || {}).map(
        ([name, v]) => ({
          Statut: name,
          "Montant total (CFA)": v?.totalAmount || 0,
          "Nombre": v?.count || 0,
        })
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(statusRows),
        "StatutsVentes"
      );

      // Top produits
      const productRows = (d.topProducts || []).map((p) => ({
        Produit: p?.product?.name || "N/A",
        Quantité: p?.quantity || 0,
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(productRows),
        "TopProduits"
      );

      XLSX.writeFile(
        wb,
        `stats-ventes-all-${format(new Date(), "yyyy-MM-dd")}.xlsx`
      );
    } catch (e) {
      console.error("Export stats ventes ALL échoué:", e);
      alert("Impossible d’exporter les statistiques (ALL).");
    }
  };

  // ===== LOADING =====
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );

  const today = new Date();

  // ===== UI — styles des cartes principales =====
  const CARD_STYLES = [
    {
      bg: "from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20",
      border: "border-green-200/40 dark:border-green-800/30",
      text: "text-green-600 dark:text-green-400",
      iconWrap: "bg-white/70 dark:bg-gray-900/60",
    },
    {
      bg: "from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20",
      border: "border-blue-200/40 dark:border-blue-800/30",
      text: "text-blue-600 dark:text-blue-400",
      iconWrap: "bg-white/70 dark:bg-gray-900/60",
    },
    {
      bg: "from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20",
      border: "border-red-200/40 dark:border-red-800/30",
      text: "text-red-600 dark:text-red-400",
      iconWrap: "bg-white/70 dark:bg-gray-900/60",
    },
    {
      bg: "from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20",
      border: "border-purple-200/40 dark:border-purple-800/30",
      text: "text-purple-600 dark:text-purple-400",
      iconWrap: "bg-white/70 dark:bg-gray-900/60",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Tableau de Bord</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Aperçu global des performances
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Basculer thème"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              aria-label="Période"
            >
              <option value="day">Aujourd’hui</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>

            {/* Sélecteur de comparaison manuelle */}
            <select
              value={compareMode}
              onChange={(e) => setCompareMode(e.target.value)}
              className="pl-4 pr-10 py-2 border border-blue-300 dark:border-blue-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500"
              aria-label="Comparer à"
              title="Comparer à"
            >
              <option value="none">Aucune comparaison</option>
              <option value="prev-week">Comparer à la semaine précédente</option>
              <option value="prev-month">Comparer au mois précédent</option>
              <option value="prev-year">Comparer à l’année précédente</option>
            </select>

            {isAdmin && (
              <button
                onClick={() => setShowExportMenu(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                📤 Exporter
              </button>
            )}
          </div>
        </div>

        {/* ===== CARTES PRINCIPALES (condensées) ===== */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {[
            {
              title: "Ventes Totales",
              value: totalSales,
              icon: <DollarSign />,
              trend: salesTrend,
              style: CARD_STYLES[0],
            },
            {
              title: "Encaissements",
              value: totalPaid,
              icon: <Coins />,
              trend: pct(totalPaid, totalSales), // ratio visuel
              style: CARD_STYLES[1],
            },
            {
              title: "Dépenses",
              value: totalExpenses,
              icon: <TrendingDown />,
              trend: expenseTrend,
              style: CARD_STYLES[2],
            },
            {
              title: "Profit Net",
              value: profit,
              icon: <PieIcon />,
              trend: profitTrend,
              style: CARD_STYLES[3],
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02 }}
              className={`p-5 rounded-3xl bg-gradient-to-br ${stat.style.bg} shadow-lg border ${stat.style.border} backdrop-blur-md`}
            >
              <div className="flex justify-between items-center">
                <div className={`p-3 ${stat.style.iconWrap} rounded-xl`}>
                  {stat.icon}
                </div>
              </div>
              <h4 className="text-sm font-medium mt-3 text-gray-700 dark:text-gray-300">
                {stat.title}
              </h4>
              <p className={`text-2xl font-bold ${stat.style.text}`}>
                {stat.value.toLocaleString("fr-FR")} CFA
              </p>
              <p
                className={`mt-1 text-xs ${
                  String(stat.trend).startsWith("+")
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {String(stat.trend).startsWith("+") ? "📈" : "📉"} {stat.trend}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* ===== GRAPHIQUE FINANCIER MIXTE (barres + lignes comparées) ===== */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="absolute right-4 top-4 text-[11px] px-2.5 py-1 rounded-full bg-indigo-600 text-white shadow">
            Analyse comparée {compareMode !== "none" ? "activée" : "désactivée"}
          </div>

          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold">Analyse financière</h2>
            <button
              onClick={() => handleOpenDayDetails(today)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all text-sm"
            >
              <CalendarDays size={16} /> Détails du jour
            </button>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={mergedForChart}
                onClick={(state) => {
                  if (state && state.activeLabel) {
                    const clickedDate = new Date(state.activeLabel);
                    handleOpenDayDetails(clickedDate);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    format(new Date(d), "dd MMM", { locale: fr })
                  }
                />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(v, n) => [
                    `${Number(v).toLocaleString("fr-FR")} CFA`,
                    n,
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 10px 30px rgba(0,0,0,.12)",
                    backgroundColor: darkMode ? "#111827" : "#fff",
                    color: darkMode ? "#F9FAFB" : "#111827",
                  }}
                />
                <Legend />

                {/* Barres — période actuelle */}
                <Bar
                  dataKey="sales"
                  name="Ventes (actuel)"
                  fill="#22C55E"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                />
                <Bar
                  dataKey="paid"
                  name="Encaissements (actuel)"
                  fill="#3B82F6"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                />
                <Bar
                  dataKey="expenses"
                  name="Dépenses (actuel)"
                  fill="#EF4444"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                />

                {/* Lignes — période comparée */}
                {compareMode !== "none" && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="prevSales"
                      name={
                        compareMode === "prev-week"
                          ? "Ventes (semaine préc.)"
                          : compareMode === "prev-month"
                          ? "Ventes (mois préc.)"
                          : "Ventes (année préc.)"
                      }
                      stroke="#64748B"
                      strokeDasharray="5 5"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey={(d) => d.prevProfit ?? null}
                      name={
                        compareMode === "prev-week"
                          ? "Profit net (semaine préc.)"
                          : compareMode === "prev-month"
                          ? "Profit net (mois préc.)"
                          : "Profit net (année préc.)"
                      }
                      stroke="#8B5CF6"
                      dot={false}
                      strokeWidth={3}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isAdmin && (
        <motion.div
          className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* 🔹 En-tête + contrôles (période + switch lissage + export ALL) */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                📊 Statistiques des ventes
              </h2>
              <p className="text-gray-500 text-xs">
                Tendance, encaissements, méthodes, statuts & top produits
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Sélecteur de période (alimente /dashboard/data) */}
              <select
                value={salesStatsRange}
                onChange={(e) => setSalesStatsRange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                title="Plage des statistiques des ventes"
              >
                <option value="7days">7 jours</option>
                <option value="30days">30 jours</option>
                <option value="90days">90 jours</option>
                <option value="all">Toutes les données</option>
              </select>

              {/* 🔹 Switch “Lisser la tendance” */}
              <button
                type="button"
                onClick={() => setSmoothTrend((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition
                  ${smoothTrend
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700"}`}
                title="Lisser la tendance (moyenne mobile 3 j)"
              >
                <Wand2 size={16} />
                {smoothTrend ? "Lissé" : "Lisser la tendance"}
              </button>

              {/* 🔹 Export ALL (toutes données) */}
              <button
                type="button"
                onClick={exportSalesStatsAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                title="Exporter toutes les statistiques de ventes"
              >
                <Download size={16} />
                Export (ALL)
              </button>
            </div>
          </div>

          {/* 🔹 Label dynamique lissage */}
          {smoothTrend && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-full bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-300/40">
                <Wand2 size={14} /> Tendance lissée (3 j)
              </span>
            </div>
          )}

          {/* Résumé compact + Encart livraisons à droite */}
          {salesStatsData && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
              {/* Résumé (4 cartes) */}
              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 flex items-center gap-3">
                  <DollarSign className="text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">Total ventes</p>
                    <h3 className="text-lg font-bold text-green-700 dark:text-green-300">
                      {Math.round(salesStatsData.totalSales || 0).toLocaleString("fr-FR")}{" "}
                      CFA
                    </h3>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-center gap-3">
                  <TrendingUp className="text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">Vente moyenne</p>
                    <h3 className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {Math.round(salesStatsData.averageSale || 0).toLocaleString("fr-FR")}{" "}
                      CFA
                    </h3>
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800 flex items-center gap-3">
                  <Package className="text-yellow-600" />
                  <div>
                    <p className="text-xs text-gray-500">Produits vendus</p>
                    <h3 className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                      {salesStatsData.totalProducts || 0}
                    </h3>
                  </div>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 flex items-center gap-3">
                  <ShoppingCart className="text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-500">Nombre de ventes</p>
                    <h3 className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {salesStatsData.salesCount || 0}
                    </h3>
                  </div>
                </div>
              </div>

              {/* 🔹 Encart livraisons à droite */}
              <div className="lg:col-span-1 p-4 rounded-2xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Truck className="text-indigo-600" size={16} />
                  Livraisons
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-green-50 dark:bg-green-900/20">
                    <span className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <PackageCheck size={16} /> Livrées
                    </span>
                    <span className="font-semibold">
                      {deliveryStats?.delivered?.count || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
                    <span className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                      <Clock3 size={16} /> En attente
                    </span>
                    <span className="font-semibold">
                      {deliveryStats?.pending?.count || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-red-50 dark:bg-red-900/20">
                    <span className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <XCircle size={16} /> Non livrées
                    </span>
                    <span className="font-semibold">
                      {deliveryStats?.not_delivered?.count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🔹 Sous-bloc "Encaissements" (paymentsTotal / paymentsCount) */}
          {salesStatsData?.paymentsSummary && (
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <Coins className="text-emerald-500" size={16} />
                Encaissements
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                  <DollarSign className="text-emerald-600" />
                  <div>
                    <p className="text-xs text-gray-500">Montant total encaissé</p>
                    <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {Math.round(salesStatsData.paymentsSummary.paymentsTotal || 0).toLocaleString("fr-FR")}{" "}
                      CFA
                    </h3>
                  </div>
                </div>

                <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl border border-cyan-200 dark:border-cyan-800 flex items-center gap-3">
                  <Coins className="text-cyan-600" />
                  <div>
                    <p className="text-xs text-gray-500">Nombre de paiements</p>
                    <h3 className="text-lg font-bold text-cyan-700 dark:text-cyan-300">
                      {salesStatsData.paymentsSummary.paymentsCount || 0}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grilles condensées : Tendance | Méthodes / Statuts | Top produits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            {/* 🔹 Tendance des ventes (+ lissage) */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200 text-sm">
                Tendance des ventes
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendDataDisplay}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => `${Number(v).toLocaleString("fr-FR")} CFA`}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 🔹 Méthodes de paiement corrigées */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200 text-sm">
                Méthodes de paiement
              </h3>

              {paymentPieData && paymentPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={paymentPieData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={70}
                      label={({ name, value }) => {
                        const sum = paymentPieData.reduce((s, r) => s + r.value, 0);
                        return `${name}: ${
                          sum > 0 ? ((value / sum) * 100).toFixed(1) : "0.0"
                        }%`;
                      }}
                    >
                      {paymentPieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={SALES_PIE_COLORS[i % SALES_PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n, p) => [
                        `${Number(v).toLocaleString("fr-FR")} CFA`,
                        p?.payload?.name || n,
                      ]}
                      contentStyle={{
                        borderRadius: 10,
                        backgroundColor: darkMode ? "#1F2937" : "#fff",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-gray-500 text-sm py-8">
                  Aucune méthode de paiement enregistrée
                </div>
              )}
            </div>

            {/* Statuts des ventes */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200 text-sm">
                Statuts des ventes
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => `${Number(v).toLocaleString("fr-FR")} CFA`}
                  />
                  <Bar dataKey="total" fill="#10B981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top produits */}
          <div className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200 text-sm">
              Top produits vendus
            </h3>
            <ul className="space-y-2">
              {(topProducts || []).map((p, i) => (
                <li
                  key={i}
                  className="flex justify-between text-sm bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {p.product?.name || "Produit"}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {p.quantity} vendus
                  </span>
                </li>
              ))}
              {(!topProducts || topProducts.length === 0) && (
                <div className="text-center text-gray-500 text-sm py-6">
                  Aucune donnée disponible
                </div>
              )}
            </ul>
          </div>
        </motion.div>
        )}

        {isAdmin && (
          <BusinessAnalyticsDashboard
            sales={salesData}
            expenses={expensesData}
            payments={paymentsData}
            defaultPeriod="month"
          />
        )}

        {/* ===== Admin only ===== */}
        {isAdmin && (
          <>
            <AnalyticsSection
              metrics={{
                grossProfit: profit,
                profitMargin: totalSales > 0 ? (profit / totalSales) * 100 : 0,
                roi: totalExpenses > 0 ? (profit / totalExpenses) * 100 : 0,
                operationalEfficiency:
                  totalSales > 0 ? (totalPaid / totalSales) * 100 : 0,
                dailyGrowth: 12,
                weeklyGrowth: 5,
                monthlyGrowth: 18,
              }}
            />
            <RemindersPanel
              overdue={overdueReminders}
              upcoming={upcomingReminders}
            />
          </>
        )}

        {/* ===== Export (global) ===== */}
        <ExportModal
          show={showExportMenu}
          onClose={() => setShowExportMenu(false)}
          onExport={exportToExcel}
          startDate={exportStartDate}
          endDate={exportEndDate}
          setStartDate={setExportStartDate}
          setEndDate={setExportEndDate}
        />

        {/* ===== Modal Détails jour ===== */}
        <Suspense fallback={<div className="text-center p-6">Chargement...</div>}>
          {isModalOpen && (
            <DayDetailsModal
              date={selectedDate}
              sales={salesData.filter(
                (s) =>
                  format(new Date(s.createdAt), "yyyy-MM-dd") ===
                  format(selectedDate, "yyyy-MM-dd")
              )}
              expenses={expensesData.filter(
                (e) =>
                  format(new Date(e.createdAt), "yyyy-MM-dd") ===
                  format(selectedDate, "yyyy-MM-dd")
              )}
              payments={paymentsData.filter(
                (p) =>
                  format(new Date(p.paymentDate || p.createdAt), "yyyy-MM-dd") ===
                  format(selectedDate, "yyyy-MM-dd")
              )}
              onClose={handleCloseModal}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;
