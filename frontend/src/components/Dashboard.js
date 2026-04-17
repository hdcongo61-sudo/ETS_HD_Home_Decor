// src/components/Dashboard.js
import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  lazy,
  Suspense,
  useCallback,
  useRef,
} from "react";
import { Link } from "react-router-dom";
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
  eachDayOfInterval,
  eachWeekOfInterval,
  max as maxDate,
  min as minDate,
  subWeeks,
  subMonths,
  subYears,
} from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import api from "../services/api";
import AuthContext from "../context/AuthContext";
import {
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

import AccordionSection from "../components/AccordionSection";
import AppLoader from "../components/AppLoader";

const DayDetailsModal = lazy(() => import("./DayDetailsModal"));
const RemindersPanel = lazy(() => import("../components/RemindersPanel"));
const ExportModal = lazy(() => import("../components/ExportModal"));
const BusinessAnalyticsDashboard = lazy(() => import("../components/BusinessAnalyticsDashboard"));
const loadXlsx = () => import("xlsx");

const Dashboard = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const currentYear = new Date().getFullYear();

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
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const activeYear = useMemo(() => {
    const parsed = parseInt(selectedYear, 10);
    return Number.isNaN(parsed) ? currentYear : parsed;
  }, [selectedYear, currentYear]);
  const activeMonth = useMemo(() => {
    const parsed = parseInt(selectedMonth, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [selectedMonth]);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        value: String(monthIndex),
        label: format(new Date(activeYear, monthIndex, 1), "MMMM", { locale: fr }),
      })),
    [activeYear]
  );
  const weekOptions = useMemo(() => {
    const yearStart = startOfYear(new Date(activeYear, 0, 1));
    const yearEnd = endOfYear(new Date(activeYear, 0, 1));
    const periodStart =
      activeMonth === null
        ? yearStart
        : startOfMonth(new Date(activeYear, activeMonth, 1));
    const periodEnd =
      activeMonth === null
        ? yearEnd
        : endOfMonth(new Date(activeYear, activeMonth, 1));
    const weeks = eachWeekOfInterval(
      {
        start: startOfWeek(periodStart, { locale: fr }),
        end: endOfWeek(periodEnd, { locale: fr }),
      },
      { locale: fr }
    );

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart, { locale: fr });
      const boundedStart = maxDate([weekStart, periodStart]);
      const boundedEnd = minDate([weekEnd, periodEnd]);

      return {
        value: format(weekStart, "yyyy-MM-dd"),
        label: `Semaine ${index + 1} (${format(boundedStart, "dd MMM", {
          locale: fr,
        })} - ${format(boundedEnd, "dd MMM", { locale: fr })})`,
      };
    });
  }, [activeMonth, activeYear]);

  useEffect(() => {
    if (timeRange !== "year") {
      setSelectedMonth("");
      setSelectedWeek("");
    }
  }, [timeRange]);

  useEffect(() => {
    setSelectedWeek("");
  }, [selectedMonth, selectedYear]);

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
  const [chartLoading, setChartLoading] = useState(false);
  const dashboardDataLoadedRef = useRef(false);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [neverPaidReminders, setNeverPaidReminders] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ===== 🔹 STATISTIQUES DES VENTES (nouvelle section) =====
  const [salesStatsRange, setSalesStatsRange] = useState("30days"); // 7days|30days|90days|all
  const [salesStatsData, setSalesStatsData] = useState(null);
  const [bestDaysRanges, setBestDaysRanges] = useState({});
  const [nonCriticalReady, setNonCriticalReady] = useState(false);
  // 🔹 Switch lissage (persisté)
  const [smoothTrend, setSmoothTrend] = useState(
    localStorage.getItem("smoothTrend") === "true"
  );
  useEffect(() => {
    localStorage.setItem("smoothTrend", String(smoothTrend));
  }, [smoothTrend]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setNonCriticalReady(true);
      return undefined;
    }

    let timeoutId = null;
    let idleId = null;
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) setNonCriticalReady(true);
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(markReady, { timeout: 500 });
    } else {
      timeoutId = window.setTimeout(markReady, 250);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  // ===== Helpers période =====
  const getYearScopedRange = useCallback(() => {
    const yearBase = new Date(activeYear, 0, 1);
    const yearStart = startOfYear(yearBase);
    const yearEnd = endOfYear(yearBase);

    if (selectedWeek) {
      const weekStart = startOfWeek(new Date(`${selectedWeek}T00:00:00`), {
        locale: fr,
      });
      const weekEnd = endOfWeek(weekStart, { locale: fr });
      const bounds =
        activeMonth === null
          ? {
              start: yearStart,
              end: yearEnd,
            }
          : {
              start: startOfMonth(new Date(activeYear, activeMonth, 1)),
              end: endOfMonth(new Date(activeYear, activeMonth, 1)),
            };

      return {
        start: maxDate([weekStart, bounds.start]),
        end: minDate([weekEnd, bounds.end]),
      };
    }

    if (activeMonth !== null) {
      const monthBase = new Date(activeYear, activeMonth, 1);
      return {
        start: startOfMonth(monthBase),
        end: endOfMonth(monthBase),
      };
    }

    return { start: yearStart, end: yearEnd };
  }, [activeMonth, activeYear, selectedWeek]);

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
        return getYearScopedRange();
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
      const d = format(new Date(s.saleDate || s.createdAt), "yyyy-MM-dd");
      ensure(d).sales += s.totalAmount || 0;
    });
    expenses.forEach((e) => {
      const d = format(new Date(e.date || e.createdAt), "yyyy-MM-dd");
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
    const isInitialLoad = !dashboardDataLoadedRef.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setChartLoading(true);
      }
      const { start, end } = getDateRange(timeRange);
      const [salesRes, expensesRes, paymentsRes] = await Promise.all([
        api.get(
          `/sales/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}&summary=dashboard`
        ),
        api.get(
          `/expenses/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}&summary=dashboard`
        ),
        api.get(
          `/sales/payments/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}&summary=dashboard`
        ),
      ]);
      setSalesData(salesRes.data || []);
      setExpensesData(expensesRes.data || []);
      setPaymentsData(paymentsRes.data || []);
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
      if (isInitialLoad) {
        dashboardDataLoadedRef.current = true;
        setLoading(false);
      } else {
        setChartLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getDateRange is stable
  }, [timeRange, activeYear, activeMonth, selectedWeek, getYearScopedRange]);

  // ===== FETCH: période comparée (manuelle) =====
  const fetchPrevData = useCallback(async () => {
    if (compareMode === "none") {
      setPrevCombinedData([]);
      return;
    }
    try {
      if (dashboardDataLoadedRef.current) {
        setChartLoading(true);
      }
      const prev = getPrevPeriod(timeRange, compareMode);
      if (!prev) {
        setPrevCombinedData([]);
        return;
      }
      const [salesRes, expensesRes, paymentsRes] = await Promise.all([
        api.get(
          `/sales/date-range?startDate=${prev.start.toISOString()}&endDate=${prev.end.toISOString()}&summary=dashboard`
        ),
        api.get(
          `/expenses/date-range?startDate=${prev.start.toISOString()}&endDate=${prev.end.toISOString()}&summary=dashboard`
        ),
        api.get(
          `/sales/payments/date-range?startDate=${prev.start.toISOString()}&endDate=${prev.end.toISOString()}&summary=dashboard`
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
    } finally {
      if (dashboardDataLoadedRef.current) {
        setChartLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getPrevPeriod is stable
  }, [compareMode, timeRange, activeYear, activeMonth, selectedWeek, getYearScopedRange]);

  const fetchDeliveryStats = useCallback(async () => {
    try {
      const response = await api.get("/sales/stats/delivery");
      setDeliveryStats(response.data || null);
    } catch (err) {
      console.error("Erreur stats livraison:", err);
    }
  }, []);

  // ===== Reminders =====
  const fetchReminders = async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/sales/reminders/upcoming");
      setUpcomingReminders(response.data.upcoming || []);
      setOverdueReminders(response.data.overdue || []);
      setNeverPaidReminders(response.data.neverPaid || []);
    } catch (err) {
      console.error("Erreur de rappels:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchDeliveryStats();
  }, [fetchDeliveryStats]);

  useEffect(() => {
    if (isAdmin && nonCriticalReady) fetchReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchReminders on mount only
  }, [isAdmin, nonCriticalReady]);

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

  // Totaux période comparée (pour cartes + tendance selon compareMode)
  const prevPeriodTotals = useMemo(() => {
    const s = prevCombinedData.reduce((sum, d) => sum + (d.sales || 0), 0);
    const p = prevCombinedData.reduce((sum, d) => sum + (d.paid || 0), 0);
    const e = prevCombinedData.reduce((sum, d) => sum + (d.expenses || 0), 0);
    return { sales: s, paid: p, expenses: e, profit: p - e };
  }, [prevCombinedData]);

  // Tendances: vs période comparée si active, sinon vs semaine précédente
  const prevWeek = getPrevPeriod("week", "prev-week");
  const prevWeekStats = useMemo(() => {
    if (!prevWeek) return { s: 0, p: 0, e: 0, pr: 0 };
    const prevSales = salesData
      .filter(
          (s) =>
          new Date(s.saleDate || s.createdAt) >= prevWeek.start &&
          new Date(s.saleDate || s.createdAt) <= prevWeek.end
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
          new Date(e.date || e.createdAt) >= prevWeek.start &&
          new Date(e.date || e.createdAt) <= prevWeek.end
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

  const exportDescriptor = useMemo(() => {
    const now = new Date();
    const { start, end } =
      timeRange === "day"
        ? { start: startOfDay(now), end: endOfDay(now) }
        : timeRange === "week"
        ? {
            start: startOfWeek(now, { locale: fr }),
            end: endOfWeek(now, { locale: fr }),
          }
        : timeRange === "year"
        ? getYearScopedRange()
        : { start: startOfMonth(now), end: endOfMonth(now) };
    const startValue = format(start, "yyyy-MM-dd");
    const endValue = format(end, "yyyy-MM-dd");

    if (timeRange === "year") {
      if (selectedWeek) {
        return {
          label: `Semaine du ${format(start, "dd MMM yyyy", { locale: fr })} au ${format(end, "dd MMM yyyy", { locale: fr })}`,
          startValue,
          endValue,
          fileSuffix: `${startValue}_to_${endValue}`,
        };
      }

      if (activeMonth !== null) {
        const monthLabel = format(new Date(activeYear, activeMonth, 1), "MMMM-yyyy", { locale: fr });
        return {
          label: `Mois: ${format(new Date(activeYear, activeMonth, 1), "MMMM yyyy", { locale: fr })}`,
          startValue,
          endValue,
          fileSuffix: monthLabel.toLowerCase().replace(/\s+/g, "-"),
        };
      }

      return {
        label: `Année ${activeYear}`,
        startValue,
        endValue,
        fileSuffix: String(activeYear),
      };
    }

    const labels = {
      day: "Aujourd'hui",
      week: "Semaine en cours",
      month: "Mois en cours",
    };

    return {
      label: labels[timeRange] || "Période filtrée",
      startValue,
      endValue,
      fileSuffix: `${startValue}_to_${endValue}`,
    };
  }, [timeRange, activeYear, activeMonth, selectedWeek, getYearScopedRange]);

  const hasCompare = compareMode !== "none";
  const trendBase = hasCompare ? prevPeriodTotals : { sales: prevWeekStats.s, paid: prevWeekStats.p, expenses: prevWeekStats.e, profit: prevWeekStats.pr };
  const salesTrend = pct(totalSales, trendBase.sales);
  const expenseTrend = pct(totalExpenses, trendBase.expenses);
  const profitTrend = pct(profit, trendBase.profit);

  // ===== EXPORT principal (tableau combiné) =====
  const exportToExcel = async () => {
    const XLSX = await loadXlsx();
    const summaryRows = [
      {
        Filtre: exportDescriptor.label,
        "Date début": exportDescriptor.startValue,
        "Date fin": exportDescriptor.endValue,
        "Lignes exportées": combinedData.length,
      },
    ];
    const rows = combinedData.map((d) => ({
      Date: format(new Date(d.date), "dd/MM/yyyy"),
      Ventes: d.sales,
      Encaissements: d.paid,
      Dépenses: d.expenses,
      Profit: d.paid - d.expenses,
    }));
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Filtre");
    XLSX.utils.book_append_sheet(wb, ws, "Données");
    XLSX.writeFile(wb, `dashboard-${exportDescriptor.fileSuffix}.xlsx`);
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
    if (!isAdmin || !nonCriticalReady) return;
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
  }, [isAdmin, nonCriticalReady, salesStatsRange]);

  useEffect(() => {
    if (!isAdmin || !nonCriticalReady) return;
    const ranges = [
      { key: "7days", label: "7 jours" },
      { key: "30days", label: "30 jours" },
      { key: "year", label: "Année" },
    ];

    const fetchBestForRange = async () => {
      try {
        const results = {};
        await Promise.all(
          ranges.map(async (range) => {
            const res = await api.get(`/sales/best-days?range=${range.key}`);
            results[range.key] = {
              label: range.label,
              days: res.data || null,
            };
          })
        );
        setBestDaysRanges(results);
      } catch (err) {
        console.error("Erreur chargement meilleurs jours :", err);
        setBestDaysRanges({});
      }
    };

    fetchBestForRange();
  }, [isAdmin, nonCriticalReady]);

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

  // 🔹 Bar: statuts des ventes (nom -> totalAmount)
  const statusData =
    salesStatsData?.statusStats
      ? Object.entries(salesStatsData.statusStats).map(([key, val]) => ({
          name: key,
          total: val.totalAmount || 0,
        }))
      : [];

  const topProducts = salesStatsData?.topProducts || [];
  const saleTypeSummary = salesStatsData?.saleTypeSummary || {};
  const paymentStructureSummary = salesStatsData?.paymentStructureSummary || {};
  const neverPaidSales = salesStatsData?.neverPaidSales || {
    count: 0,
    totalAmount: 0,
    sales: [],
  };
  const highlightedSalesCards = [
    {
      key: "wholesale",
      title: "Ventes en gros",
      count: saleTypeSummary.wholesale?.count || 0,
      amount: saleTypeSummary.wholesale?.totalAmount || 0,
      percentage: saleTypeSummary.wholesale?.percentage || 0,
      accent: "from-fuchsia-500 to-pink-500",
      text: "text-fuchsia-700 dark:text-fuchsia-300",
    },
    {
      key: "normal",
      title: "Ventes normales",
      count: saleTypeSummary.normal?.count || 0,
      amount: saleTypeSummary.normal?.totalAmount || 0,
      percentage: saleTypeSummary.normal?.percentage || 0,
      accent: "from-cyan-500 to-sky-500",
      text: "text-cyan-700 dark:text-cyan-300",
    },
    {
      key: "full_payment",
      title: "Paiement complet",
      count: paymentStructureSummary.full_payment?.count || 0,
      amount: paymentStructureSummary.full_payment?.totalAmount || 0,
      percentage: paymentStructureSummary.full_payment?.percentage || 0,
      accent: "from-emerald-500 to-green-500",
      text: "text-emerald-700 dark:text-emerald-300",
      linkTo: "/sales/all?history=1&paymentStructure=full_payment",
    },
    {
      key: "multiple_payments",
      title: "Paiements multiples",
      count: paymentStructureSummary.multiple_payments?.count || 0,
      amount: paymentStructureSummary.multiple_payments?.totalAmount || 0,
      percentage: paymentStructureSummary.multiple_payments?.percentage || 0,
      accent: "from-amber-500 to-orange-500",
      text: "text-amber-700 dark:text-amber-300",
      linkTo: "/sales/all?history=1&paymentStructure=multiple_payments",
    },
  ];

  const bestDays = salesStatsData?.bestDays;
  const formatBestDay = (day) => {
    if (!day?.date) return "—";
    const parsed = new Date(day.date);
    if (Number.isNaN(parsed.getTime())) return day.date;
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsed);
  };

  const encaissementHighlights = useMemo(() => {
    if (timeRange !== "year") return null;

    const sumByKey = new Map();

    paymentsData.forEach((payment) => {
      const rawDate = payment?.paymentDate || payment?.createdAt;
      if (!rawDate) return;
      const paymentDate = new Date(rawDate);
      if (Number.isNaN(paymentDate.getTime())) return;

      let key = "";
      if (selectedWeek) {
        key = format(paymentDate, "yyyy-MM-dd");
      } else if (activeMonth !== null) {
        key = format(startOfWeek(paymentDate, { locale: fr }), "yyyy-MM-dd");
      } else {
        key = String(paymentDate.getMonth());
      }

      sumByKey.set(key, (sumByKey.get(key) || 0) + (Number(payment.amount) || 0));
    });

    let buckets = [];
    let bestLabel = "Mois avec le meilleur encaissement";
    let lowestLabel = "Mois avec le plus faible encaissement";
    let helperText = `Année ${activeYear}`;

    if (selectedWeek) {
      const { start, end } = getYearScopedRange();
      buckets = eachDayOfInterval({ start, end }).map((day) => {
        const key = format(day, "yyyy-MM-dd");
        return {
          key,
          label: format(day, "EEEE d MMMM", { locale: fr }),
          total: Number(sumByKey.get(key) || 0),
        };
      });
      bestLabel = "Jour avec le meilleur encaissement";
      lowestLabel = "Jour avec le plus faible encaissement";
      helperText = "Semaine sélectionnée";
    } else if (activeMonth !== null) {
      const monthStart = startOfMonth(new Date(activeYear, activeMonth, 1));
      const monthEnd = endOfMonth(new Date(activeYear, activeMonth, 1));
      buckets = weekOptions.map((week, index) => {
        const weekStart = new Date(`${week.value}T00:00:00`);
        const boundedStart = maxDate([weekStart, monthStart]);
        const boundedEnd = minDate([endOfWeek(weekStart, { locale: fr }), monthEnd]);
        const key = format(weekStart, "yyyy-MM-dd");

        return {
          key,
          label: `Semaine ${index + 1} (${format(boundedStart, "dd MMM", {
            locale: fr,
          })} - ${format(boundedEnd, "dd MMM", { locale: fr })})`,
          total: Number(sumByKey.get(key) || 0),
        };
      });
      bestLabel = "Semaine avec le meilleur encaissement";
      lowestLabel = "Semaine avec le plus faible encaissement";
      helperText = format(new Date(activeYear, activeMonth, 1), "MMMM yyyy", { locale: fr });
    } else {
      buckets = monthOptions.map((month) => ({
        key: month.value,
        label: format(new Date(activeYear, Number(month.value), 1), "MMMM yyyy", { locale: fr }),
        total: Number(sumByKey.get(month.value) || 0),
      }));
    }

    if (!buckets.length) return null;

    const best = buckets.reduce((winner, bucket) =>
      bucket.total > winner.total ? bucket : winner
    , buckets[0]);
    const lowest = buckets.reduce((loser, bucket) =>
      bucket.total < loser.total ? bucket : loser
    , buckets[0]);

    return {
      best,
      lowest,
      bestLabel,
      lowestLabel,
      helperText,
    };
  }, [
    timeRange,
    paymentsData,
    selectedWeek,
    activeMonth,
    activeYear,
    monthOptions,
    weekOptions,
    getYearScopedRange,
  ]);

  // ===== 🔹 Export des Statistiques de ventes (option B : TOUTES données) =====
  const exportSalesStatsAll = async () => {
    try {
      const XLSX = await loadXlsx();
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
          "Ventes sans paiement": d.neverPaidSales?.count || 0,
          "Montant sans paiement (CFA)": Math.round(d.neverPaidSales?.totalAmount || 0),
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

      const saleTypeRows = Object.entries(d.saleTypeSummary || {}).map(
        ([name, v]) => ({
          Type: name === "wholesale" ? "Vente en gros" : "Vente normale",
          "Nombre de ventes": v?.count || 0,
          "Montant total (CFA)": v?.totalAmount || 0,
          "% des ventes": Number(v?.percentage || 0),
        })
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(saleTypeRows),
        "TypesVentes"
      );

      const paymentStructureRows = Object.entries(d.paymentStructureSummary || {}).map(
        ([name, v]) => ({
          Structure:
            name === "full_payment"
              ? "Paiement complet"
              : name === "multiple_payments"
              ? "Paiements multiples"
              : "Paiement en attente",
          "Nombre de ventes": v?.count || 0,
          "Montant total (CFA)": v?.totalAmount || 0,
          "% des ventes": Number(v?.percentage || 0),
        })
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(paymentStructureRows),
        "StructuresPaiement"
      );

      const neverPaidRows = (d.neverPaidSales?.sales || []).map((sale) => ({
        Vente: sale?._id || "",
        Client: sale?.client?.name || "Client non spécifié",
        Date: sale?.saleDate
          ? new Date(sale.saleDate).toLocaleDateString("fr-FR")
          : "",
        "Type de vente": sale?.saleType === "wholesale" ? "Vente en gros" : "Vente normale",
        Statut: sale?.status || "",
        "Montant total (CFA)": Number(sale?.totalAmount || 0),
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(neverPaidRows),
        "SansPaiement"
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
      <div className="flex items-center justify-center min-h-[40vh] bg-transparent">
        <AppLoader fullScreen={false} text="Chargement du tableau de bord…" />
      </div>
    );

  const today = new Date();
  const userName = auth?.user?.name || auth?.user?.username || "";

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
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* ===== HEADER — Accueil professionnel mobile/desktop ===== */}
        <header className="flex flex-col gap-4 sm:gap-5">
          <div className="flex flex-col gap-1 sm:gap-0.5">
            {userName && (
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Bienvenue, <span className="text-gray-700 dark:text-gray-200">{userName}</span>
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Tableau de bord
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
              Aperçu global des performances
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Basculer thème"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="min-h-[44px] px-4 pr-10 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-700 dark:text-gray-200"
              aria-label="Période"
            >
              <option value="day">Aujourd’hui</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>

            {timeRange === "year" && (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  onBlur={() => {
                    if (Number.isNaN(parseInt(selectedYear, 10))) {
                      setSelectedYear(String(currentYear));
                    }
                  }}
                  className="min-h-[44px] w-24 sm:w-28 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 text-sm"
                  aria-label="Année"
                  placeholder="Année"
                  min="1970"
                  max={currentYear}
                />

                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="min-h-[44px] pl-4 pr-10 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-700 dark:text-gray-200"
                  aria-label="Mois de l'année"
                >
                  <option value="">Toute l'année</option>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="min-h-[44px] pl-4 pr-10 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-700 dark:text-gray-200"
                  aria-label="Semaine de l'année"
                >
                  <option value="">
                    {selectedMonth ? "Tout le mois" : "Toutes les semaines"}
                  </option>
                  {weekOptions.map((week) => (
                    <option key={week.value} value={week.value}>
                      {week.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <select
              value={compareMode}
              onChange={(e) => setCompareMode(e.target.value)}
              className="min-h-[44px] pl-4 pr-10 py-2 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-700 dark:text-gray-200"
              aria-label="Comparer à"
              title="Comparer à"
            >
              <option value="none">Aucune comparaison</option>
              <option value="prev-week">Vs semaine préc.</option>
              <option value="prev-month">Vs mois préc.</option>
              <option value="prev-year">Vs année préc.</option>
            </select>

            {isAdmin && (
              <button
                onClick={() => setShowExportMenu(true)}
                className="min-h-[44px] px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Exporter</span>
              </button>
            )}
          </div>
        </header>

        {/* ===== CARTES PRINCIPALES (KPI) — responsive mobile/desktop ===== */}
        <div className="relative space-y-3 sm:space-y-4" aria-busy={chartLoading}>
          {chartLoading && (
            <div className="absolute inset-0 z-20 flex items-start justify-center rounded-3xl bg-white/55 pt-5 backdrop-blur-[2px] dark:bg-gray-950/35">
              <div className="rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-lg dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-200">
                Mise à jour du graphique…
              </div>
            </div>
          )}

          <motion.section
            className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 transition-opacity ${
              chartLoading ? "opacity-60" : "opacity-100"
            }`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            aria-label="Indicateurs clés"
          >
            {[
              {
                title: "Ventes totales",
                value: totalSales,
                prevValue: hasCompare ? prevPeriodTotals.sales : null,
                icon: <DollarSign size={22} />,
                trend: salesTrend,
                style: CARD_STYLES[0],
              },
              {
                title: "Encaissements",
                value: totalPaid,
                prevValue: hasCompare ? prevPeriodTotals.paid : null,
                icon: <Coins size={22} />,
                trend: pct(totalPaid, totalSales),
                style: CARD_STYLES[1],
              },
              {
                title: "Dépenses",
                value: totalExpenses,
                prevValue: hasCompare ? prevPeriodTotals.expenses : null,
                icon: <TrendingDown size={22} />,
                trend: expenseTrend,
                style: CARD_STYLES[2],
              },
              {
                title: "Profit net",
                value: profit,
                prevValue: hasCompare ? prevPeriodTotals.profit : null,
                icon: <PieIcon size={22} />,
                trend: profitTrend,
                style: CARD_STYLES[3],
              },
            ].map((stat, i) => (
              <motion.article
                key={i}
                whileHover={{ scale: 1.01 }}
                className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${stat.style.bg} shadow-md border ${stat.style.border} backdrop-blur-sm transition-shadow hover:shadow-lg`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`p-2.5 sm:p-3 ${stat.style.iconWrap} rounded-xl shrink-0`}>
                    <span className={stat.style.text}>{stat.icon}</span>
                  </div>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      String(stat.trend).startsWith("+")
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {String(stat.trend).startsWith("+") ? "↑" : "↓"} {stat.trend}
                  </span>
                </div>
                <h2 className="text-sm font-medium mt-3 text-gray-700 dark:text-gray-300">
                  {stat.title}
                </h2>
                <p className={`mt-1 text-xl sm:text-2xl font-bold tabular-nums ${stat.style.text}`}>
                  {stat.value.toLocaleString("fr-FR")} <span className="text-sm font-normal opacity-90">CFA</span>
                </p>
                {stat.prevValue != null && (
                  <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                    Vs période préc. : <span className="font-medium">{Number(stat.prevValue).toLocaleString("fr-FR")} CFA</span>
                  </p>
                )}
              </motion.article>
            ))}
          </motion.section>

          {/* ===== GRAPHIQUE FINANCIER — carte professionnelle ===== */}
          <section
            className={`relative overflow-hidden bg-white dark:bg-gray-800/90 backdrop-blur-sm p-4 sm:p-5 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 transition-opacity ${
              chartLoading ? "opacity-60" : "opacity-100"
            }`}
            aria-label="Analyse financière"
          >
            <div className="absolute right-3 top-3 sm:right-4 sm:top-4 text-[10px] sm:text-xs px-2 py-1 rounded-full bg-indigo-600 text-white font-medium">
              Comparaison {compareMode !== "none" ? "activée" : "désactivée"}
            </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 pr-24 sm:pr-28">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Analyse financière
            </h2>
            <button
              type="button"
              onClick={() => handleOpenDayDetails(today)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors"
            >
              <CalendarDays size={18} /> Détails du jour
            </button>
          </div>

          <div className="h-64 sm:h-72">
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
          </section>

          {encaissementHighlights && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3" aria-label="Extrêmes des encaissements">
              <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-gray-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {encaissementHighlights.bestLabel}
                </p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {encaissementHighlights.best.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {Math.round(encaissementHighlights.best.total).toLocaleString("fr-FR")} CFA
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {encaissementHighlights.helperText}
                </p>
              </article>

              <article className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm dark:border-rose-900/60 dark:from-rose-950/30 dark:to-gray-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  {encaissementHighlights.lowestLabel}
                </p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {encaissementHighlights.lowest.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                  {Math.round(encaissementHighlights.lowest.total).toLocaleString("fr-FR")} CFA
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {encaissementHighlights.helperText}
                </p>
              </article>
            </section>
          )}
        </div>

        {isAdmin && nonCriticalReady && (
        <AccordionSection title="📊 Statistiques des ventes" defaultOpenDesktop={true}>
        <motion.div
          className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-lg border-0"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* 🔹 En-tête + contrôles (période + switch lissage + export ALL) */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 sr-only">
                Contrôles statistiques
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

          {bestDays && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <p className="text-xs text-gray-500">Meilleur jour de ventes</p>
                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatBestDay(bestDays.sales)}
                </div>
                <div className="text-green-700 dark:text-green-300 font-semibold">
                  {Math.round(bestDays.sales?.totalAmount || 0).toLocaleString("fr-FR")} CFA
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <p className="text-xs text-gray-500">Meilleur jour d'encaissements</p>
                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatBestDay(bestDays.payments)}
                </div>
                <div className="text-blue-700 dark:text-blue-300 font-semibold">
                  {Math.round(bestDays.payments?.totalAmount || 0).toLocaleString("fr-FR")} CFA
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <p className="text-xs text-gray-500">Jour de dépense maximal</p>
                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatBestDay(bestDays.expenses)}
                </div>
                <div className="text-red-700 dark:text-red-300 font-semibold">
                  {Math.round(bestDays.expenses?.totalAmount || 0).toLocaleString("fr-FR")} CFA
                </div>
              </div>
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

          {salesStatsData && (
            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Types de commandes et structure des paiements
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Très visible sur la période sélectionnée
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {highlightedSalesCards.map((card) => {
                  const cardContent = (
                    <div className="h-full rounded-[calc(1.5rem-1px)] bg-white dark:bg-gray-900 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        {card.title}
                      </p>
                      <div className={`mt-3 text-3xl font-black tabular-nums ${card.text}`}>
                        {card.count}
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {card.amount.toLocaleString("fr-FR")} CFA
                      </p>
                      <div className="mt-3 flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Part des ventes</span>
                        <span className={`font-semibold ${card.text}`}>
                          {card.percentage.toFixed(1)}%
                        </span>
                      </div>
                      {card.linkTo && (
                        <div className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                          Voir les ventes
                        </div>
                      )}
                    </div>
                  );

                  if (!card.linkTo) {
                    return (
                      <div
                        key={card.key}
                        className={`rounded-3xl p-[1px] bg-gradient-to-br ${card.accent} shadow-md`}
                      >
                        {cardContent}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={card.key}
                      to={card.linkTo}
                      className={`block rounded-3xl p-[1px] bg-gradient-to-br ${card.accent} shadow-md hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500`}
                      aria-label={`Voir les ventes pour ${card.title.toLowerCase()}`}
                    >
                      {cardContent}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {salesStatsData && (
            <div className="mb-5 rounded-3xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                    Ventes sans aucun paiement
                  </h3>
                  <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-1">
                    Ventes créées sur la période sélectionnée sans paiement enregistré.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-white/80 dark:bg-gray-900/60 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    {neverPaidSales.count} vente{neverPaidSales.count > 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/80 dark:bg-gray-900/60 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    {Math.round(neverPaidSales.totalAmount || 0).toLocaleString("fr-FR")} CFA
                  </span>
                </div>
              </div>

              {neverPaidSales.sales?.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {neverPaidSales.sales.map((sale) => (
                    <Link
                      key={sale._id}
                      to={`/sales/${sale._id}`}
                      className="rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-white dark:bg-gray-900 px-4 py-3 shadow-sm hover:shadow-md hover:border-rose-300 dark:hover:border-rose-700 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {sale.client?.name || "Client non spécifié"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Vente #{sale._id?.slice(-6)} • {sale.saleDate
                              ? new Date(sale.saleDate).toLocaleDateString("fr-FR")
                              : "Date indisponible"}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          sale.saleType === "wholesale"
                            ? "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300"
                            : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300"
                        }`}>
                          {sale.saleType === "wholesale" ? "Vente en gros" : "Vente normale"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                          {Math.round(sale.totalAmount || 0).toLocaleString("fr-FR")} CFA
                        </span>
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
                          Ouvrir la vente
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-rose-200 dark:border-rose-900/40 bg-white/70 dark:bg-gray-900/40 px-4 py-5 text-sm text-gray-600 dark:text-gray-300">
                  Aucune vente sans paiement sur cette période.
                </div>
              )}
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

          {/* Grilles condensées : Tendance | Statuts | Top produits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
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
        </AccordionSection>
        )}

        {isAdmin && nonCriticalReady && (
          <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} /></div>}>
            <BusinessAnalyticsDashboard
              sales={salesData}
              expenses={expensesData}
              payments={paymentsData}
              defaultPeriod="month"
            />
          </Suspense>
        )}

        {/* ===== Admin only ===== */}
        {isAdmin && nonCriticalReady && (
        <>
            {Object.values(bestDaysRanges).length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 mt-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Meilleurs jours par plage
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {Object.values(bestDaysRanges).map((entry) => (
                    <div key={entry.label} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{entry.label}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <StatCard
                          title="Ventes"
                          entry={entry.days?.sales}
                          accent="text-green-600 dark:text-green-300"
                        />
                        <StatCard
                          title="Encaissements"
                          entry={entry.days?.payments}
                          accent="text-blue-600 dark:text-blue-300"
                        />
                        <StatCard
                          title="Dépenses"
                          entry={entry.days?.expenses}
                          accent="text-red-600 dark:text-red-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} /></div>}>
              <RemindersPanel
                overdue={overdueReminders}
                upcoming={upcomingReminders}
                neverPaid={neverPaidReminders}
              />
            </Suspense>
          </>
        )}

        {/* ===== Export (global) ===== */}
        <Suspense fallback={null}>
          <ExportModal
            show={showExportMenu}
            onClose={() => setShowExportMenu(false)}
            onExport={exportToExcel}
            filterLabel={exportDescriptor.label}
            startDate={exportDescriptor.startValue}
            endDate={exportDescriptor.endValue}
          />
        </Suspense>

        {/* ===== Modal Détails jour ===== */}
        <Suspense fallback={<div className="flex justify-center p-6"><AppLoader fullScreen={false} /></div>}>
          {isModalOpen && (
            <DayDetailsModal
              date={selectedDate}
              sales={salesData.filter(
                (s) =>
                  format(new Date(s.saleDate || s.createdAt), "yyyy-MM-dd") ===
                  format(selectedDate, "yyyy-MM-dd")
              )}
              expenses={expensesData.filter(
                (e) =>
                  format(new Date(e.date || e.createdAt), "yyyy-MM-dd") ===
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

const StatCard = ({ title, entry, accent }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-[11px]">
    <div className="text-[10px] text-gray-500">{title}</div>
    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
      {entry?.date ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(entry.date)) : "—"}
    </div>
    <div className={`text-sm font-bold ${accent}`}>
      {entry?.totalAmount ? `${Math.round(entry.totalAmount).toLocaleString("fr-FR")} CFA` : "—"}
    </div>
  </div>
);

export default Dashboard;
