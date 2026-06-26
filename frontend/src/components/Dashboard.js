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
  Area,
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
import { useAppSettings } from "../context/AppSettingsContext";
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
  BarChart2,
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
import { useFeature, LockedFeatureButton } from "./FeatureGate";
import { FEATURE_KEYS } from "../config/features";

const DayDetailsModal = lazy(() => import("./DayDetailsModal"));
const RemindersPanel = lazy(() => import("../components/RemindersPanel"));
const ExportModal = lazy(() => import("../components/ExportModal"));
const BusinessAnalyticsDashboard = lazy(() => import("../components/BusinessAnalyticsDashboard"));
const loadXlsx = () => import("xlsx");
const loadPdfTools = async () => {
  const [jsPDFModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return {
    jsPDF: jsPDFModule.jsPDF || jsPDFModule.default?.jsPDF || jsPDFModule.default,
    autoTable: autoTableModule.default || autoTableModule,
  };
};

const formatCfa = (value) =>
  `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} CFA`;

const CFA_EXCEL_FORMAT = '#,##0 "CFA"';

const cleanReportText = (value) => String(value || "").trim();

const getShopReportIdentity = (auth, appSettings) => {
  const tenant = auth?.tenant || {};
  const branding = appSettings?.branding || {};
  const name =
    cleanReportText(branding.appName) ||
    cleanReportText(tenant.name) ||
    "Boutique";

  return {
    name,
    tenantName: cleanReportText(tenant.name),
    code: cleanReportText(tenant.code),
    ownerName: cleanReportText(tenant.ownerName),
    ownerPhone: cleanReportText(tenant.ownerPhone),
    address: cleanReportText(branding.address),
    phone: cleanReportText(branding.supportPhone) || cleanReportText(tenant.ownerPhone),
    email: cleanReportText(branding.supportEmail) || cleanReportText(tenant.ownerEmail),
    plan: cleanReportText(tenant.plan),
  };
};

const applyCfaNumberFormat = (XLSX, worksheet, columns = []) => {
  if (!worksheet?.["!ref"] || !columns.length) return;
  const range = XLSX?.utils?.decode_range?.(worksheet["!ref"]);
  if (!range) return;

  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    columns.forEach((columnIndex) => {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (worksheet[cellAddress]) worksheet[cellAddress].z = CFA_EXCEL_FORMAT;
    });
  }
};

const formatReportDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy", { locale: fr });
};

const getClientName = (row) => {
  if (!row?.client) return "Client inconnu";
  if (typeof row.client === "string") return row.client;
  return row.client.name || "Client inconnu";
};

