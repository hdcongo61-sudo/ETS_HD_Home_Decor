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
  ChevronDown,
  Coins,
  Truck,
  PackageCheck,
  Clock3,
  XCircle,
  ShoppingCart,
  TrendingUp,
  Package,
  BadgePercent,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Wand2,   // 🔹 lissage
  Download, // 🔹 export stats ventes
  Landmark,
  UsersRound,
  Receipt,
  FileText,
  Settings,
  UserCog,
  BriefcaseBusiness,
  LayoutDashboard
} from "lucide-react";

import AccordionSection from "../components/AccordionSection";
import AppLoader from "../components/AppLoader";
import { KPICard, ChartCard, PageHeader, Workspace } from "./business";

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
  const [isHomeHubOpen, setIsHomeHubOpen] = useState(true);
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
  const [salaryReminders, setSalaryReminders] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [isExportingDashboard, setIsExportingDashboard] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ===== 🔹 STATISTIQUES DES VENTES (nouvelle section) =====
  const [salesStatsRange, setSalesStatsRange] = useState("30days"); // 7days|30days|90days|all
  const [salesStatsData, setSalesStatsData] = useState(null);
  const [productActionSuggestions, setProductActionSuggestions] = useState([]);
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
      setSalaryReminders(response.data.salaryReminders || []);
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

  useEffect(() => {
    if (!showExportMenu) return;
    setExportStartDate((current) => current || exportDescriptor.startValue);
    setExportEndDate((current) => current || exportDescriptor.endValue);
  }, [exportDescriptor.endValue, exportDescriptor.startValue, showExportMenu]);

  const handleExportStartDateChange = useCallback((value) => {
    setExportStartDate(value);
    setExportEndDate((current) => {
      if (!current || !value) return current;
      return current < value ? value : current;
    });
  }, []);

  const handleExportEndDateChange = useCallback((value) => {
    setExportEndDate(value);
    setExportStartDate((current) => {
      if (!current || !value) return current;
      return current > value ? value : current;
    });
  }, []);

  const hasCompare = compareMode !== "none";
  const trendBase = hasCompare ? prevPeriodTotals : { sales: prevWeekStats.s, paid: prevWeekStats.p, expenses: prevWeekStats.e, profit: prevWeekStats.pr };
  const salesTrend = pct(totalSales, trendBase.sales);
  const expenseTrend = pct(totalExpenses, trendBase.expenses);
  const profitTrend = pct(profit, trendBase.profit);

  // ===== EXPORT principal (tableau combiné) =====
  const exportToExcel = async () => {
    const startValue = exportStartDate || exportDescriptor.startValue;
    const endValue = exportEndDate || exportDescriptor.endValue;
    const start = startOfDay(new Date(`${startValue}T00:00:00`));
    const end = endOfDay(new Date(`${endValue}T00:00:00`));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      alert("Choisissez une date de début et une date de fin valides.");
      return;
    }

    if (start > end) {
      alert("La date de début doit être avant la date de fin.");
      return;
    }

    setIsExportingDashboard(true);
    try {
      const XLSX = await loadXlsx();
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

      const exportCombinedData = processCombinedData(
        salesRes.data || [],
        expensesRes.data || [],
        paymentsRes.data || []
      );
      const exportTotalSales = exportCombinedData.reduce((sum, row) => sum + (row.sales || 0), 0);
      const exportTotalPaid = exportCombinedData.reduce((sum, row) => sum + (row.paid || 0), 0);
      const exportTotalExpenses = exportCombinedData.reduce((sum, row) => sum + (row.expenses || 0), 0);
      const exportProfit = exportTotalPaid - exportTotalExpenses;

      const summaryRows = [
        {
          Filtre: "Période personnalisée",
          "Date début": startValue,
          "Date fin": endValue,
          "Total ventes": exportTotalSales,
          "Total encaissements": exportTotalPaid,
          "Total dépenses": exportTotalExpenses,
          Profit: exportProfit,
          "Lignes exportées": exportCombinedData.length,
        },
      ];
      const rows = exportCombinedData.map((d) => ({
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
      XLSX.writeFile(wb, `dashboard-${startValue}_to_${endValue}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error("Export dashboard échoué:", error);
      alert("Impossible de générer l'export du dashboard.");
    } finally {
      setIsExportingDashboard(false);
    }
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
    const run = async () => {
      try {
        const res = await api.get("/products/dashboard?range=month");
        setProductActionSuggestions(res.data?.productActionSuggestions || []);
      } catch (e) {
        console.error("Erreur chargement suggestions produits:", e);
        setProductActionSuggestions([]);
      }
    };
    run();
  }, [isAdmin, nonCriticalReady]);

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

  const highPriorityProductSuggestions = productActionSuggestions.filter(
    (item) => item.priority === "high"
  ).length;
  const productSuggestionStockValue = productActionSuggestions.reduce(
    (sum, item) => sum + Number(item.stockValue || 0),
    0
  );
  const priorityStyles = {
    high: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
    medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
    low: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50",
  };
  const priorityLabel = {
    high: "Priorité haute",
    medium: "Priorité moyenne",
    low: "À surveiller",
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
  const periodLabel =
    timeRange === "day"
      ? "Aujourd'hui"
      : timeRange === "week"
      ? "Cette semaine"
      : timeRange === "month"
      ? "Ce mois"
      : "Vue annuelle";
  const periodOptions = [
    { value: "day", label: "Jour" },
    { value: "week", label: "Semaine" },
    { value: "month", label: "Mois" },
    { value: "year", label: "Année" },
  ];
  const comparisonOptions = [
    { value: "none", label: "Sans comparaison", shortLabel: "Aucune" },
    { value: "prev-week", label: "Semaine précédente", shortLabel: "S-1" },
    { value: "prev-month", label: "Mois précédent", shortLabel: "M-1" },
    { value: "prev-year", label: "Année précédente", shortLabel: "A-1" },
  ];
  const comparisonLabel =
    comparisonOptions.find((option) => option.value === compareMode)?.label ||
    "Sans comparaison";
  const homeShortcuts = [
    {
      to: "/sales",
      label: "Ventes",
      description: "Enregistrer, encaisser et suivre les commandes.",
      icon: ShoppingCart,
      meta: `${totalSales.toLocaleString("fr-FR")} CFA`,
    },
    {
      to: "/bank",
      label: "Caisse",
      description: "Voir les encaissements et mouvements.",
      icon: Landmark,
      meta: `${totalPaid.toLocaleString("fr-FR")} CFA`,
    },
    {
      to: "/products",
      label: "Produits",
      description: "Catalogue, stock et prix de vente.",
      icon: Package,
      meta: `${productActionSuggestions.length} à surveiller`,
    },
    {
      to: "/clients",
      label: "Clients",
      description: "Fiches clients et historique commercial.",
      icon: UsersRound,
      meta: "Relation client",
    },
    {
      to: "/expenses",
      label: "Dépenses",
      description: "Charges, salaires et sorties de caisse.",
      icon: Receipt,
      meta: `${totalExpenses.toLocaleString("fr-FR")} CFA`,
    },
    {
      to: "/employees",
      label: "Employés",
      description: "Équipe, paie et statut boutique.",
      icon: BriefcaseBusiness,
      meta: `${salaryReminders.length} rappel(s)`,
    },
    {
      to: "/product-dashboard",
      label: "Dashboard produits",
      description: "Ruptures, stocks critiques et performance.",
      icon: PackageCheck,
      meta: "Stock",
    },
    {
      to: "/clients/dashboard",
      label: "Dashboard clients",
      description: "Analyse clients et comportements d'achat.",
      icon: LayoutDashboard,
      meta: "Analyse",
    },
    {
      to: "/documents",
      label: "Documents",
      description: "Pièces et fichiers d'entreprise.",
      icon: FileText,
      meta: "Archive",
    },
    {
      to: "/users/stats",
      label: "Utilisateurs",
      description: "Activité, accès et supervision.",
      icon: UserCog,
      meta: "Admin",
    },
    {
      to: "/settings",
      label: "Paramètres",
      description: "Branding, listes et préférences.",
      icon: Settings,
      meta: "Système",
    },
  ];

  // ===== UI — styles des cartes principales =====
  const CARD_STYLES = [
    {
      bg: "from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20",
      border: "border-green-200/40 dark:border-green-800/30",
      text: "text-[var(--ms-success)] dark:text-green-400",
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
    <div className="min-h-full bg-gradient-to-b bg-[var(--ms-bg)] text-[var(--ms-text-strong)] dark:text-gray-100 transition-colors duration-300">
      <div className="space-y-6 sm:space-y-8">
        {/* ===== HOME HUB ===== */}
        <header className="overflow-hidden rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[var(--ms-shadow)]  dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 lg:p-6">
            <div className="min-w-0">
              {userName && (
                <p className="text-sm font-medium text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                  Bienvenue, <span className="text-[var(--ms-text-strong)] dark:text-gray-100">{userName}</span>
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--ms-text-strong)] dark:text-white sm:text-3xl">
                  Accueil opérationnel
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ms-text)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <CalendarDays size={13} />
                  {periodLabel}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)] sm:text-base">
                Une vue rapide pour piloter les ventes, la caisse, les produits, les clients et l’équipe.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsHomeHubOpen((current) => !current)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-2 text-sm font-semibold text-[var(--ms-text)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
              aria-expanded={isHomeHubOpen}
              aria-controls="home-hub-content"
            >
              {isHomeHubOpen ? "Réduire" : "Afficher"}
              <ChevronDown
                size={18}
                className={`transition-transform duration-200 ${isHomeHubOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {isHomeHubOpen && (
            <motion.div
              id="home-hub-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="overflow-hidden"
            >
          <div className="grid gap-5 border-t border-[var(--ms-border)] p-4 pt-5 dark:border-gray-800 sm:p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
            <div className="min-w-0">
              {userName && (
                <p className="text-sm font-medium text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                  Bienvenue, <span className="text-[var(--ms-text-strong)] dark:text-gray-100">{userName}</span>
                </p>
              )}
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--ms-text-strong)] dark:text-white sm:text-3xl">
                    Vue rapide
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)] sm:text-base">
                    Une vue rapide pour piloter les ventes, la caisse, les produits, les clients et l’équipe.
                  </p>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--ms-text)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <CalendarDays size={15} />
                  {periodLabel}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 dark:border-gray-700 dark:bg-gray-800/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Ventes</p>
                  <p className="mt-2 text-xl font-bold text-[var(--ms-text-strong)] dark:text-white">
                    {totalSales.toLocaleString("fr-FR")} CFA
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 dark:border-gray-700 dark:bg-gray-800/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Encaissements</p>
                  <p className="mt-2 text-xl font-bold text-[var(--ms-text-strong)] dark:text-white">
                    {totalPaid.toLocaleString("fr-FR")} CFA
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 dark:border-gray-700 dark:bg-gray-800/80">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Profit net</p>
                  <p className="mt-2 text-xl font-bold text-[var(--ms-text-strong)] dark:text-white">
                    {profit.toLocaleString("fr-FR")} CFA
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3 shadow-inner shadow-white/70 dark:border-gray-700 dark:bg-gray-800/80 dark:shadow-black/10">
              <div className="flex items-start justify-between gap-3 px-1 pb-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ms-text-strong)] dark:text-white">
                    Pilotage
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                    Période et comparaison
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ms-border)] bg-[var(--ms-white)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ms-text)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <CalendarDays size={13} />
                  {periodLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="form-button-secondary flex items-center justify-center gap-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  aria-label="Basculer thème"
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  Thème
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setExportStartDate(exportDescriptor.startValue);
                      setExportEndDate(exportDescriptor.endValue);
                      setShowExportMenu(true);
                    }}
                    className="form-button-primary flex items-center justify-center gap-2 text-sm"
                  >
                    <Download size={18} />
                    Exporter
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-1 dark:border-gray-700 dark:bg-gray-900">
                  <div className="grid grid-cols-4 gap-1">
                    {periodOptions.map((option) => {
                      const isActive = timeRange === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTimeRange(option.value)}
                          className={`min-h-[42px] rounded-lg px-2 text-xs font-semibold transition-all duration-200 ${
                            isActive
                              ? "bg-gray-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] dark:bg-[var(--ms-white)] dark:text-[var(--ms-text-strong)]"
                              : "text-[var(--ms-text-muted)] hover:bg-gray-100 hover:text-[var(--ms-text-strong)] dark:text-[var(--ms-text-muted)] dark:hover:bg-gray-800 dark:hover:text-gray-100"
                          }`}
                          aria-pressed={isActive}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {timeRange === "year" && (
                  <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-3 dark:border-gray-700 dark:bg-gray-900">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)]">
                      Détail annuel
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                          Année
                        </span>
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
                          className="form-control text-sm"
                          aria-label="Année"
                          placeholder="Année"
                          min="1970"
                          max={currentYear}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                          Mois
                        </span>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="form-control text-sm"
                          aria-label="Mois de l'année"
                        >
                          <option value="">Toute l'année</option>
                          {monthOptions.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                          Semaine
                        </span>
                        <select
                          value={selectedWeek}
                          onChange={(e) => setSelectedWeek(e.target.value)}
                          className="form-control text-sm"
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
                      </label>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)]">
                      Comparer à
                    </p>
                    <span className="text-[11px] font-semibold text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                      {comparisonOptions.find((option) => option.value === compareMode)?.shortLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {comparisonOptions.map((option) => {
                      const isActive = compareMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setCompareMode(option.value)}
                          className={`min-h-[42px] rounded-lg border px-3 text-left text-xs font-semibold transition-all duration-200 ${
                            isActive
                              ? "border-gray-950 bg-gray-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] dark:border-white dark:bg-[var(--ms-white)] dark:text-[var(--ms-text-strong)]"
                              : "border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:border-gray-300 hover:bg-[var(--ms-white)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
                          }`}
                          aria-pressed={isActive}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--ms-border)] bg-white/80 px-3 py-2 text-xs text-[var(--ms-text-muted)] dark:border-gray-700 dark:bg-gray-900/80 dark:text-[var(--ms-text-muted)]">
                  <span className="font-semibold text-[var(--ms-text)] dark:text-gray-200">
                    Vue:
                  </span>{" "}
                  {periodLabel}
                  <span className="mx-2 text-gray-300">/</span>
                  <span className="font-semibold text-[var(--ms-text)] dark:text-gray-200">
                    Comparaison:
                  </span>{" "}
                  {comparisonLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--ms-border)] px-4 py-4 dark:border-gray-800 sm:px-5 lg:px-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                Pages rattachées
              </h2>
              <span className="text-xs font-medium text-[var(--ms-text-muted)]">{homeShortcuts.length} accès</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {homeShortcuts.map(({ to, label, description, icon: Icon, meta }) => (
                <Link
                  key={to}
                  to={to}
                  className="group rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)] dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                      <Icon size={20} />
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-[var(--ms-text)] dark:bg-gray-800 dark:text-gray-300">
                      {meta}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[var(--ms-text-strong)] dark:text-white">{label}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                    {description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
            </motion.div>
          )}
        </header>

        {/* ===== CARTES PRINCIPALES (KPI) — responsive mobile/desktop ===== */}
        <div className="relative space-y-3 sm:space-y-4" aria-busy={chartLoading}>
          {chartLoading && (
            <div className="absolute inset-0 z-20 flex items-start justify-center rounded-lg bg-[var(--ms-white)]/55 pt-5 dark:bg-gray-950/35">
              <div className="rounded-full border border-indigo-100 bg-[var(--ms-white)] px-4 py-2 text-sm font-medium text-indigo-700 shadow-lg dark:border-indigo-900 dark:bg-gray-900 dark:text-indigo-200">
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
                className={`p-4 sm:p-5 rounded-lg bg-gradient-to-br ${stat.style.bg} shadow-md border ${stat.style.border} backdrop-blur-sm transition-shadow hover:shadow-lg`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`p-2.5 sm:p-3 ${stat.style.iconWrap} rounded-xl shrink-0`}>
                    <span className={stat.style.text}>{stat.icon}</span>
                  </div>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      String(stat.trend).startsWith("+")
                        ? "text-[var(--ms-success)] dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {String(stat.trend).startsWith("+") ? "↑" : "↓"} {stat.trend}
                  </span>
                </div>
                <h2 className="text-sm font-medium mt-3 text-[var(--ms-text)] dark:text-gray-300">
                  {stat.title}
                </h2>
                <p className={`mt-1 text-xl sm:text-2xl font-bold tabular-nums ${stat.style.text}`}>
                  {stat.value.toLocaleString("fr-FR")} <span className="text-sm font-normal opacity-90">CFA</span>
                </p>
                {stat.prevValue != null && (
                  <p className="mt-1.5 text-sm text-[var(--ms-text)] dark:text-[var(--ms-text-muted)] tabular-nums">
                    Vs période préc. : <span className="font-medium">{Number(stat.prevValue).toLocaleString("fr-FR")} CFA</span>
                  </p>
                )}
              </motion.article>
            ))}
          </motion.section>

          {/* ===== GRAPHIQUE FINANCIER — carte professionnelle ===== */}
          <section
            className={`relative overflow-hidden bg-[var(--ms-white)] dark:bg-gray-800/90 backdrop-blur-sm p-4 sm:p-5 rounded-lg shadow-md border border-[var(--ms-border)] dark:border-gray-700 transition-opacity ${
              chartLoading ? "opacity-60" : "opacity-100"
            }`}
            aria-label="Analyse financière"
          >
            <div className="absolute right-3 top-3 sm:right-4 sm:top-4 text-[10px] sm:text-xs px-2 py-1 rounded-full bg-[var(--ms-blue)] text-white font-medium">
              Comparaison {compareMode !== "none" ? "activée" : "désactivée"}
            </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 pr-24 sm:pr-28">
            <h2 className="text-lg font-semibold text-[var(--ms-text-strong)] dark:text-white">
              Analyse financière
            </h2>
            <button
              type="button"
              onClick={() => handleOpenDayDetails(today)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-[var(--ms-blue)] hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors"
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
              <article className="rounded-lg border border-emerald-200 bg-[var(--ms-success)]/5 to-[var(--ms-white)] p-4 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-gray-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {encaissementHighlights.bestLabel}
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--ms-text-strong)] dark:text-gray-100">
                  {encaissementHighlights.best.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {Math.round(encaissementHighlights.best.total).toLocaleString("fr-FR")} CFA
                </p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                  {encaissementHighlights.helperText}
                </p>
              </article>

              <article className="rounded-lg border border-rose-200 bg-[var(--ms-danger)]/5 to-[var(--ms-white)] p-4 shadow-sm dark:border-rose-900/60 dark:from-rose-950/30 dark:to-gray-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  {encaissementHighlights.lowestLabel}
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--ms-text-strong)] dark:text-gray-100">
                  {encaissementHighlights.lowest.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                  {Math.round(encaissementHighlights.lowest.total).toLocaleString("fr-FR")} CFA
                </p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                  {encaissementHighlights.helperText}
                </p>
              </article>
            </section>
          )}
        </div>

        {isAdmin && nonCriticalReady && (
          <section className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <Lightbulb size={20} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--ms-text-strong)] dark:text-white">
                      Suggestions pour vendre les produits lents
                    </h2>
                    <p className="text-sm text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                      Produits avec peu ou pas de ventes sur les 30 derniers jours.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-[11px] font-medium uppercase text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                    À traiter
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-[var(--ms-text-strong)] dark:text-white">
                    {productActionSuggestions.length}
                  </p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <p className="text-[11px] font-medium uppercase text-[var(--ms-danger)] dark:text-rose-300">
                    Urgent
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-rose-700 dark:text-rose-300">
                    {highPriorityProductSuggestions}
                  </p>
                </div>
                <div className="col-span-2 rounded-lg border border-indigo-200 bg-[var(--ms-blue-soft)] px-3 py-2 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                  <p className="text-[11px] font-medium uppercase text-[var(--ms-blue)] dark:text-indigo-300">
                    Stock concerné
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-indigo-700 dark:text-indigo-300">
                    {Math.round(productSuggestionStockValue).toLocaleString("fr-FR")} CFA
                  </p>
                </div>
              </div>
            </div>

            {productActionSuggestions.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
                {productActionSuggestions.slice(0, 6).map((product) => (
                  <article
                    key={product._id}
                    className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ms-text-strong)] dark:text-gray-100">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                          {product.category} • Stock {product.stock}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          priorityStyles[product.priority] || priorityStyles.low
                        }`}
                      >
                        {priorityLabel[product.priority] || priorityLabel.low}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-[var(--ms-white)] p-2 dark:bg-gray-800">
                        <p className="text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">Vendus</p>
                        <p className="mt-1 font-bold text-[var(--ms-text-strong)] dark:text-gray-100">
                          {product.sold}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--ms-white)] p-2 dark:bg-gray-800">
                        <p className="text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">Écoulement</p>
                        <p className="mt-1 font-bold text-[var(--ms-text-strong)] dark:text-gray-100">
                          {product.sellThroughRate}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--ms-white)] p-2 dark:bg-gray-800">
                        <p className="text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">Marge</p>
                        <p className="mt-1 font-bold text-[var(--ms-text-strong)] dark:text-gray-100">
                          {product.marginRate == null ? "N/A" : `${product.marginRate}%`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <p className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                        <BadgePercent size={14} />
                        {product.highlight}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {(product.actions || []).slice(0, 3).map((action) => (
                          <li
                            key={action}
                            className="flex gap-2 text-xs leading-5 text-[var(--ms-text)] dark:text-gray-300"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ms-warning)] dark:text-amber-300" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[var(--ms-text-strong)] dark:text-gray-100">
                        {Math.round(product.price || 0).toLocaleString("fr-FR")} CFA
                      </span>
                      <Link
                        to={`/products/${product._id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ms-blue)] hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                      >
                        Voir produit <ArrowRight size={15} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-[var(--ms-bg-subtle)] px-4 py-6 text-sm text-[var(--ms-text)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                Aucun produit lent détecté sur les 30 derniers jours.
              </div>
            )}

            {productActionSuggestions.length > 6 && (
              <div className="mt-4 flex justify-end">
                <Link
                  to="/product-dashboard"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[var(--ms-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Voir tout le dashboard produits <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </section>
        )}

        {isAdmin && nonCriticalReady && (
        <AccordionSection title="Statistiques des ventes" defaultOpenDesktop={true}>
        <motion.div
          className="overflow-hidden rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[var(--ms-shadow)] dark:border-gray-800 dark:bg-gray-900"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* 🔹 En-tête + contrôles (période + switch lissage + export ALL) */}
          <div className="border-b border-[var(--ms-border)] p-4 dark:border-gray-800 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ms-text-muted)]">
                Home analytics
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--ms-text-strong)] dark:text-white">
                Statistiques des ventes
              </h2>
              <p className="mt-1 text-sm text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                Tendance, encaissements, méthodes, statuts et top produits sur la période.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {/* Sélecteur de période (alimente /dashboard/data) */}
              <select
                value={salesStatsRange}
                onChange={(e) => setSalesStatsRange(e.target.value)}
                className="form-control min-h-[42px] text-sm sm:w-auto"
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
                className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5
                  ${smoothTrend
                    ? "border-gray-950 bg-gray-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] dark:border-white dark:bg-[var(--ms-white)] dark:text-[var(--ms-text-strong)]"
                    : "border-[var(--ms-border)] bg-[var(--ms-white)] text-[var(--ms-text)] hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"}`}
                title="Lisser la tendance (moyenne mobile 3 j)"
              >
                <Wand2 size={16} />
                {smoothTrend ? "Lissé" : "Lisser la tendance"}
              </button>

              {/* 🔹 Export ALL (toutes données) */}
              <button
                type="button"
                onClick={exportSalesStatsAll}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] transition-all hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-[var(--ms-white)] dark:text-[var(--ms-text-strong)] dark:hover:bg-gray-100"
                title="Exporter toutes les statistiques de ventes"
              >
                <Download size={16} />
                Export (ALL)
              </button>
            </div>
          </div>
          </div>

          <div className="p-4 sm:p-5">

          {/* 🔹 Label dynamique lissage */}
          {smoothTrend && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--ms-text)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Wand2 size={14} /> Tendance lissée (3 j)
              </span>
            </div>
          )}

          {bestDays && (
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <SalesInsightCard title="Meilleur jour de ventes" value={formatBestDay(bestDays.sales)} amount={bestDays.sales?.totalAmount} tone="emerald" icon={ShoppingCart} />
              <SalesInsightCard title="Meilleur jour d'encaissements" value={formatBestDay(bestDays.payments)} amount={bestDays.payments?.totalAmount} tone="blue" icon={Coins} />
              <SalesInsightCard title="Jour de dépense maximal" value={formatBestDay(bestDays.expenses)} amount={bestDays.expenses?.totalAmount} tone="rose" icon={TrendingDown} />
            </div>
          )}

          {/* Résumé compact + Encart livraisons à droite */}
          {salesStatsData && (
            <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {/* Résumé (4 cartes) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-4">
                <SalesMetricCard title="Total ventes" value={`${Math.round(salesStatsData.totalSales || 0).toLocaleString("fr-FR")} CFA`} icon={DollarSign} tone="emerald" />
                <SalesMetricCard title="Vente moyenne" value={`${Math.round(salesStatsData.averageSale || 0).toLocaleString("fr-FR")} CFA`} icon={TrendingUp} tone="blue" />
                <SalesMetricCard title="Produits vendus" value={salesStatsData.totalProducts || 0} icon={Package} tone="amber" />
                <SalesMetricCard title="Nombre de ventes" value={salesStatsData.salesCount || 0} icon={ShoppingCart} tone="violet" />
              </div>

              {/* 🔹 Encart livraisons à droite */}
              <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 dark:border-gray-700 dark:bg-gray-800/70 lg:col-span-1">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                  <Truck size={16} />
                  Livraisons
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-[var(--ms-white)] p-2.5 dark:border-emerald-500/20 dark:bg-gray-900">
                    <span className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <PackageCheck size={16} /> Livrées
                    </span>
                    <span className="font-semibold">
                      {deliveryStats?.delivered?.count || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-[var(--ms-white)] p-2.5 dark:border-amber-500/20 dark:bg-gray-900">
                    <span className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                      <Clock3 size={16} /> En attente
                    </span>
                    <span className="font-semibold">
                      {deliveryStats?.pending?.count || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-[var(--ms-white)] p-2.5 dark:border-rose-500/20 dark:bg-gray-900">
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
                <h3 className="text-sm font-semibold text-[var(--ms-text)] dark:text-gray-200">
                  Types de commandes et structure des paiements
                </h3>
                <span className="text-xs text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                  Très visible sur la période sélectionnée
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {highlightedSalesCards.map((card) => {
                  const cardContent = (
                    <div className="h-full rounded-[calc(1.5rem-1px)] bg-[var(--ms-white)] dark:bg-gray-900 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                        {card.title}
                      </p>
                      <div className={`mt-3 text-3xl font-black tabular-nums ${card.text}`}>
                        {card.count}
                      </div>
                      <p className="mt-1 text-sm text-[var(--ms-text)] dark:text-gray-300">
                        {card.amount.toLocaleString("fr-FR")} CFA
                      </p>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--ms-bg-subtle)] dark:bg-gray-800 px-3 py-2 text-xs">
                        <span className="text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">Part des ventes</span>
                        <span className={`font-semibold ${card.text}`}>
                          {card.percentage.toFixed(1)}%
                        </span>
                      </div>
                      {card.linkTo && (
                        <div className="mt-3 text-xs font-medium text-[var(--ms-blue)] dark:text-indigo-300">
                          Voir les ventes
                        </div>
                      )}
                    </div>
                  );

                  if (!card.linkTo) {
                    return (
                      <div
                        key={card.key}
                        className={`rounded-lg p-[1px] bg-gradient-to-br ${card.accent} shadow-md`}
                      >
                        {cardContent}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={card.key}
                      to={card.linkTo}
                      className={`block rounded-lg p-[1px] bg-gradient-to-br ${card.accent} shadow-md hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500`}
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
            <section className="mb-5 rounded-lg border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-500/20 dark:bg-rose-500/10 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ms-danger)] dark:text-rose-300">
                    À encaisser
                  </p>
                  <h3 className="mt-1 text-base font-bold text-rose-950 dark:text-rose-100">
                    Ventes sans aucun paiement
                  </h3>
                  <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-300/80">
                    Ventes créées sur la période sélectionnée sans paiement enregistré.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-[var(--ms-white)] px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm dark:bg-gray-900 dark:text-rose-300">
                    {neverPaidSales.count} vente{neverPaidSales.count > 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[var(--ms-white)] px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm dark:bg-gray-900 dark:text-rose-300">
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
                      className="rounded-lg border border-rose-200/80 bg-[var(--ms-white)] px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md dark:border-rose-500/20 dark:bg-gray-900 dark:hover:border-rose-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--ms-text-strong)] dark:text-gray-100">
                            {sale.client?.name || "Client non spécifié"}
                          </p>
                          <p className="text-xs text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)] mt-1">
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
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                          Ouvrir la vente
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-rose-200 bg-white/75 px-4 py-6 text-center text-sm text-[var(--ms-text)] dark:border-rose-500/20 dark:bg-gray-900/40 dark:text-gray-300">
                  Aucune vente sans paiement sur cette période.
                </div>
              )}
            </section>
          )}

          {/* 🔹 Sous-bloc "Encaissements" (paymentsTotal / paymentsCount) */}
          {salesStatsData?.paymentsSummary && (
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-[var(--ms-text)] dark:text-gray-200 mb-2 flex items-center gap-2">
                <Coins className="text-emerald-500" size={16} />
                Encaissements
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                  <DollarSign className="text-emerald-600" />
                  <div>
                    <p className="text-xs text-[var(--ms-text-muted)]">Montant total encaissé</p>
                    <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {Math.round(salesStatsData.paymentsSummary.paymentsTotal || 0).toLocaleString("fr-FR")}{" "}
                      CFA
                    </h3>
                  </div>
                </div>

                <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800 flex items-center gap-3">
                  <Coins className="text-cyan-600" />
                  <div>
                    <p className="text-xs text-[var(--ms-text-muted)]">Nombre de paiements</p>
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
            <div className="bg-[var(--ms-bg-subtle)] dark:bg-gray-900 p-4 rounded-lg border border-[var(--ms-border)] dark:border-gray-700">
              <h3 className="font-semibold mb-3 text-[var(--ms-text)] dark:text-gray-200 text-sm">
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
            <div className="bg-[var(--ms-bg-subtle)] dark:bg-gray-900 p-4 rounded-lg border border-[var(--ms-border)] dark:border-gray-700">
              <h3 className="font-semibold mb-3 text-[var(--ms-text)] dark:text-gray-200 text-sm">
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
          <div className="mt-4 bg-[var(--ms-bg-subtle)] dark:bg-gray-900 p-4 rounded-lg border border-[var(--ms-border)] dark:border-gray-700">
            <h3 className="font-semibold mb-3 text-[var(--ms-text)] dark:text-gray-200 text-sm">
              Top produits vendus
            </h3>
            <ul className="space-y-2">
              {(topProducts || []).map((p, i) => (
                <li
                  key={i}
                  className="flex justify-between text-sm bg-[var(--ms-white)] dark:bg-gray-800 p-2.5 rounded-xl border border-[var(--ms-border)] dark:border-gray-700"
                >
                  <span className="font-medium text-[var(--ms-text)] dark:text-gray-300">
                    {p.product?.name || "Produit"}
                  </span>
                  <span className="text-[var(--ms-text)] dark:text-[var(--ms-text-muted)]">
                    {p.quantity} vendus
                  </span>
                </li>
              ))}
              {(!topProducts || topProducts.length === 0) && (
                <div className="text-center text-[var(--ms-text-muted)] text-sm py-6">
                  Aucune donnée disponible
                </div>
              )}
            </ul>
          </div>
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
              onOpenDayDetails={handleOpenDayDetails}
            />
          </Suspense>
        )}

        {/* ===== Admin only ===== */}
        {isAdmin && nonCriticalReady && (
        <>
            {Object.values(bestDaysRanges).length > 0 && (
              <section className="overflow-hidden rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[0_20px_56px_rgba(15,23,42,0.07)] dark:border-gray-800 dark:bg-gray-900">
                <div className="border-b border-[var(--ms-border)] p-4 dark:border-gray-800 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ms-text-muted)]">
                    Performance par période
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[var(--ms-text-strong)] dark:text-white">
                    Meilleurs jours par plage
                  </h3>
                  <p className="mt-1 text-sm text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                    Les pics de ventes, d’encaissements et de dépenses pour chaque fenêtre suivie.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 p-4 sm:p-5">
                  {Object.values(bestDaysRanges).map((entry) => (
                    <article key={entry.label} className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3 dark:border-gray-700 dark:bg-gray-800/70 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ms-text-strong)] dark:text-white">{entry.label}</p>
                        <span className="rounded-full bg-[var(--ms-white)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ms-text-muted)] dark:bg-gray-900 dark:text-[var(--ms-text-muted)]">
                          Plage
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <StatCard
                          title="Ventes"
                          entry={entry.days?.sales}
                          accent="text-[var(--ms-success)] dark:text-green-300"
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
                    </article>
                  ))}
                </div>
              </section>
            )}
            <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} /></div>}>
              <RemindersPanel
                overdue={overdueReminders}
                upcoming={upcomingReminders}
                neverPaid={neverPaidReminders}
                salaryReminders={salaryReminders}
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
            startDate={exportStartDate || exportDescriptor.startValue}
            endDate={exportEndDate || exportDescriptor.endValue}
            onStartDateChange={handleExportStartDateChange}
            onEndDateChange={handleExportEndDateChange}
            exporting={isExportingDashboard}
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

const salesToneClasses = {
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
};

const SalesMetricCard = ({ title, value, icon: Icon, tone = "emerald" }) => (
  <motion.article
    whileHover={{ y: -2 }}
    className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
  >
    <div className="flex items-start justify-between gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${salesToneClasses[tone] || salesToneClasses.emerald}`}>
        <Icon size={18} />
      </span>
    </div>
    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)]">{title}</p>
    <p className="mt-2 text-lg font-bold text-[var(--ms-text-strong)] dark:text-white">{value}</p>
  </motion.article>
);