const Dashboard = () => {
  const { auth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const canExport = useFeature(FEATURE_KEYS.DATA_EXPORT); // bulk stats export — la facture de vente reste accessible à tous
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

  // ===== Delivery (utilisé dans l'encart du bloc Statistiques des ventes) =====
  const [deliveryStats, setDeliveryStats] = useState(null);

  // ===== Reminders / UI =====
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const dashboardDataLoadedRef = useRef(false);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [neverPaidReminders, setNeverPaidReminders] = useState([]);
  const [salaryReminders, setSalaryReminders] = useState([]);
  const [stockReplacementReminders, setStockReplacementReminders] = useState([]);
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
      (map[d] ||= { date: d, sales: 0, paid: 0, paidProfit: 0, expenses: 0 });

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
      const bucket = ensure(d);
      bucket.paid += p.amount || 0;
      // Realized (cash-basis) gross profit carried by this payment.
      bucket.paidProfit += p.profit || 0;
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
        // Sellers never see expenses/profit — skip the fetch entirely for them.
        isAdmin
          ? api.get(`/expenses/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}&summary=dashboard`)
          : Promise.resolve({ data: [] }),
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
        isAdmin
          ? api.get(`/expenses/date-range?startDate=${prev.start.toISOString()}&endDate=${prev.end.toISOString()}&summary=dashboard`)
          : Promise.resolve({ data: [] }),
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
      const stockResponse = await api.get("/stock-replacement-reminders");
      setStockReplacementReminders(stockResponse.data.reminders || []);
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
    if (!isAdmin) return undefined;

    const refreshRemindersAfterSale = () => {
      fetchReminders();
    };

    window.addEventListener("saleCreated", refreshRemindersAfterSale);
    return () => window.removeEventListener("saleCreated", refreshRemindersAfterSale);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchReminders intentionally reused for sale-created refresh
  }, [isAdmin]);

  // The global modals (FAB) create sales/payments/expenses from any page.
  // Refresh the dashboard data on those events so it's immediate — no reload.
  useEffect(() => {
    const refresh = () => {
      fetchData();
      fetchDeliveryStats();
      if (isAdmin) fetchReminders();
    };
    window.addEventListener("saleCreated", refresh);
    window.addEventListener("paymentCreated", refresh);
    window.addEventListener("expenseCreated", refresh);
    return () => {
      window.removeEventListener("saleCreated", refresh);
      window.removeEventListener("paymentCreated", refresh);
      window.removeEventListener("expenseCreated", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchReminders is stable enough for this refresh
  }, [fetchData, fetchDeliveryStats, isAdmin]);

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
      const prevProfit = (prev.paidProfit || 0) - (prev.expenses || 0);
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
  // Realized gross profit (cash-basis): margin actually collected via payments.
  const totalPaidProfit = useMemo(
    () => combinedData.reduce((s, d) => s + (d.paidProfit || 0), 0),
    [combinedData]
  );
  // Net profit = realized gross profit − expenses (cash-basis).
  const profit = totalPaidProfit - totalExpenses;

  // Totaux période comparée (pour cartes + tendance selon compareMode)
  const prevPeriodTotals = useMemo(() => {
    const s = prevCombinedData.reduce((sum, d) => sum + (d.sales || 0), 0);
    const p = prevCombinedData.reduce((sum, d) => sum + (d.paid || 0), 0);
    const pp = prevCombinedData.reduce((sum, d) => sum + (d.paidProfit || 0), 0);
    const e = prevCombinedData.reduce((sum, d) => sum + (d.expenses || 0), 0);
    return { sales: s, paid: p, paidProfit: pp, expenses: e, profit: pp - e };
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
    const prevWeekPayments = paymentsData.filter((p) => {
      const dt = p.paymentDate || p.createdAt;
      return new Date(dt) >= prevWeek.start && new Date(dt) <= prevWeek.end;
    });
    const prevPaid = prevWeekPayments.reduce((a, b) => a + (b.amount || 0), 0);
    const prevPaidProfit = prevWeekPayments.reduce((a, b) => a + (b.profit || 0), 0);
    const prevExp = expensesData
      .filter(
          (e) =>
          new Date(e.date || e.createdAt) >= prevWeek.start &&
          new Date(e.date || e.createdAt) <= prevWeek.end
      )
      .reduce((a, b) => a + (b.amount || 0), 0);
    return { s: prevSales, p: prevPaid, e: prevExp, pr: prevPaidProfit - prevExp };
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
      const exportTotalPaidProfit = exportCombinedData.reduce((sum, row) => sum + (row.paidProfit || 0), 0);
      const exportTotalExpenses = exportCombinedData.reduce((sum, row) => sum + (row.expenses || 0), 0);
      // Cash-basis: realized margin collected − expenses (matches the dashboard).
      const exportProfit = exportTotalPaidProfit - exportTotalExpenses;
      const shopInfo = getShopReportIdentity(auth, appSettings);

      const summaryRows = [
        {
          Boutique: shopInfo.name,
          "Nom tenant": shopInfo.tenantName || shopInfo.name,
          "Code boutique": shopInfo.code || "",
          Propriétaire: shopInfo.ownerName || "",
          Téléphone: shopInfo.phone || "",
          Email: shopInfo.email || "",
          Adresse: shopInfo.address || "",
          Filtre: "Période personnalisée",
          "Date début": startValue,
          "Date fin": endValue,
          "Total ventes": exportTotalSales,
          "Total encaissements": exportTotalPaid,
          "Bénéfice encaissé": Math.round(exportTotalPaidProfit),
          "Total dépenses": exportTotalExpenses,
          "Profit net": Math.round(exportProfit),
          "Lignes exportées": exportCombinedData.length,
        },
      ];
      const rows = exportCombinedData.map((d) => ({
        Date: format(new Date(d.date), "dd/MM/yyyy"),
        Ventes: d.sales,
        Encaissements: d.paid,
        "Bénéfice encaissé": Math.round(d.paidProfit || 0),
        Dépenses: d.expenses,
        "Profit net": Math.round((d.paidProfit || 0) - d.expenses),
      }));
      const wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const ws = XLSX.utils.json_to_sheet(rows);
      applyCfaNumberFormat(XLSX, summarySheet, [10, 11, 12, 13, 14]);
      applyCfaNumberFormat(XLSX, ws, [1, 2, 3, 4, 5]);
      summarySheet["!cols"] = [
        { wch: 24 },
        { wch: 24 },
        { wch: 14 },
        { wch: 22 },
        { wch: 18 },
        { wch: 28 },
        { wch: 32 },
        { wch: 22 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 22 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
      ];
      ws["!cols"] = [
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
      ];
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

  const exportDailyReportPdf = async () => {
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
      const [{ jsPDF, autoTable }, salesRes, expensesRes, paymentsRes] = await Promise.all([
        loadPdfTools(),
        api.get(`/sales/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}&summary=dashboard`),
        api.get(`/expenses/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}&summary=dashboard`),
        api.get(`/sales/payments/date-range?startDate=${start.toISOString()}&endDate=${end.toISOString()}&summary=dashboard`),
      ]);

      const reportSales = salesRes.data || [];
      const reportExpenses = expensesRes.data || [];
      const reportPayments = paymentsRes.data || [];
      const reportCombinedData = processCombinedData(reportSales, reportExpenses, reportPayments);

      const totalSalesAmount = reportCombinedData.reduce((sum, row) => sum + (Number(row.sales) || 0), 0);
      const totalPaidAmount = reportCombinedData.reduce((sum, row) => sum + (Number(row.paid) || 0), 0);
      const totalPaidProfit = reportCombinedData.reduce((sum, row) => sum + (Number(row.paidProfit) || 0), 0);
      const totalExpenseAmount = reportCombinedData.reduce((sum, row) => sum + (Number(row.expenses) || 0), 0);
      const netProfit = totalPaidProfit - totalExpenseAmount;

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;
      const shopInfo = getShopReportIdentity(auth, appSettings);
      const periodText = `${format(start, "dd/MM/yyyy", { locale: fr })} au ${format(end, "dd/MM/yyyy", { locale: fr })}`;
      const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr });
      const contactLine = [
        shopInfo.phone && `Tél : ${shopInfo.phone}`,
        shopInfo.email,
        shopInfo.address,
      ].filter(Boolean).join("   |   ");
      const metaLine = [
        shopInfo.code && `Code : ${shopInfo.code}`,
        shopInfo.ownerName && `Propriétaire : ${shopInfo.ownerName}`,
        shopInfo.plan && `Forfait : ${shopInfo.plan}`,
      ].filter(Boolean).join("   |   ");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Rapport d'activité", margin, 42);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(shopInfo.name, margin, 62);
      let headerY = 78;
      if (contactLine) {
        const contactLines = doc.splitTextToSize(contactLine, pageWidth - (margin * 2));
        doc.text(contactLines, margin, headerY);
        headerY += contactLines.length * 12 + 4;
      }
      if (metaLine) {
        const metaLines = doc.splitTextToSize(metaLine, pageWidth - (margin * 2));
        doc.text(metaLines, margin, headerY);
        headerY += metaLines.length * 12 + 4;
      }
      doc.text(`Période : ${periodText}`, margin, headerY);
      doc.text(`Généré le : ${generatedAt}`, pageWidth - margin, 42, { align: "right" });

      autoTable(doc, {
        startY: headerY + 20,
        theme: "grid",
        head: [["Ventes", "Encaissements", "Bénéfice encaissé", "Dépenses", "Profit net", "Ventes créées", "Paiements", "Dépenses"]],
        body: [[
          formatCfa(totalSalesAmount),
          formatCfa(totalPaidAmount),
          formatCfa(totalPaidProfit),
          formatCfa(totalExpenseAmount),
          formatCfa(netProfit),
          reportSales.length,
          reportPayments.length,
          reportExpenses.length,
        ]],
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [15, 108, 189] },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 18,
        head: [["Date", "Ventes", "Encaissements", "Bénéfice encaissé", "Dépenses", "Profit net"]],
        body: reportCombinedData.map((row) => [
          formatReportDate(row.date),
          formatCfa(row.sales),
          formatCfa(row.paid),
          formatCfa(row.paidProfit),
          formatCfa(row.expenses),
          formatCfa((row.paidProfit || 0) - (row.expenses || 0)),
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [32, 31, 30] },
        columnStyles: { 0: { cellWidth: 70 } },
      });

      const salesRows = reportSales.slice(0, 80).map((sale) => [
        formatReportDate(sale.saleDate || sale.createdAt),
        getClientName(sale),
        formatCfa(sale.totalAmount),
        sale.saleType || "normal",
        (sale.products || []).slice(0, 3).map((item) => {
          const productName = item.product?.name || "Produit";
          return `${productName} x${item.quantity || 0}`;
        }).join(", "),
      ]);

      if (salesRows.length > 0) {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 18,
          head: [["Ventes créées", "Client", "Montant", "Type", "Produits"]],
          body: salesRows,
          styles: { fontSize: 7.5, cellPadding: 3 },
          headStyles: { fillColor: [16, 124, 16] },
        });
      }

      const paymentRows = reportPayments.slice(0, 80).map((payment) => [
        formatReportDate(payment.paymentDate || payment.createdAt),
        getClientName(payment),
        payment.method || "—",
        formatCfa(payment.amount),
        formatCfa(payment.profit),
        payment.saleNumber || String(payment.saleId || "").slice(-6),
      ]);

      if (paymentRows.length > 0) {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 18,
          head: [["Encaissements", "Client", "Méthode", "Montant", "Bénéfice", "Vente"]],
          body: paymentRows,
          styles: { fontSize: 7.5, cellPadding: 3 },
          headStyles: { fillColor: [133, 92, 0] },
        });
      }

      const expenseRows = reportExpenses.slice(0, 80).map((expense) => [
        formatReportDate(expense.date || expense.createdAt),
        expense.category || "—",
        expense.description || expense.supplier || "Dépense",
        formatCfa(expense.amount),
      ]);

      if (expenseRows.length > 0) {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 18,
          head: [["Dépenses", "Catégorie", "Description", "Montant"]],
          body: expenseRows,
          styles: { fontSize: 7.5, cellPadding: 3 },
          headStyles: { fillColor: [196, 43, 28] },
        });
      }

      const pageCount = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(110);
        doc.text(`Page ${page}/${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 18, { align: "right" });
      }

      doc.save(`rapport-activite-${startValue}_to_${endValue}.pdf`);
      setShowExportMenu(false);
    } catch (error) {
      console.error("Export PDF dashboard échoué:", error);
      alert("Impossible de générer le rapport PDF.");
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
  // Two distinct breakdowns, each a 100% split (clearer than 4 mixed cards).
  const breakdownGroups = [
    {
      key: "type",
      title: "Types de commande",
      icon: ShoppingCart,
      segments: [
        { key: "normal", label: "Ventes normales", count: saleTypeSummary.normal?.count || 0, amount: saleTypeSummary.normal?.totalAmount || 0, color: "#0F6CBD" },
        { key: "wholesale", label: "Ventes en gros", count: saleTypeSummary.wholesale?.count || 0, amount: saleTypeSummary.wholesale?.totalAmount || 0, color: "#8B5CF6" },
      ],
    },
    {
      key: "payment",
      title: "Structure des paiements",
      icon: Coins,
      segments: [
        { key: "full_payment", label: "Paiement complet", count: paymentStructureSummary.full_payment?.count || 0, amount: paymentStructureSummary.full_payment?.totalAmount || 0, color: "#107C10", linkTo: "/sales/all?history=1&paymentStructure=full_payment" },
        { key: "multiple_payments", label: "Paiements multiples (crédit)", count: paymentStructureSummary.multiple_payments?.count || 0, amount: paymentStructureSummary.multiple_payments?.totalAmount || 0, color: "#C19C00", linkTo: "/sales/all?history=1&paymentStructure=multiple_payments" },
      ],
    },
  ];

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

      // Bénéfices (cash-basis / encaissé) — reuse the profit-analytics endpoint.
      try {
        const profitRes = await api.get(`/sales/profit-analytics?period=month`);
        const pdata = profitRes.data?.data || {};
        const gs = pdata.generalStats || {};
        const beneficeRows = [{
          "Chiffre d'affaires (CFA)": Math.round(gs.totalRevenue || 0),
          "Encaissé (CFA)": Math.round(gs.collectedRevenue || 0),
          "Bénéfice encaissé (CFA)": Math.round(gs.realizedProfit || 0),
          "Bénéfice attendu (CFA)": Math.round(gs.expectedProfit ?? gs.totalProfit ?? 0),
          "Marge encaissée (%)": Number(gs.realizedMargin || 0),
          "Pertes casse/cadeau (CFA)": Math.round(gs.lossCost || 0),
        }];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(beneficeRows), "Bénéfices");

        const beneficeTrendRows = (pdata.periodAnalytics || []).map((p) => ({
          Période: p._id,
          "Bénéfice attendu (CFA)": Math.round(p.totalProfit || 0),
          "Bénéfice encaissé (CFA)": Math.round(p.realizedProfit || 0),
          "Encaissé (CFA)": Math.round(p.collected || 0),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(beneficeTrendRows), "BénéficesTendance");

        const beneficeProductRows = (pdata.topProducts || []).map((p) => ({
          Produit: p.productName,
          "CA encaissé (CFA)": Math.round(p.totalRevenue || 0),
          "Bénéfice encaissé (CFA)": Math.round(p.totalProfit || 0),
          "Marge (%)": Number(p.profitMargin || 0),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(beneficeProductRows), "BénéficesProduits");
      } catch (profitErr) {
        console.warn("Bénéfices (encaissé) non inclus dans l'export:", profitErr);
      }

      XLSX.writeFile(
        wb,
        `stats-ventes-all-${format(new Date(), "yyyy-MM-dd")}.xlsx`
      );
    } catch (e) {
      console.error("Export stats ventes ALL échoué:", e);
      alert("Impossible d'exporter les statistiques (ALL).");
    }
  };

  // ===== LOADING =====
  if (loading)
    return (
      <div className="p-5 space-y-4">
        <div className="ms-loading-skeleton" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => <span key={i} />)}
        </div>
      </div>
    );

  const today = new Date();
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

  // ===== UI — styles des cartes principales (Fluent 2 tokens) =====
  const CARD_STYLES = [
    { iconBg: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }, // Ventes
    { iconBg: 'var(--ms-blue-soft)',                  color: 'var(--colorBrandForeground1)' },          // Encaissements
    { iconBg: 'var(--colorStatusDangerBackground1)',  color: 'var(--colorStatusDangerForeground1)' },   // Dépenses
    { iconBg: '#EDE9FE',                              color: '#6D28D9' },                               // Profit net
  ];

  return (
    <div className="min-h-full bg-[var(--ms-bg)] text-[var(--ms-text-strong)] dark:text-gray-100 transition-colors duration-300">
      <div className="space-y-6 sm:space-y-8">
        {/* ===== ACTIONS RAPIDES (mobile uniquement) ===== */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {[
            { to: "/sales#sale-form", label: "Vendre", icon: ShoppingCart, primary: true },
            { to: "/bank", label: "Caisse", icon: Landmark },
            { to: "/products", label: "Produits", icon: Package },
            { to: "/clients", label: "Clients", icon: UsersRound },
          ].map(({ to, label, icon: Icon, primary }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border shadow-sm transition active:scale-[0.98]"
              style={
                primary
                  ? { background: "var(--colorBrandBackground)", borderColor: "transparent", color: "#fff" }
                  : { background: "var(--ms-white)", borderColor: "var(--ms-border)", color: "var(--ms-text)" }
              }
            >
              <Icon size={26} strokeWidth={2} />
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>

        {/* ===== PAGES RATTACHÉES ===== */}
        <section className="fluent-card-filled p-4 sm:p-5 lg:p-6">
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
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorBrandBackground)', color: '#fff', boxShadow: 'var(--shadow8)' }}>
                    <Icon size={20} />
                  </span>
                  <span className="ms-status-badge ms-status-neutral">
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
        </section>

        {/* ===== CARTES PRINCIPALES (KPI) — responsive mobile/desktop ===== */}
        <div className="relative space-y-3 sm:space-y-4" aria-busy={chartLoading}>
          {chartLoading && (
            <div className="absolute inset-0 z-20 flex items-start justify-center rounded-lg bg-[var(--ms-white)]/55 pt-5 dark:bg-gray-950/35">
              <div className="rounded-full border border-[var(--ms-blue-soft)] bg-[var(--ms-white)] px-4 py-2 text-sm font-medium text-[var(--ms-blue-dark)] shadow-lg dark:border-[var(--ms-blue-dark)] dark:bg-gray-900 dark:text-[var(--ms-blue-soft)]">
                Mise à jour du graphique…
              </div>
            </div>
          )}

          <motion.section
            className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : ''} gap-3 sm:gap-4 transition-opacity ${
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
            ].filter((stat) => isAdmin || !["Dépenses", "Profit net"].includes(stat.title)).map((stat, i) => (
              <article key={i} className="fluent-card-filled p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]"
                    style={{ background: stat.style.iconBg, color: stat.style.color }}
                  >
                    {stat.icon}
                  </div>
                  <span
                    className="fui-caption1-strong shrink-0 inline-flex items-center gap-0.5"
                    style={{ color: String(stat.trend).startsWith('+') ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}
                  >
                    {String(stat.trend).startsWith('+') ? '↑' : '↓'} {stat.trend}
                  </span>
                </div>
                <h2 className="fui-caption1 mt-3" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {stat.title}
                </h2>
                <p className="mt-1 fui-title2 tabular-nums" style={{ color: stat.style.color }}>
                  {stat.value.toLocaleString('fr-FR')} <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>CFA</span>
                </p>
                {stat.prevValue != null && (
                  <p className="mt-1.5 fui-caption1 tabular-nums" style={{ color: 'var(--colorNeutralForeground3)' }}>
                    Vs période préc. : <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>{Number(stat.prevValue).toLocaleString('fr-FR')} CFA</span>
                  </p>
                )}
              </article>
            ))}
          </motion.section>

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
                  canExport ? (
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
                  ) : (
                    <LockedFeatureButton feature={FEATURE_KEYS.DATA_EXPORT} icon={<Download size={16} />}>Exporter</LockedFeatureButton>
                  )
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
                          className={`min-h-[38px] rounded-[var(--radiusLarge)] px-2 text-xs font-semibold transition-all duration-150 ${
                            isActive
                              ? "text-white shadow-[var(--shadow4)]"
                              : "text-[var(--colorNeutralForeground3)] hover:bg-[var(--colorNeutralBackground3)] hover:text-[var(--colorNeutralForeground1)]"
                          }`}
                          style={isActive ? { background: 'var(--colorBrandBackground)' } : {}}
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
                          className={`ms-button ms-button-sm text-left ${isActive ? 'ms-button-primary' : 'ms-button-secondary'}`}
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

          {/* ===== GRAPHIQUE FINANCIER — carte professionnelle (admin only) ===== */}
          {isAdmin && (
          <section
            className={`relative overflow-hidden fluent-card-filled p-4 sm:p-5 transition-opacity ${
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
              className="flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-[var(--ms-blue)] hover:bg-[var(--ms-blue-dark)] text-white rounded-xl font-medium text-sm transition-colors"
            >
              <CalendarDays size={18} /> Détails du jour
            </button>
          </div>

          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={mergedForChart}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                onClick={(state) => {
                  if (state && state.activeLabel) {
                    const clickedDate = new Date(state.activeLabel);
                    handleOpenDayDetails(clickedDate);
                  }
                }}
              >
                <defs>
                  <linearGradient id="finSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16A34A" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="finPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#EEF1F5"} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(new Date(d), "dd MMM", { locale: fr })}
                  tick={{ fontSize: 11, fill: darkMode ? "#9CA3AF" : "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 11, fill: darkMode ? "#9CA3AF" : "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(v, n) => [`${Number(v).toLocaleString("fr-FR")} CFA`, n]}
                  cursor={{ stroke: darkMode ? "#4B5563" : "#CBD5E1", strokeWidth: 1 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 10px 30px rgba(0,0,0,.12)",
                    backgroundColor: darkMode ? "#111827" : "#fff",
                    color: darkMode ? "#F9FAFB" : "#111827",
                    fontSize: 12,
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />

                {/* Période actuelle : aires dégradées + ligne dépenses */}
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Ventes (actuel)"
                  stroke="#16A34A"
                  strokeWidth={2.5}
                  fill="url(#finSales)"
                  activeDot={{ r: 4, cursor: "pointer" }}
                  cursor="pointer"
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  name="Encaissements (actuel)"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#finPaid)"
                  activeDot={{ r: 4, cursor: "pointer" }}
                  cursor="pointer"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Dépenses (actuel)"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
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
                      strokeDasharray="5 5"
                      dot={false}
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          </section>
          )}

          {encaissementHighlights && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3" aria-label="Extremes des encaissements">
              <article className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorStatusSuccessBackground1)', border: '1px solid var(--colorStatusSuccessStroke1)' }}>
                <p className="fui-caption1-strong uppercase" style={{ color: 'var(--colorStatusSuccessForeground1)', letterSpacing: '0.06em' }}>
                  {encaissementHighlights.bestLabel}
                </p>
                <p className="fui-subtitle1 mt-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  {encaissementHighlights.best.label}
                </p>
                <p className="fui-title3 mt-2 tabular-nums" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
                  {Math.round(encaissementHighlights.best.total).toLocaleString("fr-FR")} CFA
                </p>
                <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {encaissementHighlights.helperText}
                </p>
              </article>

              <article className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorStatusDangerBackground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>
                <p className="fui-caption1-strong uppercase" style={{ color: 'var(--colorStatusDangerForeground1)', letterSpacing: '0.06em' }}>
                  {encaissementHighlights.lowestLabel}
                </p>
                <p className="fui-subtitle1 mt-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  {encaissementHighlights.lowest.label}
                </p>
                <p className="fui-title3 mt-2 tabular-nums" style={{ color: 'var(--colorStatusDangerForeground1)' }}>
                  {Math.round(encaissementHighlights.lowest.total).toLocaleString("fr-FR")} CFA
                </p>
                <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {encaissementHighlights.helperText}
                </p>
              </article>
            </section>
          )}
        </div>

        {isAdmin && nonCriticalReady && (
          <section className="fluent-card-filled p-4 sm:p-5">
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
                <div className="rounded-[var(--radiusLarge)] px-3 py-2" style={{ background: 'var(--colorStatusDangerBackground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>
                  <p className="fui-caption1-strong uppercase" style={{ color: 'var(--colorStatusDangerForeground1)' }}>Urgent</p>
                  <p className="fui-subtitle1 mt-0.5 tabular-nums" style={{ color: 'var(--colorStatusDangerForeground1)' }}>
                    {highPriorityProductSuggestions}
                  </p>
                </div>
                <div className="col-span-2 rounded-[var(--radiusLarge)] px-3 py-2" style={{ background: 'var(--colorStatusInfoBackground1)', border: '1px solid rgba(15,108,189,0.2)' }}>
                  <p className="fui-caption1-strong uppercase" style={{ color: 'var(--colorBrandForeground1)' }}>Stock concerne</p>
                  <p className="fui-subtitle1 mt-0.5 tabular-nums" style={{ color: 'var(--colorBrandForeground1)' }}>
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

                    <div className="mt-3 rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--colorStatusWarningBackground1)', border: '1px solid var(--colorStatusWarningStroke1)' }}>
                      <p className="fui-caption1-strong flex items-center gap-2" style={{ color: 'var(--colorStatusWarningForeground1)' }}>
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
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] dark:text-[var(--ms-blue)] dark:hover:text-[var(--ms-blue-soft)]"
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
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[var(--ms-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--ms-blue-dark)]"
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
          className="overflow-hidden fluent-card-filled"
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

              <button
                type="button"
                onClick={() => setSmoothTrend((v) => !v)}
                className={`ms-button ms-button-sm flex items-center gap-2 ${smoothTrend ? 'ms-button-primary' : 'ms-button-secondary'}`}
                title="Lisser la tendance (moyenne mobile 3 j)"
              >
                <Wand2 size={15} />
                {smoothTrend ? "Lisse" : "Lisser"}
              </button>

              <button
                type="button"
                onClick={exportSalesStatsAll}
                className="ms-button ms-button-secondary ms-button-sm flex items-center gap-2"
                title="Exporter toutes les statistiques de ventes"
              >
                <Download size={15} />
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

          {/* Résumé compact + Encart livraisons à droite */}
          {salesStatsData && (
            <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {/* Résumé (cartes KPI unifiées) */}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 lg:col-span-4">
                <SalesMetricCard title="Nombre de ventes" value={salesStatsData.salesCount || 0} icon={ShoppingCart} tone="violet" />
                <SalesMetricCard title="Vente moyenne" value={`${Math.round(salesStatsData.averageSale || 0).toLocaleString("fr-FR")} CFA`} icon={TrendingUp} tone="blue" />
                <SalesMetricCard title="Produits vendus" value={salesStatsData.totalProducts || 0} icon={Package} tone="amber" />
                <SalesMetricCard
                  title="Montant encaissé"
                  value={`${Math.round(salesStatsData.paymentsSummary?.paymentsTotal || 0).toLocaleString("fr-FR")} CFA`}
                  icon={Coins}
                  tone="emerald"
                  sub={`${salesStatsData.paymentsSummary?.paymentsCount || 0} paiement${(salesStatsData.paymentsSummary?.paymentsCount || 0) > 1 ? "s" : ""}`}
                />
              </div>

              {/* 🔹 Encart livraisons à droite */}
              <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 dark:border-gray-700 dark:bg-gray-800/70 lg:col-span-1">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
                  <Truck size={16} />
                  Livraisons
                </h4>
                <div className="space-y-2 text-sm">
                  {[
                    { icon: PackageCheck, label: 'Livrees',      value: deliveryStats?.delivered?.count || 0,     bg: 'var(--colorStatusSuccessBackground1)', border: 'var(--colorStatusSuccessStroke1)', color: 'var(--colorStatusSuccessForeground1)' },
                    { icon: Clock3,       label: 'En attente',   value: deliveryStats?.pending?.count || 0,       bg: 'var(--colorStatusWarningBackground1)', border: 'var(--colorStatusWarningStroke1)', color: 'var(--colorStatusWarningForeground1)' },
                    { icon: XCircle,      label: 'Non livrees',  value: deliveryStats?.not_delivered?.count || 0, bg: 'var(--colorStatusDangerBackground1)',  border: 'var(--colorStatusDangerStroke1)',  color: 'var(--colorStatusDangerForeground1)' },
                  ].map(({ icon: Icon, label, value, bg, border, color }) => (
                    <div key={label} className="flex items-center justify-between rounded-[var(--radiusLarge)] p-2.5" style={{ background: bg, border: `1px solid ${border}` }}>
                      <span className="fui-caption1-strong flex items-center gap-2" style={{ color }}>
                        <Icon size={15} /> {label}
                      </span>
                      <span className="fui-subtitle2 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {salesStatsData && (
            <div className="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {breakdownGroups.map((group) => {
                const total = group.segments.reduce((s, x) => s + (x.amount || 0), 0);
                const totalCount = group.segments.reduce((s, x) => s + (x.count || 0), 0);
                const share = (x) => (total > 0 ? (x.amount || 0) / total * 100 : 0);
                const GroupIcon = group.icon;
                return (
                  <div key={group.key} className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                        <GroupIcon size={15} />
                      </span>
                      <h3 className="text-sm font-semibold text-[var(--ms-text)] dark:text-gray-200">{group.title}</h3>
                      <span className="ml-auto text-xs text-[var(--ms-text-muted)]">{totalCount} vente{totalCount > 1 ? 's' : ''}</span>
                    </div>

                    {/* Barre de répartition (100%) */}
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--ms-bg-subtle)' }}>
                      {group.segments.map((s) => (
                        <div key={s.key} style={{ width: `${share(s)}%`, background: s.color }} title={`${s.label} — ${share(s).toFixed(0)}%`} />
                      ))}
                    </div>

                    {/* Légende détaillée */}
                    <div className="mt-3 space-y-1">
                      {group.segments.map((s) => {
                        const row = (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                                <span className="truncate text-sm font-medium text-[var(--ms-text)] dark:text-gray-200">{s.label}</span>
                              </span>
                              <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: s.color }}>{share(s).toFixed(0)}%</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 pl-[18px] text-xs text-[var(--ms-text-muted)]">
                              <span className="font-semibold text-[var(--ms-text)] dark:text-gray-300">{s.count}</span> vente{s.count > 1 ? 's' : ''}
                              <span className="text-gray-300">·</span>
                              {Math.round(s.amount).toLocaleString("fr-FR")} CFA
                              {s.linkTo && <span className="ml-auto font-medium text-[var(--ms-blue)] dark:text-[var(--ms-blue)]">Voir →</span>}
                            </div>
                          </>
                        );
                        return s.linkTo ? (
                          <Link key={s.key} to={s.linkTo} className="block rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-[var(--ms-bg-subtle)]" aria-label={`Voir les ventes : ${s.label}`}>
                            {row}
                          </Link>
                        ) : (
                          <div key={s.key} className="px-1.5 py-1">{row}</div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grilles condensées : Tendance | Statuts | Top produits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* 🔹 Tendance des ventes (+ lissage) */}
            <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                  <TrendingUp size={15} />
                </span>
                <h3 className="text-sm font-semibold text-[var(--ms-text)] dark:text-gray-200">Tendance des ventes</h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendDataDisplay} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--colorNeutralStroke2)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => Number(v).toLocaleString("fr-FR")} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--colorNeutralStroke2)', fontSize: 12 }}
                      formatter={(v) => [`${Number(v).toLocaleString("fr-FR")} CFA`, 'Ventes']}
                    />
                    <Line type="monotone" dataKey="total" stroke="#0F6CBD" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Statuts des ventes */}
            <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}>
                  <BarChart2 size={15} />
                </span>
                <h3 className="text-sm font-semibold text-[var(--ms-text)] dark:text-gray-200">Statuts des ventes</h3>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--colorNeutralStroke2)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => Number(v).toLocaleString("fr-FR")} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--colorNeutralStroke2)', fontSize: 12 }}
                      formatter={(v) => [`${Number(v).toLocaleString("fr-FR")} CFA`, 'Total']}
                    />
                    <Bar dataKey="total" fill="#107C10" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top produits */}
          <div className="mt-4 bg-[var(--ms-bg-subtle)] dark:bg-gray-900 p-4 rounded-lg border border-[var(--ms-border)] dark:border-gray-700">
            <h3 className="font-semibold mb-3 text-[var(--ms-text)] dark:text-gray-200 text-sm">
              Top produits vendus
            </h3>
            {(topProducts && topProducts.length > 0) ? (
              <ul className="space-y-2">
                {(() => {
                  const maxQty = Math.max(1, ...topProducts.map((p) => Number(p.quantity) || 0));
                  const rankBg = ["#F59E0B", "#9CA3AF", "#B45309"]; // gold / silver / bronze
                  return topProducts.map((p, i) => {
                    const qty = Number(p.quantity) || 0;
                    const pct = Math.round((qty / maxQty) * 100);
                    return (
                      <li key={i} className="rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)] p-2.5 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ background: rankBg[i] || "var(--colorNeutralForeground3)" }}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ms-text)] dark:text-gray-300">
                            {p.product?.name || "Produit"}
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--ms-text-strong)] dark:text-white">
                            {qty} <span className="text-xs font-normal text-[var(--ms-text-muted)]">vendus</span>
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--ms-bg-subtle)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--colorBrandBackground)" }} />
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
            ) : (
              <div className="text-center text-[var(--ms-text-muted)] text-sm py-6">
                Aucune donnée disponible
              </div>
            )}
          </div>
          </div>
        </motion.div>
        </AccordionSection>
        )}

        {isAdmin && nonCriticalReady && (
          <AccordionSection title="Analyse avancée" defaultOpenDesktop={true}>
            <div className="p-4 sm:p-0">
              <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} /></div>}>
                <BusinessAnalyticsDashboard
                  sales={salesData}
                  expenses={expensesData}
                  payments={paymentsData}
                  defaultPeriod="month"
                  onOpenDayDetails={handleOpenDayDetails}
                />
              </Suspense>
            </div>
          </AccordionSection>
        )}

        {/* ===== Admin only ===== */}
        {isAdmin && nonCriticalReady && (
        <>
            {Object.values(bestDaysRanges).length > 0 && (
              <PerformanceByPeriod ranges={bestDaysRanges} />
            )}
            <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} /></div>}>
              <RemindersPanel
                overdue={overdueReminders}
                upcoming={upcomingReminders}
                neverPaid={neverPaidReminders}
                salaryReminders={salaryReminders}
                stockReplacementReminders={stockReplacementReminders}
                onStockReplacementConfirmed={(id) => {
                  setStockReplacementReminders((prev) => prev.filter((reminder) => reminder._id !== id));
                }}
                shopName={auth?.tenant?.name || ""}
                dialCode={auth?.tenant?.dialCode || ""}
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
            onPdfExport={exportDailyReportPdf}
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
  blue: "border-[var(--ms-blue-soft)] bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)] dark:border-[var(--ms-blue)] dark:bg-[var(--ms-blue)] dark:text-[var(--ms-blue)]",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
};