const SalesInsightCard = ({ title, value, amount, icon: Icon, tone = "emerald" }) => (
  <article className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)]">{title}</p>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${salesToneClasses[tone] || salesToneClasses.emerald}`}>
        <Icon size={17} />
      </span>
    </div>
    <p className="mt-3 text-sm font-semibold text-[var(--ms-text-strong)] dark:text-white">{value}</p>
    <p className={`mt-2 text-lg font-black tabular-nums ${tone === "rose" ? "text-rose-700 dark:text-rose-300" : tone === "blue" ? "text-blue-700 dark:text-blue-300" : "text-emerald-700 dark:text-emerald-300"}`}>
      {Math.round(amount || 0).toLocaleString("fr-FR")} CFA
    </p>
  </article>
);

const StatCard = ({ title, entry, accent }) => (
  <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-3 text-[11px] shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)]">{title}</div>
    <div className="mt-2 text-xs font-semibold text-[var(--ms-text-strong)] dark:text-gray-100">
      {entry?.date ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(entry.date)) : "—"}
    </div>
    <div className={`mt-1 text-sm font-bold ${accent}`}>
      {entry?.totalAmount ? `${Math.round(entry.totalAmount).toLocaleString("fr-FR")} CFA` : "—"}
    </div>
  </div>
);

export default Dashboard;