const SalesMetricCard = ({ title, value, icon: Icon, tone = "emerald", sub }) => (
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
    {sub && <p className="mt-0.5 text-[11px] text-[var(--ms-text-muted)]">{sub}</p>}
  </motion.article>
);

/* ===== Performance par période — meilleurs jours par plage (redesign) ===== */
const PERF_RANGES = [
  { key: "7days", label: "7 jours" },
  { key: "30days", label: "30 jours" },
  { key: "year", label: "Année" },
];

const PERF_METRICS = [
  { key: "sales", label: "Ventes", noun: "vente", icon: ShoppingCart, goodWhenUp: true,
    bg: "var(--colorStatusSuccessBackground1)", fg: "var(--colorStatusSuccessForeground1)" },
  { key: "payments", label: "Encaissements", noun: "paiement", icon: Coins, goodWhenUp: true,
    bg: "var(--ms-blue-soft)", fg: "var(--colorBrandForeground1)" },
  { key: "expenses", label: "Dépenses", noun: "dépense", icon: TrendingDown, goodWhenUp: false,
    bg: "var(--colorStatusDangerBackground1)", fg: "var(--colorStatusDangerForeground1)" },
  { key: "paidProfit", label: "Bénéfice encaissé", noun: "paiement", icon: BadgePercent, goodWhenUp: true,
    bg: "rgba(124,58,237,0.12)", fg: "#7C3AED" },
  { key: "expectedProfit", label: "Bénéfice attendu", noun: "vente", icon: TrendingUp, goodWhenUp: true,
    bg: "rgba(14,116,144,0.12)", fg: "#0e7490" },
];

const PerfTile = ({ meta, entry, total = 0, prevTotal }) => {
  const Icon = meta.icon;
  const hasTotal = total > 0;
  const hasRecord = entry && entry.totalAmount > 0;
  const recordDate = hasRecord
    ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(entry.date))
    : null;

  // Trend vs previous window
  const hasPrev = prevTotal != null && prevTotal > 0;
  const deltaPct = hasPrev ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const up = deltaPct != null && deltaPct >= 0;
  const good = deltaPct == null ? null : (meta.goodWhenUp ? up : !up);
  const trendColor = good == null ? "var(--ms-text-muted)"
    : good ? "var(--colorStatusSuccessForeground1)" : "var(--colorStatusDangerForeground1)";

  return (
    <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: meta.bg, color: meta.fg }}>
            <Icon size={18} />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">{meta.label}</p>
        </div>
        {deltaPct != null && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
            style={{ color: trendColor, background: "var(--ms-bg-subtle)" }}
            title="vs période précédente"
          >
            {up ? "▲" : "▼"} {Math.abs(deltaPct)}%
          </span>
        )}
      </div>

      <p className="mt-3 text-xl font-bold tabular-nums" style={{ color: hasTotal ? meta.fg : "var(--ms-text-muted)" }}>
        {hasTotal ? `${Math.round(total).toLocaleString("fr-FR")} CFA` : "—"}
      </p>
      <p className="text-[11px] text-[var(--ms-text-muted)]">Total de la période</p>

      <div className="mt-3 border-t border-[var(--ms-border)] pt-2 dark:border-gray-700">
        {hasRecord ? (
          <p className="text-[11px] text-[var(--ms-text-muted)]">
            <span className="font-semibold capitalize text-[var(--ms-text)] dark:text-gray-300">Record : {recordDate}</span>
            {" · "}{Math.round(entry.totalAmount).toLocaleString("fr-FR")} CFA
            {entry.count > 0 ? ` (${entry.count} ${meta.noun}${entry.count > 1 ? "s" : ""})` : ""}
          </p>
        ) : (
          <p className="text-[11px] text-[var(--ms-text-muted)]">Aucun jour sur la période</p>
        )}
      </div>
    </div>
  );
};

const PerformanceByPeriod = ({ ranges }) => {
  const available = PERF_RANGES.filter((r) => ranges[r.key]);
  const [active, setActive] = useState("30days");
  const activeKey = ranges[active] ? active : available[0]?.key;
  const days = ranges[activeKey]?.days || {};
  const activeLabel = (PERF_RANGES.find((r) => r.key === activeKey) || {}).label || "";

  return (
    <section className="overflow-hidden fluent-card-filled">
      <div className="flex flex-col gap-3 border-b border-[var(--ms-border)] p-4 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ms-text-muted)]">
            Performance par période
          </p>
          <h3 className="mt-1 text-lg font-bold text-[var(--ms-text-strong)] dark:text-white">
            Totaux, évolution & jours record
          </h3>
          <p className="mt-1 text-sm text-[var(--ms-text-muted)] dark:text-[var(--ms-text-muted)]">
            Sur les {activeLabel.toLowerCase()} : total par indicateur, évolution vs période précédente, et votre jour record.
          </p>
        </div>

        {/* Segmented range selector */}
        <div className="inline-flex shrink-0 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-1 dark:border-gray-700 dark:bg-gray-800">
          {available.map((r) => {
            const isActive = r.key === activeKey;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setActive(r.key)}
                className={`min-h-[34px] rounded-[var(--radiusMedium)] px-3 text-xs font-semibold transition-colors ${
                  isActive ? "text-white shadow-sm" : "text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]"
                }`}
                style={isActive ? { background: "var(--colorBrandBackground)" } : {}}
                aria-pressed={isActive}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5 sm:p-5">
        {PERF_METRICS.map((meta) => (
          <PerfTile
            key={meta.key}
            meta={meta}
            entry={days[meta.key]}
            total={days.totals?.[meta.key] || 0}
            prevTotal={days.previousTotals?.[meta.key]}
          />
        ))}
      </div>
    </section>
  );
};

export default Dashboard;
