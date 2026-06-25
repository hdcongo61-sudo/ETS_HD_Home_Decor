import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  lazy,
  Suspense,
  useRef,
} from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  Banknote,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Crown,
  Download,
  Lock,
  Gem,
  ReceiptText,
  Repeat2,
  TrendingUp,
  TrendingDown,
  Percent,
  Coins,
  Package,
  PackageMinus,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import AuthContext from "../context/AuthContext";
import ChartSetup from "../components/ChartSetup";
import useAutoClearMessage from "../hooks/useAutoClearMessage";
import useResponsiveTable from "../hooks/useResponsiveTable";
import {
  calculateSaleTotals,
  calculateSaleProfit,
  calculateSaleMargin,
  deriveProfitCategoryFromMargin,
  formatDate,
  getPaymentStructureKey,
  getStatusClass,
  getStatusText,
  getProfitCategoryClass,
  getProfitCategoryText,
  parseDateSafely,
} from "../utils/saleUtils";
import { SalesFiltersBar, SaleCard, SalesListExportButtons } from "./sales-shared";
import AppLoader from "../components/AppLoader";
import {
  Button,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  Workspace,
} from "../components/business";
import { useFeature, UpgradeModal, LockedFeatureButton } from "../components/FeatureGate";
import { FEATURE_KEYS } from "../config/features";

// Lazy components
const SaleForm = lazy(() => import("../components/SaleForm"));
const ExportSales = lazy(() => import("../components/ExportSales"));
const ExportSalesPdf = lazy(() => import("../components/ExportSalesPdf"));
const PaymentModal = lazy(() => import("../components/PaymentModal"));
const ProformaHistory = lazy(() => import("../components/ProformaHistory"));

/* ===============================
   Utilitaires
   =============================== */
const getTodayFilterValue = () => new Date().toLocaleDateString("fr-CA");

const buildSalesReturnSearch = ({
  statusFilter,
  clientFilter,
  saleTypeFilter,
  paymentStructureFilter,
  dateFilter,
  deliveryFilter,
  containerFilter,
  sellerFilter,
}) => {
  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (clientFilter) params.set("client", clientFilter);
  if (saleTypeFilter) params.set("saleType", saleTypeFilter);
  if (paymentStructureFilter) params.set("paymentStructure", paymentStructureFilter);
  if (dateFilter) params.set("date", dateFilter);
  if (deliveryFilter) params.set("delivery", deliveryFilter);
  if (containerFilter) params.set("container", containerFilter);
  if (sellerFilter) params.set("seller", sellerFilter);
  const query = params.toString();
  return query ? `?${query}` : "";
};

const normalizeCollection = (value, nestedKeys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of nestedKeys) {
    if (Array.isArray(value?.[key])) {
      return value[key];
    }
  }
  return [];
};

const getSaleSellerId = (sale) => {
  if (!sale?.user) return "";
  return typeof sale.user === "object" ? String(sale.user._id || sale.user.id || "") : String(sale.user);
};

const getSaleSellerName = (sale) => {
  if (!sale?.user || typeof sale.user !== "object") return "";
  return sale.user.name || sale.user.email || "";
};

/* ===============================
   Sous-composants UI
   =============================== */
const GlassCard = ({ children, className = "" }) => (
  <div className={`fluent-card-filled ${className}`}>{children}</div>
);

// Mobile-only segmented control (< lg) to switch between the sale form and the
// history list, so sellers don't have to scroll past the long form on a phone.
const MobilePanelToggle = ({ value, onChange, className = "" }) => {
  const tabs = [
    { key: "form", label: "Nouvelle vente" },
    { key: "history", label: "Historique" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Affichage des ventes"
      className={`lg:hidden grid grid-cols-2 gap-1 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] p-1 ${className}`}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`min-h-[40px] rounded-[var(--radiusMedium)] text-sm font-semibold transition-colors ${
            value === t.key
              ? "bg-[var(--ms-blue)] text-white shadow-[var(--ms-shadow-sm)]"
              : "text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

const truncateLabel = (str, max = 14) =>
  typeof str === "string" && str.length > max ? str.slice(0, max) + "…" : str || "";
const CHART_LABEL_FONT = { size: 10, family: "system-ui" };

// Payment-method display (label + Fluent status tone) for the encaissements modal.
const PAYMENT_METHOD_META = {
  cash:         { label: "Espèces",      cls: "ms-status-success" },
  especes:      { label: "Espèces",      cls: "ms-status-success" },
  "espèces":    { label: "Espèces",      cls: "ms-status-success" },
  mobile_money: { label: "Mobile Money", cls: "ms-status-neutral" },
  mobile:       { label: "Mobile Money", cls: "ms-status-neutral" },
  momo:         { label: "Mobile Money", cls: "ms-status-neutral" },
  card:         { label: "Carte",        cls: "ms-status-neutral" },
  carte:        { label: "Carte",        cls: "ms-status-neutral" },
  bank:         { label: "Virement",     cls: "ms-status-neutral" },
  virement:     { label: "Virement",     cls: "ms-status-neutral" },
  cheque:       { label: "Chèque",       cls: "ms-status-neutral" },
  "chèque":     { label: "Chèque",       cls: "ms-status-neutral" },
};
const paymentMethodMeta = (method) => {
  const key = String(method || "").toLowerCase().trim();
  return PAYMENT_METHOD_META[key] || { label: method || "Autre", cls: "ms-status-neutral" };
};

const StatCard = ({ title, value, icon, color = "bg-slate-100 text-slate-700" }) => (
  <KPICard title={title} value={value} context="Période sélectionnée" icon={React.isValidElement(icon) ? icon : null} />
);

const METRIC_TONES = {
  brand:   { bg: 'var(--ms-blue-soft)',                  color: 'var(--colorBrandForeground1)' },
  success: { bg: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' },
  warning: { bg: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' },
  neutral: { bg: 'var(--colorNeutralBackground3)',       color: 'var(--colorNeutralForeground2)' },
};

const AdvancedMetricCard = ({ title, value, change, icon, description, tone = 'brand' }) => {
  const t = METRIC_TONES[tone] || METRIC_TONES.brand;
  const hasChange = change !== undefined && change !== null;
  const up = Number(change) >= 0;
  return (
    <div className="fluent-card-filled p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: t.bg, color: t.color }}>
          {icon}
        </div>
        {hasChange && (
          <span className="fui-caption1-strong inline-flex items-center gap-0.5" style={{ color: up ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
            {up ? '↑' : '↓'} {up ? '+' : ''}{typeof change === 'number' ? change.toFixed(1) : change}%
          </span>
        )}
      </div>
      <p className="ms-kpi-title mt-3">{title}</p>
      <p className="ms-kpi-value" style={{ fontSize: 22 }}>{value}</p>
      {description && <p className="ms-kpi-context">{description}</p>}
    </div>
  );
};

// Stable French segment metadata (label, brand-aligned color, order).
const SEGMENT_META = {
  VIP:      { label: 'VIP',      color: '#7c3aed' },
  Fidèle:   { label: 'Fidèle',   color: '#0f6cbd' },
  Régulier: { label: 'Régulier', color: '#0e7490' },
  Nouveau:  { label: 'Nouveau',  color: '#107c10' },
  Inactif:  { label: 'Inactif',  color: '#a19f9d' },
  Perdu:    { label: 'Perdu',    color: '#c50f1f' },
};
const segmentColor = (seg) => SEGMENT_META[seg]?.color || '#8a8886';

const ClientSegmentationChart = ({ segmentation }) => {
  const counts = segmentation.reduce((acc, c) => {
    acc[c.segment] = (acc[c.segment] || 0) + 1;
    return acc;
  }, {});
  const labels = Object.keys(counts);
  const data = {
    labels,
    datasets: [
      {
        data: labels.map((l) => counts[l]),
        backgroundColor: labels.map(segmentColor),
        borderWidth: 0,
      },
    ],
  };
  return (
    <div className="h-64">
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: { legend: { position: "bottom", labels: { font: CHART_LABEL_FONT, usePointStyle: true, padding: 14 } } },
        }}
      />
    </div>
  );
};

const ProductPerformanceChart = ({ products }) => {
  const data = {
    labels: products.slice(0, 6).map((p) => truncateLabel(p.product?.name || "Produit", 12)),
    datasets: [
      {
        label: "Revenus (CFA)",
        data: products.slice(0, 6).map((p) => p.quantity * (p.product?.price || 0)),
        backgroundColor: "#0f6cbd",
        borderRadius: 6,
        maxBarThickness: 38,
      },
    ],
  };
  return (
    <div className="h-56 sm:h-64 min-h-[200px]">
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, font: CHART_LABEL_FONT, maxTicksLimit: 8 } },
            y: { ticks: { font: CHART_LABEL_FONT } },
          },
        }}
      />
    </div>
  );
};

const SEGMENT_ICONS = {
  VIP: Crown,
  Fidèle: Award,
  Régulier: Repeat2,
  Nouveau: UserPlus,
  Inactif: Clock3,
  Perdu: AlertTriangle,
};

const formatRecency = (days) => {
  if (days == null) return "—";
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30) return `il y a ${days} j`;
  if (days < 365) return `il y a ${Math.round(days / 30)} mois`;
  return `il y a ${Math.round(days / 365)} an(s)`;
};

const ClientAnalysisPanel = ({ segmentation, navigate }) => {
  const totalClients = segmentation.length;
  const grandSpent = segmentation.reduce((s, c) => s + (c.totalSpent || 0), 0);

  const bySegment = segmentation.reduce((acc, c) => {
    const k = c.segment || "Nouveau";
    if (!acc[k]) acc[k] = { count: 0, spent: 0 };
    acc[k].count += 1;
    acc[k].spent += c.totalSpent || 0;
    return acc;
  }, {});
  const orderedSegments = Object.keys(SEGMENT_META).filter((s) => bySegment[s]);
  const topClients = segmentation.slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Cartes récapitulatives par segment */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {orderedSegments.map((seg) => {
          const Icon = SEGMENT_ICONS[seg] || Users;
          const m = bySegment[seg];
          const share = totalClients ? Math.round((m.count / totalClients) * 100) : 0;
          const color = segmentColor(seg);
          return (
            <div key={seg} className="fluent-card-filled p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: `${color}1f`, color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{share}%</span>
              </div>
              <p className="ms-kpi-title mt-3">{SEGMENT_META[seg]?.label || seg}</p>
              <p className="ms-kpi-value" style={{ fontSize: 22 }}>{m.count}</p>
              <p className="ms-kpi-context">{Math.round(m.spent).toLocaleString("fr-FR")} CFA</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Répartition */}
        <div className="fluent-card-filled p-5 lg:col-span-2">
          <h3 className="fui-subtitle2 mb-1" style={{ color: 'var(--colorNeutralForeground1)' }}>Répartition des segments</h3>
          <p className="fui-caption1 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }}>
            {totalClients} clients · {Math.round(grandSpent).toLocaleString("fr-FR")} CFA
          </p>
          <ClientSegmentationChart segmentation={segmentation} />
        </div>

        {/* Meilleurs clients */}
        <div className="fluent-card-filled p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Meilleurs clients</h3>
            <button onClick={() => navigate("/clients")} className="ms-button ms-button-secondary ms-button-sm">
              Tous les clients →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium text-right">Total dépensé</th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">Achats</th>
                  <th className="pb-2 font-medium text-right">Dernier achat</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: segmentColor(c.segment) }} />
                        <div className="min-w-0">
                          <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{c.client?.name || "Client"}</p>
                          <span className="fui-caption1" style={{ color: segmentColor(c.segment) }}>{SEGMENT_META[c.segment]?.label || c.segment}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-right fui-body1-strong whitespace-nowrap" style={{ color: 'var(--colorNeutralForeground1)' }}>
                      {Math.round(c.totalSpent).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2.5 text-right hidden sm:table-cell" style={{ color: 'var(--colorNeutralForeground2)' }}>{c.purchaseCount}</td>
                    <td className="py-2.5 text-right fui-caption1 whitespace-nowrap" style={{ color: 'var(--colorNeutralForeground3)' }}>{formatRecency(c.recency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ===============================
   Analytics bénéfices (réutilisable)
   =============================== */
const ProfitAnalysis = () => {
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [containers, setContainers] = useState([]);
  const [filters, setFilters] = useState({
    period: "month",
    startDate: "",
    endDate: "",
    category: "",
    container: "",
  });

  useEffect(() => {
    api.get("/lookups/containers").then((r) => setContainers(r.data || [])).catch(() => {});
  }, []);

  const fetchProfitData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const { data } = await api.get(`/sales/profit-analytics?${params}`);
      setProfitData(data?.data || null);
    } catch (e) {
      console.error("Erreur chargement bénéfices:", e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProfitData();
  }, [fetchProfitData]);

  const setFilter = (k, v) => setFilters((p) => ({ ...p, [k]: v }));
  const resetFilters = () => setFilters({ period: "month", startDate: "", endDate: "", category: "", container: "" });

  const cfa = (v) => `${Math.round(Number(v) || 0).toLocaleString("fr-FR")} CFA`;
  const pctOf = (v) => `${Number(v || 0).toFixed(1)} %`;

  const PERIODS = [
    { value: "day", label: "Jour" },
    { value: "week", label: "Semaine" },
    { value: "month", label: "Mois" },
    { value: "year", label: "Année" },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (!profitData) {
    return (
      <EmptyState title="Analyse indisponible" description="Impossible de charger l'analyse des bénéfices." />
    );
  }

  const { periodAnalytics = [], topProducts = [], generalStats = {}, profitByCategory = [], profitByContainer = [] } = profitData;
  const gs = generalStats;

  const trendChart = {
    labels: periodAnalytics.map((i) => i._id),
    datasets: [
      {
        type: "bar",
        label: "Chiffre d'affaires",
        data: periodAnalytics.map((i) => i.totalSales || 0),
        backgroundColor: "rgba(15,108,189,0.18)",
        borderColor: "rgba(15,108,189,0.5)",
        borderWidth: 1,
        yAxisID: "y",
        order: 2,
      },
      {
        type: "bar",
        label: "Bénéfice attendu",
        data: periodAnalytics.map((i) => i.totalProfit || 0),
        backgroundColor: "rgba(16,124,16,0.28)",
        borderColor: "rgba(16,124,16,0.6)",
        borderWidth: 1,
        yAxisID: "y",
        order: 2,
      },
      {
        type: "bar",
        label: "Bénéfice encaissé",
        data: periodAnalytics.map((i) => i.realizedProfit || 0),
        backgroundColor: "rgba(16,124,16,0.85)",
        borderColor: "rgb(16,124,16)",
        borderWidth: 1,
        yAxisID: "y",
        order: 1,
      },
      {
        type: "line",
        label: "Marge (%)",
        data: periodAnalytics.map((i) => i.margin || 0),
        borderColor: "rgb(234,88,12)",
        backgroundColor: "rgb(234,88,12)",
        tension: 0.35,
        yAxisID: "y1",
        order: 0,
        pointRadius: 2,
      },
    ],
  };

  const topProductsChart = {
    labels: topProducts.slice(0, 8).map((p) => truncateLabel(p.productName, 14)),
    datasets: [
      {
        label: "Bénéfice (CFA)",
        data: topProducts.slice(0, 8).map((p) => p.totalProfit || 0),
        backgroundColor: "rgba(16,124,16,0.8)",
        borderRadius: 6,
      },
    ],
  };

  const categoryChart = {
    labels: profitByCategory.slice(0, 6).map((c) => c._id || "Non catégorisé"),
    datasets: [
      {
        data: profitByCategory.slice(0, 6).map((c) => c.totalProfit || 0),
        backgroundColor: ["#0F6CBD", "#107C10", "#EA580C", "#7C3AED", "#D13438", "#605E5C"],
      },
    ],
  };

  const lossCost = gs.lossCost || 0;
  const netProfit = gs.netProfit != null ? gs.netProfit : (gs.totalProfit || 0);
  const realizedProfit = gs.realizedProfit != null ? gs.realizedProfit : null;
  const kpis = [
    { title: "Chiffre d'affaires", value: cfa(gs.totalRevenue), icon: <Wallet className="h-4 w-4" />, tone: "neutral", ctx: `${(gs.saleCount || 0).toLocaleString("fr-FR")} vente(s)` },
    ...(realizedProfit != null ? [
      { title: "Bénéfice encaissé", value: cfa(realizedProfit), icon: <Coins className="h-4 w-4" />, tone: "brand", ctx: `Paiements reçus · ${cfa(gs.collectedRevenue)} encaissé` },
    ] : []),
    { title: "Coût des marchandises", value: cfa(gs.totalCost), icon: <Package className="h-4 w-4" />, tone: "neutral", ctx: "COGS sur la période" },
    { title: "Bénéfice brut attendu", value: cfa(gs.grossProfit != null ? gs.grossProfit : gs.totalProfit), icon: <TrendingUp className="h-4 w-4" />, tone: "success", ctx: "Ventes de la période (CA − coût)" },
    { title: "Pertes casse/cadeau", value: lossCost ? `- ${cfa(lossCost)}` : cfa(0), icon: <PackageMinus className="h-4 w-4" />, tone: lossCost > 0 ? "danger" : "neutral", ctx: `Casse ${cfa(gs.lossCasse || 0)} · Cadeau ${cfa(gs.lossCadeau || 0)}` },
    { title: "Bénéfice net attendu", value: cfa(netProfit), icon: <Coins className="h-4 w-4" />, tone: netProfit >= 0 ? "success" : "danger", ctx: "Brut − pertes (à pleine encaisse)" },
    { title: "Marge nette", value: pctOf(gs.netMargin != null ? gs.netMargin : gs.averageMargin), icon: <Percent className="h-4 w-4" />, tone: (gs.netMargin ?? 0) >= 0 ? "success" : "danger", ctx: "Net ÷ CA" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="ms-command-bar flex-wrap gap-y-2">
        <span className="fui-caption1-strong uppercase mr-1" style={{ color: "var(--colorNeutralForeground3)", letterSpacing: "0.06em" }}>Période</span>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setFilter("period", p.value)} className={`ms-button ms-button-sm ${filters.period === p.value ? "ms-button-primary" : "ms-button-secondary"}`}>{p.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <input type="date" value={filters.startDate} onChange={(e) => setFilter("startDate", e.target.value)} className="form-control w-auto text-sm min-h-[36px]" title="Date début" />
          <input type="date" value={filters.endDate} onChange={(e) => setFilter("endDate", e.target.value)} className="form-control w-auto text-sm min-h-[36px]" title="Date fin" />
          {containers.length > 0 && (
            <select value={filters.container} onChange={(e) => setFilter("container", e.target.value)} className="form-control w-auto text-sm min-h-[36px]">
              <option value="">Tous conteneurs</option>
              {containers.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          )}
          {(filters.startDate || filters.endDate || filters.container || filters.period !== "month") && (
            <button onClick={resetFilters} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1"><X size={12} /> Réinitialiser</button>
          )}
        </div>
      </div>

      {/* Coverage note */}
      {gs.detailCoverage != null && gs.detailCoverage < 95 && (
        <div className="rounded-[var(--radiusLarge)] px-4 py-2.5 fui-caption1" style={{ background: "var(--colorStatusWarningBackground1)", color: "var(--colorStatusWarningForeground1)", border: "1px solid var(--colorStatusWarningStroke1)" }}>
          Le détail par produit/catégorie couvre {gs.detailCoverage}% du chiffre d'affaires (certaines anciennes ventes n'ont pas le détail de marge enregistré).
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <KPICard key={k.title} title={k.title} value={k.value} context={k.ctx} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      {/* Trend + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="fluent-card-filled p-5">
          <p className="fui-subtitle2 mb-4" style={{ color: "var(--colorNeutralForeground1)" }}>Évolution — CA, bénéfice & marge</p>
          <div className="h-72">
            <Bar
              data={trendChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { position: "top", labels: { font: CHART_LABEL_FONT, usePointStyle: true } } },
                scales: {
                  y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" }, ticks: { font: CHART_LABEL_FONT, callback: (v) => `${Math.round(v / 1000)}k` } },
                  y1: { beginAtZero: true, position: "right", grid: { display: false }, ticks: { font: CHART_LABEL_FONT, callback: (v) => `${v}%` } },
                  x: { grid: { display: false }, ticks: { font: CHART_LABEL_FONT } },
                },
              }}
            />
          </div>
        </div>

        <div className="fluent-card-filled p-5">
          <p className="fui-subtitle2 mb-4" style={{ color: "var(--colorNeutralForeground1)" }}>Top produits rentables</p>
          <div className="h-72">
            <Bar
              data={topProductsChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y",
                plugins: { legend: { display: false } },
                scales: {
                  x: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" }, ticks: { font: CHART_LABEL_FONT, callback: (v) => `${Math.round(v / 1000)}k` } },
                  y: { grid: { display: false }, ticks: { font: CHART_LABEL_FONT } },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Top products table */}
      <div className="fluent-card-filled overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--colorNeutralStroke2)" }}>
          <p className="fui-subtitle2" style={{ color: "var(--colorNeutralForeground1)" }}>Détail des produits les plus rentables <span className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>· encaissé sur la période</span></p>
        </div>
        {topProducts.length === 0 ? (
          <EmptyState title="Aucune donnée" description="Aucune vente détaillée sur la période." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--colorNeutralBackground2)" }}>
                <tr>
                  {["Produit", "Catégorie", "Qté", "CA", "Coût", "Bénéfice", "Marge"].map((h, i) => (
                    <th key={h} className={`px-3 py-2 fui-caption1-strong ${i >= 2 ? "text-right" : "text-left"}`} style={{ color: "var(--colorNeutralForeground3)", borderBottom: "1px solid var(--colorNeutralStroke2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p._id} style={{ borderBottom: "1px solid var(--colorNeutralStroke3)" }}>
                    <td className="px-3 py-2 fui-body1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>{p.productName}</td>
                    <td className="px-3 py-2 fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>{p.category || "Non catégorisé"}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorNeutralForeground2)" }}>{(p.totalQuantity || 0).toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorNeutralForeground2)" }}>{cfa(p.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorNeutralForeground3)" }}>{cfa(p.totalCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums fui-body1-strong" style={{ color: "var(--colorStatusSuccessForeground1)" }}>{cfa(p.totalProfit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorBrandForeground1)" }}>{pctOf(p.profitMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {profitByCategory.length > 0 && (
        <div className="fluent-card-filled p-5">
          <p className="fui-subtitle2 mb-4" style={{ color: "var(--colorNeutralForeground1)" }}>Bénéfices par catégorie <span className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>· encaissé</span></p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-64"><Doughnut data={categoryChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { font: CHART_LABEL_FONT } } } }} /></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "var(--colorNeutralBackground2)" }}>
                  <tr>
                    {["Catégorie", "CA", "Bénéfice", "Marge"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 fui-caption1-strong ${i >= 1 ? "text-right" : "text-left"}`} style={{ color: "var(--colorNeutralForeground3)", borderBottom: "1px solid var(--colorNeutralStroke2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profitByCategory.map((c) => (
                    <tr key={c._id} style={{ borderBottom: "1px solid var(--colorNeutralStroke3)" }}>
                      <td className="px-3 py-2 fui-body1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>{c._id || "Non catégorisé"}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorNeutralForeground2)" }}>{cfa(c.totalRevenue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums fui-body1-strong" style={{ color: "var(--colorStatusSuccessForeground1)" }}>{cfa(c.totalProfit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorBrandForeground1)" }}>{pctOf(c.profitMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Container breakdown */}
      {profitByContainer.length > 0 && (
        <div className="fluent-card-filled overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--colorNeutralStroke2)" }}>
            <p className="fui-subtitle2" style={{ color: "var(--colorNeutralForeground1)" }}>Gains par conteneur <span className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>· encaissé</span></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--colorNeutralBackground2)" }}>
                <tr>
                  {["Conteneur", "CA", "Coût", "Bénéfice", "Marge", "Qté"].map((h, i) => (
                    <th key={h} className={`px-3 py-2 fui-caption1-strong ${i >= 1 ? "text-right" : "text-left"}`} style={{ color: "var(--colorNeutralForeground3)", borderBottom: "1px solid var(--colorNeutralStroke2)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profitByContainer.map((c) => (
                  <tr key={c._id} style={{ borderBottom: "1px solid var(--colorNeutralStroke3)" }}>
                    <td className="px-3 py-2 fui-body1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>{c._id || "Non défini"}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorNeutralForeground2)" }}>{cfa(c.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorNeutralForeground3)" }}>{cfa(c.totalCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums fui-body1-strong" style={{ color: "var(--colorStatusSuccessForeground1)" }}>{cfa(c.totalProfit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorBrandForeground1)" }}>{pctOf(c.profitMargin)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--colorNeutralForeground2)" }}>{(c.totalQuantity || 0).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ===============================
   Calculs avancés & helpers Sales
   =============================== */
const calculateGrowthRate = (salesData) => {
  if (salesData.length < 2) return 0;
  const referenceDate = new Date();
  const oneMonthAgo = new Date(referenceDate);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const twoMonthsAgo = new Date(referenceDate);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const lastMonth = salesData
    .filter((s) => {
      const d = parseDateSafely(s.saleDate);
      return d && d >= oneMonthAgo;
    })
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const previousMonth = salesData
    .filter((s) => {
      const d = parseDateSafely(s.saleDate);
      return d && d >= twoMonthsAgo && d < oneMonthAgo;
    })
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return previousMonth > 0 ? (lastMonth - previousMonth) / previousMonth : 0;
};

const calculatePredictiveAnalytics = (salesData) => {
  if (salesData.length === 0) return null;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = salesData.filter((s) => {
    const d = parseDateSafely(s.saleDate);
    return d && d >= thirtyDaysAgo;
  });

  const dailyAverages = last30Days.reduce((acc, sale) => {
    const d = parseDateSafely(sale.saleDate);
    if (!d) return acc;
    const key = d.toLocaleDateString();
    if (!acc[key]) acc[key] = { total: 0, count: 0 };
    acc[key].total += sale.totalAmount;
    acc[key].count += 1;
    return acc;
  }, {});
  const days = Object.values(dailyAverages);
  const avgDailyRevenue =
    days.length > 0
      ? days.reduce((s, day) => s + day.total / Math.max(day.count, 1), 0) /
        days.length
      : 0;

  const growthRate = calculateGrowthRate(salesData);
  return {
    next30Days: avgDailyRevenue * 30 * (1 + growthRate),
    growthRate: growthRate * 100,
    confidence: Math.min(85 + salesData.length / 100, 95),
  };
};

const analyzeClientSegmentation = (salesData) => {
  const clientSales = salesData.reduce((acc, sale) => {
    if (!sale?.client) return acc;
    const saleDate = parseDateSafely(sale.saleDate);
    if (!saleDate) return acc;
    const clientId = sale.client._id;

    if (!acc[clientId]) {
      acc[clientId] = {
        totalSpent: 0,
        purchaseCount: 0,
        lastPurchase: saleDate,
        lastPayment: null,
        averagePurchase: 0,
        client: sale.client,
      };
    }
    acc[clientId].totalSpent += sale.totalAmount || 0;
    acc[clientId].purchaseCount += 1;
    acc[clientId].lastPurchase = new Date(
      Math.max(acc[clientId].lastPurchase.getTime(), saleDate.getTime())
    );

    (sale.payments || []).forEach((p) => {
      const pd = parseDateSafely(p?.paymentDate || p?.createdAt);
      if (!pd) return;
      if (!acc[clientId].lastPayment || pd > acc[clientId].lastPayment) {
        acc[clientId].lastPayment = pd;
      }
    });
    return acc;
  }, {});

  const segmented = Object.entries(clientSales).map(([clientId, m]) => {
    const lastPurchaseTime = m.lastPurchase?.getTime?.() || Date.now();
    const recency = Math.floor((Date.now() - lastPurchaseTime) / 86400000);
    m.averagePurchase = m.purchaseCount > 0 ? m.totalSpent / m.purchaseCount : 0;
    const lastPaymentTime = m.lastPayment?.getTime?.();
    const lastPaymentRecency =
      lastPaymentTime != null
        ? Math.floor((Date.now() - lastPaymentTime) / 86400000)
        : null;

    let segment = "Nouveau";
    if (m.purchaseCount > 5 && m.totalSpent > 100000) segment = "VIP";
    else if (m.purchaseCount > 2 && recency < 30) segment = "Fidèle";
    else if (recency > 90) segment = "Inactif";

    return {
      ...m,
      segment,
      recency,
      lastPaymentRecency,
      lastPaymentDate: m.lastPayment,
    };
  });

  return segmented.sort((a, b) => b.totalSpent - a.totalSpent);
};

const detectAnomalies = (salesData) => {
  if (salesData.length < 10) return [];
  const amounts = salesData.map((s) => s.totalAmount).filter((a) => a > 0);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const stdDev = Math.sqrt(
    amounts.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / amounts.length
  );
  return salesData
    .filter((s) => Math.abs((s.totalAmount - mean) / (stdDev || 1)) > 3)
    .map((a) => ({
      ...a,
      deviation: Math.round(((a.totalAmount - mean) / (mean || 1)) * 100),
    }));
};

const calculateAdvancedKPIs = (salesData, clientsData) => {
  const completed = salesData.filter((s) => s.status === "completed");
  const revenue = completed.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const uniqueClients = new Set(
    completed.map((s) => s.client?._id).filter(Boolean)
  );
  return {
    conversionRate: clientsData.length
      ? (uniqueClients.size / clientsData.length) * 100
      : 0,
    averageTransactionValue: completed.length ? revenue / completed.length : 0,
    customerLifetimeValue: uniqueClients.size ? revenue / uniqueClients.size : 0,
  };
};

/* ===============================
   Composant principal
   =============================== */
const Sales = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useAutoClearMessage(message, setMessage);

  // Filtres
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [saleTypeFilter, setSaleTypeFilter] = useState("");
  const [paymentStructureFilter, setPaymentStructureFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(() => getTodayFilterValue());
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [containerFilter, setContainerFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [containers, setContainers] = useState([]);
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false); // collapsed on mobile by default
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Modals
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPaymentsDetailModal, setShowPaymentsDetailModal] = useState(false);
  const [paymentsDetailData, setPaymentsDetailData] = useState([]);
  const [paymentsDetailLoading, setPaymentsDetailLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Livraison
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);

  // Vues
  const [viewMode, setViewMode] = useState("dashboard"); // 'dashboard' | 'analytics' | 'profits' | 'clients'
  const canViewProfit = useFeature(FEATURE_KEYS.PROFIT_ANALYSIS); // "Bénéfices" — forfait Entreprise
  const canProforma = useFeature(FEATURE_KEYS.PROFORMA);
  const canExport = useFeature(FEATURE_KEYS.DATA_EXPORT); // bulk exports — la facture reste accessible à tous
  const [profitUpgradeOpen, setProfitUpgradeOpen] = useState(false);
  // Mobile only (< lg) : bascule entre le formulaire de vente et l'historique
  // (sur desktop les deux colonnes restent côte à côte).
  const [mobilePanel, setMobilePanel] = useState("form"); // 'form' | 'history'
  const [prefillProductId, setPrefillProductId] = useState(""); // scan-to-sell (QR ?addProduct=)
  const [timeRange, setTimeRange] = useState("30days");
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Données analytics locales
  const [predictiveData, setPredictiveData] = useState(null);
  const [clientSegmentation, setClientSegmentation] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  // Filtres rapides
  const [quickFilters, setQuickFilters] = useState({
    highValue: false,
    latePayments: false,
    recurring: false,
    highProfit: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("status")) {
      setStatusFilter(params.get("status") || "");
    }
    if (params.has("client")) {
      setClientFilter(params.get("client") || "");
    }
    setSaleTypeFilter(params.get("saleType") || "");
    setPaymentStructureFilter(params.get("paymentStructure") || "");
    if (params.has("date")) {
      setDateFilter(params.get("date") || "");
    }
    if (params.has("delivery")) {
      setDeliveryFilter(params.get("delivery") || "");
    }
    if (params.has("container")) {
      setContainerFilter(params.get("container") || "");
    }
    setSellerFilter(params.get("seller") || "");
    setPrefillProductId(params.get("addProduct") || "");
  }, [location.search]);

  // Scroll vers le formulaire de vente quand on arrive avec #sale-form (menu "Enregistrer une vente")
  useEffect(() => {
    if (location.pathname === "/sales" && location.hash === "#sale-form") {
      setMobilePanel("form"); // make sure the form is the visible panel on mobile
      const t = setTimeout(() => {
        const el = document.getElementById("sale-form");
        if (el) {
          const navOffset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-nav-offset")) || 72;
          const top = el.getBoundingClientRect().top + window.scrollY - navOffset - 12;
          window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
        }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [location.pathname, location.hash]);

  // Données Dashboard (backend /api/sales/dashboard-sale)
  const [dashboardData, setDashboardData] = useState({
    totalSales: 0,
    salesCount: 0,
    averageSale: 0,
    totalProducts: 0,
    topProducts: [],
    salesTrend: [],
    paymentMethods: {},
    statusStats: {
      pending: { count: 0, totalAmount: 0 },
      partially_paid: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 },
    },
    dailySummary: {
      salesCount: 0,
      totalAmount: 0,
      averageSale: 0,
      pendingSales: 0,
      completedSales: 0,
      paymentsCount: 0,
      paymentsTotal: 0,
    },
    paymentsSummary: {
      paymentsCount: 0,
      paymentsTotal: 0,
    },
    saleTypeSummary: {
      normal: { count: 0, totalAmount: 0, percentage: 0 },
      wholesale: { count: 0, totalAmount: 0, percentage: 0 },
    },
    paymentStructureSummary: {
      full_payment: { count: 0, totalAmount: 0, percentage: 0 },
      multiple_payments: { count: 0, totalAmount: 0, percentage: 0 },
      pending_payment: { count: 0, totalAmount: 0, percentage: 0 },
    },
    forecast: { next30Days: 0, growthRate: 0, confidence: 0 },
    clientMetrics: { topClients: [], newClients: 0, clientRetention: 0 },
    kpis: { conversionRate: 0, averageTransactionValue: 0, customerLifetimeValue: 0 },
  });

  // Statistiques livraison (calcul local + fallback API)
  const [deliveryStats, setDeliveryStats] = useState({
    delivered: 0,
    pending: 0,
    not_delivered: 0,
    totalCompleted: 0,
    deliveryRate: 0,
  });

  /* ========= Récupération données ========= */
  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get("/clients");
      const list = normalizeCollection(res.data, ["clients", "data"]);
      setClients(list);
      return list;
    } catch (e) {
      setError("Erreur de chargement des clients");
      setClients([]);
      return [];
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/products");
      const list = normalizeCollection(res.data, ["products", "data"]);
      setProducts(list);
      return list;
    } catch {
      setError("Erreur de chargement des produits");
      setProducts([]);
      return [];
    }
  }, []);

  const fetchContainers = useCallback(async () => {
    try {
      const res = await api.get("/lookups/containers");
      setContainers(res.data || []);
    } catch {
      // silently ignore — container filter just won't show
    }
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api.get("/sales", { params: { summary: "list" } });
      setSales(res.data || []);
      return res.data || [];
    } catch {
      setError("Erreur de chargement des ventes");
      setSales([]);
      return [];
    }
  }, []);

  const fetchDashboardData = useCallback(
    async (range, dayFilter, options = {}) => {
      const { showLoading = true } = options;
      try {
        if (showLoading) setDashboardLoading(true);
        const params = new URLSearchParams({ range });
        if (dayFilter) params.append("summaryDate", dayFilter);
        const { data } = await api.get(`/sales/dashboard-sale?${params.toString()}`);
        setDashboardData((prev) => ({ ...prev, ...data }));
      } catch (e) {
        setMessage("Erreur de chargement du tableau de bord");
      } finally {
        if (showLoading) setDashboardLoading(false);
      }
    },
    [setMessage]
  );

  // Essaye d'utiliser l'endpoint /sales/delivery-stats sinon calcule localement
  const hydrateDeliveryStats = useCallback(
    async (salesArray) => {
      try {
        const { data } = await api.get("/sales/stats/delivery");
        // Back compat (si votre endpoint renvoie { delivered: {count,totalAmount}, ... })
        const delivered = data?.delivered?.count ?? 0;
        const pending = data?.pending?.count ?? 0;
        const notDelivered = data?.not_delivered?.count ?? 0;
        const totalCompleted = delivered + pending + notDelivered;
        const deliveryRate = totalCompleted ? Math.round((delivered / totalCompleted) * 100) : 0;
        setDeliveryStats({ delivered, pending, not_delivered: notDelivered, totalCompleted, deliveryRate });
      } catch {
        // Fallback local
        const completed = salesArray.filter((s) => s.status === "completed");
        const delivered = completed.filter((s) => s.deliveryStatus === "delivered").length;
        const pending = completed.filter((s) => !s.deliveryStatus || s.deliveryStatus === "pending").length;
        const notDelivered = completed.filter((s) => s.deliveryStatus === "not_delivered").length;
        const totalCompleted = completed.length;
        const deliveryRate = totalCompleted ? Math.round((delivered / totalCompleted) * 100) : 0;
        setDeliveryStats({ delivered, pending, not_delivered: notDelivered, totalCompleted, deliveryRate });
      }
    },
    []
  );

  const initialBootstrapDone = useRef(false);

  // Premier chargement : ventes, clients, produits, stats, dashboard (une seule fois)
  useEffect(() => {
    if (initialBootstrapDone.current) return;
    setLoading(true);
    const bootstrap = async () => {
      try {
        const [, , salesData] = await Promise.all([
          fetchClients(),
          fetchProducts(),
          fetchSales(),
          fetchContainers(),
        ]);
        await hydrateDeliveryStats(salesData);
        if (isAdmin) {
          fetchDashboardData(timeRange, dateFilter);
        }
      } catch {
        setError("Erreur de chargement des données");
      } finally {
        setLoading(false);
        initialBootstrapDone.current = true;
      }
    };
    bootstrap();
  }, [
    isAdmin,
    timeRange,
    dateFilter,
    fetchClients,
    fetchProducts,
    fetchSales,
    fetchContainers,
    fetchDashboardData,
    hydrateDeliveryStats,
  ]);

  useEffect(() => {
    if (!initialBootstrapDone.current || !isAdmin) return;

    try {
      const predictive = calculatePredictiveAnalytics(sales);
      const segmentation = analyzeClientSegmentation(sales);
      const anomaliesDetected = detectAnomalies(sales);
      const kpis = calculateAdvancedKPIs(sales, clients);

      setPredictiveData(predictive);
      setClientSegmentation(segmentation);
      setAnomalies(anomaliesDetected);
      setDashboardData((prev) => ({
        ...prev,
        forecast: predictive || prev.forecast,
        clientMetrics: {
          ...prev.clientMetrics,
          topClients: segmentation.slice(0, 5),
        },
        kpis: { ...prev.kpis, ...kpis },
      }));
    } catch {
      setMessage("Erreur de préparation des analytics");
    }
  }, [sales, clients, isAdmin, setMessage]);

  // Changement de période (7j / 30j / 90j / Tous) : met à jour uniquement le dashboard, sans recharger toute la page
  useEffect(() => {
    if (!initialBootstrapDone.current || !isAdmin) return;
    fetchDashboardData(timeRange, dateFilter);
  }, [timeRange, dateFilter, isAdmin, fetchDashboardData]);

  useEffect(() => {
    const refreshAfterGlobalMutation = async () => {
      try {
        const [salesData] = await Promise.all([
          fetchSales(),
          fetchProducts(),
        ]);
        await hydrateDeliveryStats(salesData);
        if (isAdmin) {
          await fetchDashboardData(timeRange, dateFilter, { showLoading: false });
        }
      } catch {
        setMessage("Erreur de mise à jour des ventes");
      }
    };

    window.addEventListener("saleCreated", refreshAfterGlobalMutation);
    window.addEventListener("paymentCreated", refreshAfterGlobalMutation);

    return () => {
      window.removeEventListener("saleCreated", refreshAfterGlobalMutation);
      window.removeEventListener("paymentCreated", refreshAfterGlobalMutation);
    };
  }, [
    dateFilter,
    fetchDashboardData,
    fetchProducts,
    fetchSales,
    hydrateDeliveryStats,
    isAdmin,
    setMessage,
    timeRange,
  ]);

  /* ========= Dérivés & filtres ========= */
  const salesWithProfit = useMemo(
    () =>
      sales.map((sale) => {
        const computedProfit = sale?.profitData?.totalProfit ?? calculateSaleProfit(sale);
        const computedMargin = sale?.profitData?.profitMargin ?? calculateSaleMargin(sale);
        const computedProfitCategory =
          sale?.profitCategory || deriveProfitCategoryFromMargin(computedMargin);
        return { ...sale, computedProfit, computedMargin, computedProfitCategory };
      }),
    [sales]
  );

  const sellers = useMemo(() => {
    const byId = new Map();
    sales.forEach((sale) => {
      const sellerId = getSaleSellerId(sale);
      if (!sellerId || byId.has(sellerId)) return;
      byId.set(sellerId, {
        _id: sellerId,
        name: getSaleSellerName(sale) || "Vendeur sans nom",
        email: typeof sale.user === "object" ? sale.user.email || "" : "",
      });
    });
    return Array.from(byId.values()).sort((a, b) =>
      (a.name || a.email || "").localeCompare(b.name || b.email || "", "fr", { sensitivity: "base" })
    );
  }, [sales]);

  const applySalesFilters = useCallback((source, options = {}) => {
    const { includeDate = true } = options;
    const base = source.filter((sale) => {
      const statusMatch = !statusFilter || sale.status === statusFilter;
      const clientMatch = !clientFilter || sale.client?._id === clientFilter;
      const sellerMatch = !sellerFilter || getSaleSellerId(sale) === sellerFilter;
      const saleTypeMatch = !saleTypeFilter || (sale.saleType || "normal") === saleTypeFilter;
      const paymentStructureMatch =
        !paymentStructureFilter || getPaymentStructureKey(sale) === paymentStructureFilter;
      const d = parseDateSafely(sale.saleDate);
      const dateMatch = !includeDate || !dateFilter || (d && d.toLocaleDateString("fr-CA") === dateFilter);
      const deliveryMatch =
        !deliveryFilter ||
        (sale.status === "completed" &&
          (deliveryFilter === "all_completed" || sale.deliveryStatus === deliveryFilter));
      const containerMatch =
        !containerFilter ||
        (sale.products || []).some((p) => p.product?.container === containerFilter);
      return statusMatch && clientMatch && sellerMatch && saleTypeMatch && paymentStructureMatch && dateMatch && deliveryMatch && containerMatch;
    });

    let out = [...base];
    if (quickFilters.highValue) out = out.filter((s) => (s.totalAmount || 0) > 50000);
    if (quickFilters.latePayments) {
      out = out.filter((s) => {
        const { balance } = calculateSaleTotals(s);
        return balance > 0 && s.status !== "cancelled";
        }
      );
    }
    if (quickFilters.recurring) {
      const byClient = source.reduce((acc, s) => {
        if (s.client) acc[s.client._id] = (acc[s.client._id] || 0) + 1;
        return acc;
      }, {});
      out = out.filter((s) => s.client && byClient[s.client._id] > 1);
    }
    if (quickFilters.highProfit) out = out.filter((s) => (s.computedProfit || 0) > 10000);
    return out;
  }, [statusFilter, clientFilter, sellerFilter, saleTypeFilter, paymentStructureFilter, dateFilter, deliveryFilter, containerFilter, quickFilters]);

  const filteredSales = useMemo(
    () => applySalesFilters(salesWithProfit, { includeDate: true }),
    [applySalesFilters, salesWithProfit]
  );

  const filteredHistoryStats = useMemo(() => {
    const salesTotal = filteredSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
    const salesCollected = filteredSales.reduce((sum, sale) => sum + (Number(sale.totalPaid) || 0), 0);
    const remaining = filteredSales.reduce((sum, sale) => {
      const { balance } = calculateSaleTotals(sale);
      return sum + (Number(balance) || 0);
    }, 0);

    const paymentSourceSales = dateFilter
      ? applySalesFilters(salesWithProfit, { includeDate: false })
      : filteredSales;

    let paymentsOnSelectedDate = 0;
    let paymentsOnSelectedDateCount = 0;

    paymentSourceSales.forEach((sale) => {
      (sale.payments || []).forEach((payment) => {
        const paymentDate = parseDateSafely(payment.paymentDate || payment.createdAt);
        if (!paymentDate) return;
        const matchesDate = dateFilter
          ? paymentDate.toLocaleDateString("fr-CA") === dateFilter
          : true;
        if (!matchesDate) return;
        paymentsOnSelectedDate += Number(payment.amount) || 0;
        paymentsOnSelectedDateCount += 1;
      });
    });

    return {
      salesCount: filteredSales.length,
      salesTotal,
      salesCollected,
      remaining,
      paymentsOnSelectedDate,
      paymentsOnSelectedDateCount,
    };
  }, [applySalesFilters, dateFilter, filteredSales, salesWithProfit]);

  const desktopLinkProps = useMemo(
    () => (isDesktop ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    [isDesktop]
  );

  const enrichSaleForState = useCallback((incomingSale, fallbackSale = null) => {
    const resolveId = (value) => {
      if (!value) return null;
      if (typeof value === "string") return value;
      return value._id || null;
    };

    const clientId = resolveId(incomingSale?.client) || resolveId(fallbackSale?.client);
    const localClient = clients.find((client) => client._id === clientId);
    const resolvedClient =
      localClient
        ? { ...localClient, ...(typeof incomingSale?.client === "object" ? incomingSale.client : {}) }
        : (typeof incomingSale?.client === "object" ? incomingSale.client : fallbackSale?.client);

    const fallbackProducts = Array.isArray(fallbackSale?.products) ? fallbackSale.products : [];
    const resolvedProducts = (Array.isArray(incomingSale?.products) ? incomingSale.products : fallbackProducts).map((item) => {
      const productId = resolveId(item?.product);
      const localProduct = products.find((product) => product._id === productId);
      const previousLine = fallbackProducts.find((line) => resolveId(line?.product) === productId);
      return {
        ...item,
        product: localProduct || (typeof item?.product === "object" ? item.product : previousLine?.product),
      };
    });

    const payments = Array.isArray(incomingSale?.payments)
      ? incomingSale.payments
      : (Array.isArray(fallbackSale?.payments) ? fallbackSale.payments : []);

    const formattedPayments = payments.map((payment) => ({
      ...payment,
      formattedDate: payment?.paymentDate
        ? new Date(payment.paymentDate).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : payment?.formattedDate,
    }));

    const totalAmount = Number(incomingSale?.totalAmount ?? fallbackSale?.totalAmount ?? 0);
    const totalPaid = formattedPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    return {
      ...fallbackSale,
      ...incomingSale,
      client: resolvedClient,
      products: resolvedProducts,
      payments: formattedPayments,
      formattedDate: incomingSale?.saleDate
        ? new Date(incomingSale.saleDate).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : (incomingSale?.formattedDate || fallbackSale?.formattedDate),
      totalPaid,
      balance: totalAmount - totalPaid,
    };
  }, [clients, products]);

  const hasActiveFilters = Boolean(statusFilter || clientFilter || sellerFilter || saleTypeFilter || paymentStructureFilter || dateFilter || deliveryFilter || containerFilter);

  const salesReturnSearch = useMemo(
    () =>
      buildSalesReturnSearch({
        statusFilter,
        clientFilter,
        sellerFilter,
        saleTypeFilter,
        paymentStructureFilter,
        dateFilter,
        deliveryFilter,
        containerFilter,
      }),
    [statusFilter, clientFilter, sellerFilter, saleTypeFilter, paymentStructureFilter, dateFilter, deliveryFilter, containerFilter]
  );
  const salesReturnPath = `/sales${salesReturnSearch}`;
  const saleLinkState = useMemo(() => ({ returnToSales: salesReturnPath }), [salesReturnPath]);

  const historyLinkSearch = useMemo(() => {
    const params = new URLSearchParams();
    params.set("history", "1");
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("client", clientFilter);
    if (sellerFilter) params.set("seller", sellerFilter);
    if (saleTypeFilter) params.set("saleType", saleTypeFilter);
    if (paymentStructureFilter) params.set("paymentStructure", paymentStructureFilter);
    if (dateFilter) params.set("date", dateFilter);
    if (deliveryFilter) params.set("delivery", deliveryFilter);
    if (containerFilter) params.set("container", containerFilter);
    return `?${params.toString()}`;
  }, [statusFilter, clientFilter, sellerFilter, saleTypeFilter, paymentStructureFilter, dateFilter, deliveryFilter, containerFilter]);

  const historyLinkLabel = hasActiveFilters ? "Ouvrir ces filtres" : "Voir toutes les ventes";

  /* ========= Manipulations ========= */
  const handleOpenPaymentsDetail = async () => {
    setPaymentsDetailLoading(true);
    setShowPaymentsDetailModal(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) {
        params.append('startDate', dateFilter);
        params.append('endDate', dateFilter);
      }
      const { data } = await api.get(`/sales/payments/date-range?${params.toString()}`);
      setPaymentsDetailData(data || []);
    } catch {
      setPaymentsDetailData([]);
    } finally {
      setPaymentsDetailLoading(false);
    }
  };

  const handleSubmitSale = async (saleData) => {
    try {
      setMessage("");
      const { data } = await api.post("/sales", saleData);
      const nextSale = enrichSaleForState(data);
      const updatedSales = [nextSale, ...sales].sort(
        (a, b) => new Date(b?.saleDate || 0).getTime() - new Date(a?.saleDate || 0).getTime()
      );
      setSales(updatedSales);
      setMessage("Vente enregistrée avec succès !");
      toast.success("Vente enregistrée avec succès !");
      await hydrateDeliveryStats(updatedSales);
      if (isAdmin) await fetchDashboardData(timeRange, dateFilter, { showLoading: false });
    } catch (e) {
      setMessage("Erreur: " + (e.response?.data?.message || e.message));
    }
  };

  const handleAddPayment = async (paymentData) => {
    if (!selectedSale) return;
    try {
      const { data } = await api.post(`/sales/${selectedSale._id}/payments`, paymentData);
      const nextSale = enrichSaleForState(data, selectedSale);
      const updatedSales = sales.map((sale) => (sale._id === selectedSale._id ? nextSale : sale));
      setSales(updatedSales);
      setSelectedSale(nextSale);
      setMessage("Paiement ajouté avec succès !");
      setShowPaymentModal(false);
      await hydrateDeliveryStats(updatedSales);
      if (isAdmin) await fetchDashboardData(timeRange, dateFilter, { showLoading: false });
    } catch (error) {
      setMessage("Erreur: " + (error.response?.data?.message || error.message));
      throw error;
    }
  };

  const handleUpdateDelivery = async () => {
    if (!selectedSale) return;
    try {
      setMessage("Mise à jour en cours...");
      setIsUpdatingDelivery(true);
      const payload = {
        deliveryStatus,
        deliveryNote: deliveryNote || "",
        deliveryDate: deliveryStatus === "delivered" ? new Date().toISOString() : null,
      };
      const { data } = await api.put(`/sales/${selectedSale._id}/delivery`, payload);
      const nextDeliveryState = {
        deliveryStatus: data?.deliveryStatus ?? payload.deliveryStatus,
        deliveryNote: data?.deliveryNote ?? payload.deliveryNote,
        deliveryDate: data?.deliveryDate ?? payload.deliveryDate,
        updatedAt: data?.updatedAt ?? selectedSale.updatedAt,
      };
      const updatedSales = sales.map((sale) =>
        sale._id === selectedSale._id
          ? {
              ...sale,
              ...nextDeliveryState,
            }
          : sale
      );

      setSales(updatedSales);
      setSelectedSale((prevSale) =>
        prevSale
          ? {
              ...prevSale,
              ...nextDeliveryState,
            }
          : prevSale
      );
      await hydrateDeliveryStats(updatedSales);
      setMessage("✅ Statut de livraison mis à jour avec succès !");
      setShowDeliveryModal(false);
      if (isAdmin) {
        fetchDashboardData(timeRange, dateFilter, { showLoading: false });
      }
    } catch (e) {
      setMessage("❌ Erreur: " + (e.response?.data?.message || e.message));
    } finally {
      setIsUpdatingDelivery(false);
    }
  };

  /* ========= UI : Graphiques & cartes ========= */
  const salesTrendChart = {
    labels: dashboardData.salesTrend.map((i) => i.date),
    datasets: [
      {
        label: "Chiffre d'affaires (CFA)",
        data: dashboardData.salesTrend.map((i) => i.total),
        borderColor: "rgb(59,130,246)",
        backgroundColor: "rgba(59,130,246,.12)",
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const topProductsChart = {
    labels: dashboardData.topProducts.map((i) => truncateLabel(i.product?.name || "Produit", 12)).slice(0, 6),
    datasets: [
      {
        label: "Quantité vendue",
        data: dashboardData.topProducts.map((i) => i.quantity).slice(0, 6),
        backgroundColor: [
          "rgba(99,102,241,.9)",
          "rgba(34,197,94,.9)",
          "rgba(59,130,246,.9)",
          "rgba(234,179,8,.9)",
          "rgba(239,68,68,.9)",
          "rgba(168,85,247,.9)",
        ],
      },
    ],
  };

  const statusChart = {
    labels: ["Payée", "Partiellement payée", "En attente", "Annulée"],
    datasets: [
      {
        label: "Ventes par statut",
        data: [
          dashboardData.statusStats?.completed?.count || 0,
          dashboardData.statusStats?.partially_paid?.count || 0,
          dashboardData.statusStats?.pending?.count || 0,
          dashboardData.statusStats?.cancelled?.count || 0,
        ],
        backgroundColor: [
          "rgba(34,197,94,.9)",
          "rgba(234,179,8,.9)",
          "rgba(59,130,246,.9)",
          "rgba(239,68,68,.9)",
        ],
      },
    ],
  };

  const deliveryTimelineData = useMemo(() => {
    const dates = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const countsByDay = dates.reduce((acc, date) => {
      acc[date.toISOString().slice(0, 10)] = 0;
      return acc;
    }, {});

    sales.forEach((sale) => {
      if (sale.deliveryStatus !== "delivered") return;

      const referenceDate = sale.deliveryDate || sale.updatedAt || sale.saleDate;
      const parsed = new Date(referenceDate);

      if (Number.isNaN(parsed.getTime())) return;

      parsed.setHours(0, 0, 0, 0);
      const key = parsed.toISOString().slice(0, 10);

      if (Object.prototype.hasOwnProperty.call(countsByDay, key)) {
        countsByDay[key] += 1;
      }
    });

    return {
      labels: dates.map((date) =>
        date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
      ),
      datasets: [
        {
          label: "Livraisons / jour",
          data: dates.map((date) => countsByDay[date.toISOString().slice(0, 10)] || 0),
          backgroundColor: "rgba(34,197,94,.85)",
          borderRadius: 8,
        },
      ],
    };
  }, [sales]);

  const deliveryChartData = {
    labels: ["Livrées", "En attente", "Non livrées"],
    datasets: [
      {
        data: [deliveryStats.delivered, deliveryStats.pending, deliveryStats.not_delivered],
        backgroundColor: [
          "rgba(34,197,94,.9)",
          "rgba(234,179,8,.9)",
          "rgba(239,68,68,.9)",
        ],
      },
    ],
  };

  const highlightedOrderCards = [
    {
      key: "wholesale",
      title: "Ventes en gros",
      count: dashboardData.saleTypeSummary?.wholesale?.count || 0,
      amount: dashboardData.saleTypeSummary?.wholesale?.totalAmount || 0,
      percentage: dashboardData.saleTypeSummary?.wholesale?.percentage || 0,
      accent: "border-violet-200 bg-violet-50",
      text: "text-violet-700",
    },
    {
      key: "normal",
      title: "Ventes normales",
      count: dashboardData.saleTypeSummary?.normal?.count || 0,
      amount: dashboardData.saleTypeSummary?.normal?.totalAmount || 0,
      percentage: dashboardData.saleTypeSummary?.normal?.percentage || 0,
      accent: "border-sky-200 bg-sky-50",
      text: "text-sky-700",
    },
    {
      key: "full_payment",
      title: "Paiement complet",
      count: dashboardData.paymentStructureSummary?.full_payment?.count || 0,
      amount: dashboardData.paymentStructureSummary?.full_payment?.totalAmount || 0,
      percentage: dashboardData.paymentStructureSummary?.full_payment?.percentage || 0,
      accent: "border-emerald-200 bg-emerald-50",
      text: "text-emerald-700",
      linkTo: "/sales/all?history=1&paymentStructure=full_payment",
    },
    {
      key: "multiple_payments",
      title: "Paiements multiples",
      count: dashboardData.paymentStructureSummary?.multiple_payments?.count || 0,
      amount: dashboardData.paymentStructureSummary?.multiple_payments?.totalAmount || 0,
      percentage: dashboardData.paymentStructureSummary?.multiple_payments?.percentage || 0,
      accent: "border-amber-200 bg-amber-50",
      text: "text-amber-700",
      linkTo: "/sales/all?history=1&paymentStructure=multiple_payments",
    },
  ];

  const statusTableRef = useRef(null);
  useResponsiveTable(statusTableRef, [dashboardData?.statusStats]);

  /* ========= Barre de filtres rapides ========= */
  const quickFilterConfig = [
    {
      key: "highValue",
      label: "Hautes Valeurs",
      icon: Gem,
      active: quickFilters.highValue,
      activeClass: "bg-purple-50 border-purple-400 text-purple-800 ring-1 ring-purple-200",
    },
    {
      key: "latePayments",
      label: "Retards Paiement",
      icon: Clock3,
      active: quickFilters.latePayments,
      activeClass: "bg-red-50 border-red-400 text-red-800 ring-1 ring-red-200",
    },
    {
      key: "recurring",
      label: "Clients Récurrents",
      icon: Repeat2,
      active: quickFilters.recurring,
      activeClass: "bg-green-50 border-green-400 text-green-800 ring-1 ring-green-200",
    },
    {
      key: "highProfit",
      label: "Hauts Bénéfices",
      icon: TrendingUp,
      active: quickFilters.highProfit,
      activeClass: "bg-emerald-50 border-emerald-400 text-emerald-800 ring-1 ring-emerald-200",
    },
  ];
  const hasActiveFilter =
    quickFilters.highValue ||
    quickFilters.latePayments ||
    quickFilters.recurring ||
    quickFilters.highProfit;

  const QuickFilterBar = () => (
    <div className="ms-command-bar flex-wrap gap-y-2">
      <span className="fui-caption1-strong uppercase shrink-0" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>
        Filtres rapides
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {quickFilterConfig.map(({ key, label, icon: Icon, active }) => (
          <button
            key={key}
            type="button"
            onClick={() => setQuickFilters((p) => ({ ...p, [key]: !p[key] }))}
            className={`ms-button ms-button-sm flex items-center gap-1.5 ${active ? 'ms-button-primary' : 'ms-button-secondary'}`}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span>{label}</span>
          </button>
        ))}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => setQuickFilters({ highValue: false, latePayments: false, recurring: false, highProfit: false })}
            className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5 ml-auto"
            aria-label="Effacer tous les filtres"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Effacer
          </button>
        )}
      </div>
    </div>
  );

  const HistoryStatsSummary = () => {
    const paymentTitle = dateFilter
      ? "Paiements encaissés ce jour"
      : "Paiements des ventes filtrées";
    const paymentHelper = dateFilter
      ? "Inclut aussi les paiements de ventes plus anciennes payés à cette date."
      : "Total des paiements liés aux ventes affichées.";

    const cards = [
      {
        label: "Ventes filtrées",
        value: filteredHistoryStats.salesCount.toLocaleString("fr-FR"),
        helper: `${filteredHistoryStats.salesTotal.toLocaleString("fr-FR")} CFA vendus`,
        color: "border-[var(--ms-blue-soft)] bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)]",
      },
      {
        label: "Encaissé sur ventes",
        value: `${filteredHistoryStats.salesCollected.toLocaleString("fr-FR")} CFA`,
        helper: "Paiements attachés aux ventes affichées",
        color: "border-emerald-100 bg-emerald-50 text-emerald-700",
      },
      {
        label: paymentTitle,
        value: `${filteredHistoryStats.paymentsOnSelectedDate.toLocaleString("fr-FR")} CFA`,
        helper: `${filteredHistoryStats.paymentsOnSelectedDateCount} paiement(s). ${paymentHelper}`,
        color: "border-[var(--ms-blue-soft)] bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)]",
        clickable: dateFilter,
        onClick: () => handleOpenPaymentsDetail(),
      },
      {
        label: "Reste à encaisser",
        value: `${filteredHistoryStats.remaining.toLocaleString("fr-FR")} CFA`,
        helper: "Solde restant des ventes affichées",
        color: "border-amber-100 bg-amber-50 text-amber-700",
      },
    ];

    return (
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const content = (
            <div
              className={`ms-kpi-card h-full ${card.clickable ? 'cursor-pointer fluent-card-interactive' : ''}`}
            >
              <div>
                <p className="ms-kpi-title">{card.label}</p>
                <p className="ms-kpi-value" style={{ fontSize: 18 }}>{card.value}</p>
                <p className="ms-kpi-context">{card.helper}</p>
                {card.clickable && (
                  <p className="mt-2 fui-caption1" style={{ color: 'var(--colorBrandForeground1)' }}>
                    Voir le détail →
                  </p>
                )}
              </div>
            </div>
          );
          return card.clickable ? (
            <button key={card.label} type="button" onClick={card.onClick} className="text-left w-full">
              {content}
            </button>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </div>
    );
  };

  /* ========= Écrans d'attente / erreur ========= */
  if (loading) {
    return (
      <Workspace>
        <PageHeader eyebrow="Ventes" title="Gestion des ventes" description="Chargement du module commercial." />
        <LoadingSkeleton rows={6} />
      </Workspace>
    );
  }
  if (error) {
    return (
      <Workspace>
        <PageHeader eyebrow="Ventes" title="Gestion des ventes" description="Une erreur est survenue." />
        <EmptyState title="Impossible de charger les ventes" description={error} />
      </Workspace>
    );
  }

  // Vue simplifiée pour les utilisateurs non administrateurs
  if (!isAdmin) {
    return (
      <Workspace>
        <PageHeader
          eyebrow="Ventes"
          title="Gestion des ventes"
          description="Enregistrez une vente, suivez les paiements et les livraisons du jour."
          actions={
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="ms-button ms-button-secondary ms-button-md"
              >
                <ReceiptText className="h-4 w-4" />
                {historyLinkLabel}
              </button>
          }
        />

          {canProforma && (
            <Suspense fallback={<LoadingSkeleton rows={2} />}>
              <ProformaHistory clients={clients} products={products} />
            </Suspense>
          )}

          <MobilePanelToggle value={mobilePanel} onChange={setMobilePanel} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div id="sale-form" className={`scroll-mt-[var(--app-nav-offset)] ${mobilePanel === "form" ? "block" : "hidden"} lg:block`}>
              <GlassCard>
                <div className="p-5 sm:p-6">
                  <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} text="Chargement du formulaire…" /></div>}>
                    <SaleForm clients={clients} products={products} onSubmit={handleSubmitSale} initialProductId={prefillProductId} />
                  </Suspense>
                </div>
              </GlassCard>
            </div>

            <GlassCard className={`${mobilePanel === "history" ? "block" : "hidden"} lg:block`}>
              <section className="p-5 sm:p-6" aria-labelledby="history-heading-main">
                <div className="ms-command-bar mb-5 flex-wrap gap-y-2">
                  <h2 id="history-heading-main" className="fui-subtitle1 flex items-center gap-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    <span className="ms-kpi-icon shrink-0" aria-hidden="true"><ReceiptText className="h-4 w-4" /></span>
                    Historique des Ventes
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <button type="button" onClick={() => setShowHistoryModal(true)} className="ms-button ms-button-secondary ms-button-sm">
                      {historyLinkLabel}
                    </button>
                    {isAdmin && (
                      <Link to="/sales/deleted" className="ms-button ms-button-danger ms-button-sm" {...desktopLinkProps}>
                        Ventes supprimées
                      </Link>
                    )}
                  </div>
                </div>

                {/* Filtres — collapsible on mobile, always visible on sm+ */}
                <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 overflow-hidden mb-5">
                  <button
                    type="button"
                    onClick={() => setHistoryFiltersOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-3 py-4 px-4 sm:hidden bg-white hover:bg-gray-50/80 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] focus-visible:ring-inset"
                    aria-expanded={historyFiltersOpen}
                    aria-controls="history-filters-main"
                    id="history-filters-toggle-main"
                  >
                    <span className="font-medium text-gray-900">Filtres</span>
                    {hasActiveFilters && (
                      <span className="text-xs font-medium text-[var(--ms-blue)] bg-[var(--ms-blue-soft)] px-2.5 py-1 rounded-full">
                        Actifs
                      </span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${historyFiltersOpen ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  <div
                    id="history-filters-main"
                    role="region"
                    aria-labelledby="history-filters-toggle-main"
                    className={`${historyFiltersOpen ? "block" : "hidden"} sm:block border-t border-gray-200/80 sm:border-t-0`}
                  >
                    <div className="p-4 sm:p-5 pt-0 sm:pt-5">
                      <SalesFiltersBar
                        statusFilter={statusFilter}
                        clientFilter={clientFilter}
                        sellerFilter={sellerFilter}
                        saleTypeFilter={saleTypeFilter}
                        paymentStructureFilter={paymentStructureFilter}
                        dateFilter={dateFilter}
                        deliveryFilter={deliveryFilter}
                        containerFilter={containerFilter}
                        clients={clients}
                        containers={containers}
                        sellers={sellers}
                        onStatusChange={setStatusFilter}
                        onClientChange={setClientFilter}
                        onSellerChange={setSellerFilter}
                        onSaleTypeChange={setSaleTypeFilter}
                        onPaymentStructureChange={setPaymentStructureFilter}
                        onDateChange={setDateFilter}
                        onDeliveryChange={setDeliveryFilter}
                        onContainerChange={setContainerFilter}
                        onReset={() => {
                          setStatusFilter("");
                          setClientFilter("");
                          setSellerFilter("");
                          setSaleTypeFilter("");
                          setPaymentStructureFilter("");
                          setDateFilter("");
                          setDeliveryFilter("");
                          setContainerFilter("");
                          setQuickFilters({ highValue: false, latePayments: false, recurring: false, highProfit: false });
                        }}
                        variant="main"
                      />
                    </div>
                  </div>
                </div>

                <HistoryStatsSummary />

                <div className="ms-command-bar flex-wrap gap-y-2 mb-4">
                  <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                    <span className="fui-body1-strong">{filteredSales.length}</span> ventes affichées
                  </p>
                  <div className="ml-auto">
                    <SalesListExportButtons sales={filteredSales} filenamePrefix="ventes-filtrees" label="Ventes filtrées" />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredSales.length === 0 ? (
                    <EmptyState title="Aucune vente trouvée" description="Ajustez les filtres ou créez une nouvelle vente." />
                  ) : (
                    filteredSales.map((sale) => {
                      const { totalPaid, balance } = calculateSaleTotals(sale);
                      const isModified = (sale.modificationCount || 0) > 0;
                      return (
                        <SaleCard
                          key={sale._id}
                          sale={sale}
                          totalPaid={totalPaid}
                          balance={balance}
                          formatDate={formatDate}
                          getStatusClass={getStatusClass}
                          getStatusText={getStatusText}
                          isModified={isModified}
                          desktopLinkProps={desktopLinkProps}
                          linkState={saleLinkState}
                          returnTo={salesReturnPath}
                          actions={
                            <>
                              {sale.status !== "completed" && sale.status !== "cancelled" && (
                                <Button
                                  onClick={() => {
                                    setSelectedSale(sale);
                                    setShowPaymentModal(true);
                                  }}
                                  variant="primary"
                                  className="w-full sm:w-auto"
                                >
                                  Ajouter un paiement
                                </Button>
                              )}
                              {sale.status === "completed" && (
                                <Button
                                  onClick={() => {
                                    setSelectedSale(sale);
                                    setDeliveryStatus(sale.deliveryStatus || "pending");
                                    setDeliveryNote(sale.deliveryNote || "");
                                    setShowDeliveryModal(true);
                                  }}
                                  className="w-full sm:w-auto"
                                >
                                  Gérer la livraison
                                </Button>
                              )}
                            </>
                          }
                        />
                      );
                    })
                  )}
                </div>
              </section>
            </GlassCard>
          </div>

          <Suspense fallback={null}>
            <PaymentModal
              show={showPaymentModal}
              onClose={() => setShowPaymentModal(false)}
              sale={selectedSale}
              onAddPayment={handleAddPayment}
            />
          </Suspense>

          {showDeliveryModal && selectedSale && (
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-gray-950/45 backdrop-blur-md p-4"
              onClick={() => setShowDeliveryModal(false)}
            >
              <div
                className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-100 text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2M5 8a2 2 0 011-2h12a2 2 0 011 2m-2 6h.01M17 16h.01" />
                      </svg>
                    </span>
                    Statut de livraison
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowDeliveryModal(false)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
                    aria-label="Fermer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  <div>
                    <label htmlFor="delivery-status-nonadmin" className="block text-sm font-medium text-gray-700 mb-2">
                      Statut
                    </label>
                    <select
                      id="delivery-status-nonadmin"
                      value={deliveryStatus || selectedSale.deliveryStatus || "pending"}
                      onChange={(e) => setDeliveryStatus(e.target.value)}
                      className="w-full min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue)] focus:border-[var(--ms-blue)]"
                    >
                      <option value="pending">En attente</option>
                      <option value="delivered">Livré</option>
                      <option value="not_delivered">Non livré</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="delivery-note-nonadmin" className="block text-sm font-medium text-gray-700 mb-2">
                      Note (optionnelle)
                    </label>
                    <textarea
                      id="delivery-note-nonadmin"
                      value={deliveryNote || selectedSale.deliveryNote || ""}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Notes sur la livraison…"
                      className="w-full min-h-[88px] px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue)] focus:border-[var(--ms-blue)] resize-y"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{deliveryNote.length}/500 caractères</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 sm:px-6 border-t border-gray-100 bg-gray-50/30">
                  <button
                    type="button"
                    onClick={() => setShowDeliveryModal(false)}
                    disabled={isUpdatingDelivery}
                    className="min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] focus-visible:ring-offset-2 disabled:opacity-60"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateDelivery}
                    disabled={isUpdatingDelivery}
                    className="min-h-[44px] px-4 py-2.5 bg-[var(--ms-blue)] text-white rounded-xl hover:bg-[var(--ms-blue-dark)] flex items-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] focus-visible:ring-offset-2"
                  >
                    {isUpdatingDelivery ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Mise à jour…
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
      </Workspace>
    );
  }

  /* ========= Rendu principal ========= */
  
  return (
    <Workspace>
        <ChartSetup />
        {/* En-tête */}
        <PageHeader
          eyebrow="Ventes"
          title="Tableau de bord commercial"
          description="Suivi des ventes, encaissements, marges et livraisons."
          meta={isAdmin ? "Admin" : null}
          actions={
            isAdmin && (
              canExport ? (
                <Button onClick={() => setShowExportModal(true)} size="sm">
                  <Download className="h-4 w-4" aria-hidden />
                  <span>Exporter</span>
                </Button>
              ) : (
                <LockedFeatureButton feature={FEATURE_KEYS.DATA_EXPORT} icon={<Download className="h-4 w-4" />}>Exporter</LockedFeatureButton>
              )
            )
          }
        />

        {canProforma && (
          <Suspense fallback={<LoadingSkeleton rows={2} />}>
            <ProformaHistory clients={clients} products={products} />
          </Suspense>
        )}

        {/* Fluent 2 Pivot — view modes */}
        {isAdmin && (
          <div className="fluent-card-filled overflow-hidden">
            <div className="fui-pivot px-2">
              {[
                { value: "dashboard", label: "Vue Standard",    icon: ReceiptText },
                { value: "analytics", label: "Analytics",       icon: BarChart3 },
                { value: "profits",   label: "Bénéfices",       icon: Banknote },
                { value: "clients",   label: "Clients",         icon: Users },
              ].map(({ value, label, icon: Icon }) => {
                const locked = value === "profits" && !canViewProfit;
                return (
                  <button
                    key={value}
                    role="tab"
                    aria-selected={viewMode === value}
                    onClick={() => (locked ? setProfitUpgradeOpen(true) : setViewMode(value))}
                    className={`fui-pivot__tab flex items-center gap-1.5 ${viewMode === value ? 'fui-pivot__tab--active' : ''}`}
                    title={locked ? "Bénéfices — réservé au forfait Entreprise" : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                    {locked && <Lock className="h-3 w-3 ml-0.5" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notification */}
        {message && (
          <div
            className="rounded-[var(--radiusLarge)] px-4 py-3 fui-body1 flex items-center gap-3"
            style={{
              background: message.includes('succès') ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorStatusDangerBackground1)',
              color: message.includes('succès') ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)',
              border: `1px solid ${message.includes('succès') ? 'var(--colorStatusSuccessStroke1)' : 'var(--colorStatusDangerStroke1)'}`,
            }}
          >
            {message}
          </div>
        )}

        {/* Vues alternatives */}
        {viewMode === "analytics" && (
          <div className="space-y-5">
            <div className="ms-command-bar flex-wrap gap-y-2">
              <div>
                <h2 className="fui-title3" style={{ color: 'var(--colorNeutralForeground1)' }}>Analytics Avancées</h2>
                <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>Données prédictives et analyses détaillées</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              <AdvancedMetricCard
                title="Prévision 30 jours"
                value={`${Math.round(predictiveData?.next30Days || 0).toLocaleString("fr-FR")} CFA`}
                change={predictiveData?.growthRate}
                icon={<BarChart3 className="h-5 w-5" />}
                tone="brand"
                description={`Confiance: ${predictiveData?.confidence || 0}%`}
              />
              <AdvancedMetricCard
                title="CLV (Valeur Client)"
                value={`${Math.round(dashboardData.kpis.customerLifetimeValue).toLocaleString("fr-FR")} CFA`}
                icon={<Users className="h-5 w-5" />}
                tone="success"
                description="Revenus moyens par client"
              />
              <AdvancedMetricCard
                title="Taux de conversion"
                value={`${dashboardData.kpis.conversionRate.toFixed(1)}%`}
                icon={<CheckCircle2 className="h-5 w-5" />}
                tone="warning"
                description="Clients actifs / fichier clients"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              <div className="fluent-card-filled p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Segmentation Client (RFM)</h3>
                  <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{clientSegmentation.length} clients</span>
                </div>
                <p className="fui-caption1 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }}>Récence · Fréquence · Montant</p>
                {clientSegmentation.length > 0 ? (
                  <ClientSegmentationChart segmentation={clientSegmentation} />
                ) : (
                  <div className="h-64 flex items-center justify-center fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucune donnée client</div>
                )}
              </div>

              <div className="fluent-card-filled p-5">
                <h3 className="fui-subtitle2 mb-1" style={{ color: 'var(--colorNeutralForeground1)' }}>Performance des Produits</h3>
                <p className="fui-caption1 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }}>Top 6 par revenus générés</p>
                {dashboardData.topProducts?.length > 0 ? (
                  <ProductPerformanceChart products={dashboardData.topProducts} />
                ) : (
                  <div className="h-64 flex items-center justify-center fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucune donnée produit</div>
                )}
              </div>
            </div>

            {anomalies.length > 0 && (
              <div
                className="fluent-card-filled p-5"
                style={{ borderColor: 'var(--colorStatusWarningBorder1)', background: 'var(--colorStatusWarningBackground1)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" style={{ color: 'var(--colorStatusWarningForeground1)' }} />
                  <h3 className="fui-subtitle2" style={{ color: 'var(--colorStatusWarningForeground1)' }}>
                    Ventes atypiques détectées ({anomalies.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {anomalies.slice(0, 5).map((a, i) => {
                    const high = a.deviation > 0;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-[var(--radiusMedium)] p-3"
                        style={{ background: 'var(--colorNeutralBackground1)' }}
                      >
                        <div className="min-w-0">
                          <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
                            Vente #{a._id?.slice(-6) || "N/A"}
                          </p>
                          <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
                            {a.client?.name || "Client inconnu"} · {formatDate(a.saleDate)} · {(a.totalAmount || 0).toLocaleString("fr-FR")} CFA
                          </p>
                        </div>
                        <span className={`ms-status-badge ${high ? 'ms-status-danger' : 'ms-status-success'} shrink-0`}>
                          {high ? "+" : ""}{a.deviation}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === "profits" && canViewProfit && (
          <div className="space-y-4">
            <div className="ms-command-bar flex-wrap gap-y-2">
              <div>
                <h2 className="fui-title3" style={{ color: 'var(--colorNeutralForeground1)' }}>Analyse des Bénéfices</h2>
                <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>Bénéfices, marges et produits les plus rentables</p>
              </div>
            </div>
            <ProfitAnalysis />
          </div>
        )}

        <UpgradeModal
          open={profitUpgradeOpen}
          onClose={() => setProfitUpgradeOpen(false)}
          feature={FEATURE_KEYS.PROFIT_ANALYSIS}
        />

        {viewMode === "clients" && (
          <div className="space-y-5">
            <div className="ms-command-bar flex-wrap gap-y-2">
              <div>
                <h2 className="fui-title3" style={{ color: 'var(--colorNeutralForeground1)' }}>Analyse Client</h2>
                <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>Segmentation RFM, meilleurs clients et relances</p>
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                <button
                  onClick={() => navigate("/sales/partially-paid")}
                  className="ms-button ms-button-secondary ms-button-md"
                >
                  Paiements partiels →
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setViewMode("analytics")}
                    className="ms-button ms-button-primary ms-button-md"
                  >
                    Analytics
                  </button>
                )}
              </div>
            </div>

            {isAdmin ? (
              clientSegmentation.length > 0 ? (
                <ClientAnalysisPanel segmentation={clientSegmentation} navigate={navigate} />
              ) : (
                <div className="fluent-card-filled p-8">
                  <EmptyState
                    title="Aucune donnée client"
                    description="Les segments apparaîtront dès que des ventes seront enregistrées."
                  />
                </div>
              )
            ) : (
              <div className="fluent-card-filled p-5 sm:p-6 space-y-4">
                <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                  Accédez rapidement aux ventes partiellement payées pour suivre les encaissements en attente ou à relancer.
                </p>
                <button
                  onClick={() => navigate({ pathname: "/sales/partially-paid", search: `?status=partially_paid` })}
                  className="ms-button ms-button-primary ms-button-md"
                >
                  Ouvrir les ventes partiellement payées
                </button>
              </div>
            )}
          </div>
        )}

        {/* Vue Standard (Dashboard) */}
        {viewMode === "dashboard" && (
          <>
            {/* Filtres rapides */}
            {isAdmin && <QuickFilterBar />}

            {/* Range selector */}
            <div className="ms-command-bar flex-wrap gap-y-2">
              <h2 className="fui-subtitle1 flex items-center gap-2 min-w-0" style={{ color: 'var(--colorNeutralForeground1)' }}>
                <span className="ms-kpi-icon shrink-0" aria-hidden><TrendingUp className="h-4 w-4" /></span>
                Tableau de bord des ventes
              </h2>
              <div className="flex flex-wrap gap-2 ml-auto shrink-0">
                {["7days", "30days", "90days", "all"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`ms-button ms-button-sm ${timeRange === r ? 'ms-button-primary' : 'ms-button-secondary'}`}
                  >
                    {r === "7days" ? "7 jours" : r === "30days" ? "30 jours" : r === "90days" ? "90 jours" : "Tous"}
                  </button>
                ))}
              </div>
            </div>

            {dashboardLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--ms-blue)]" />
              </div>
            ) : (
              <>
                {/* KPIs — mobile 2 cols, desktop 6; chiffres lisibles (taille + break-words) */}
                <section
                  className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 items-stretch"
                  aria-label="Indicateurs clés"
                >
                  <StatCard
                    title="Chiffre d'affaires"
                    value={`${dashboardData.totalSales.toLocaleString("fr-FR")} CFA`}
                    icon={<Wallet className="h-5 w-5" />}
                    color="bg-sky-50 text-sky-700"
                  />
                  <StatCard
                    title="Nombre de ventes"
                    value={dashboardData.salesCount}
                    icon={<ReceiptText className="h-5 w-5" />}
                    color="bg-emerald-50 text-emerald-700"
                  />
                  <StatCard
                    title="Vente moyenne"
                    value={`${dashboardData.averageSale.toLocaleString("fr-FR")} CFA`}
                    icon={<BarChart3 className="h-5 w-5" />}
                    color="bg-violet-50 text-violet-700"
                  />
                  <StatCard
                    title="Produits vendus"
                    value={dashboardData.totalProducts}
                    icon={<Boxes className="h-5 w-5" />}
                    color="bg-amber-50 text-amber-700"
                  />
                  <StatCard
                    title="Paiements (nb)"
                    value={dashboardData.paymentsSummary.paymentsCount}
                    icon={<CreditCard className="h-5 w-5" />}
                    color="bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)]"
                  />
                  <StatCard
                    title="Total payé"
                    value={`${dashboardData.paymentsSummary.paymentsTotal.toLocaleString("fr-FR")} CFA`}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    color="bg-emerald-50 text-emerald-700"
                  />
                </section>

                <section aria-label="Types de commandes et structures de paiement" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                  {highlightedOrderCards.map((card) => {
                    const cardContent = (
                      <div className="fluent-card-filled h-full p-5">
                        <p className="fui-caption1-strong uppercase" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>
                          {card.title}
                        </p>
                        <div className="fui-large-title mt-3 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>
                          {card.count}
                        </div>
                        <p className="fui-body1 mt-1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                          {card.amount.toLocaleString("fr-FR")} CFA
                        </p>
                        <div className="mt-3 flex items-center justify-between rounded-[var(--radiusMedium)] px-3 py-2 fui-caption1" style={{ background: 'var(--colorNeutralBackground2)' }}>
                          <span style={{ color: 'var(--colorNeutralForeground3)' }}>Part des ventes</span>
                          <span className="fui-caption1-strong" style={{ color: 'var(--colorBrandForeground1)' }}>
                            {card.percentage.toFixed(1)}%
                          </span>
                        </div>
                        {card.linkTo && (
                          <p className="mt-3 fui-caption1" style={{ color: 'var(--colorBrandForeground1)' }}>Voir les ventes →</p>
                        )}
                      </div>
                    );

                    return card.linkTo ? (
                      <Link
                        key={card.key}
                        to={card.linkTo}
                        className="block fluent-card-interactive"
                        aria-label={`Voir les ventes pour ${card.title.toLowerCase()}`}
                      >
                        {cardContent}
                      </Link>
                    ) : (
                      <div key={card.key}>{cardContent}</div>
                    );
                  })}
                </section>

                {/* Encaissements */}
                <GlassCard>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>
                          Encaissements
                        </h3>
                        <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          {dashboardData.paymentsSummary.paymentsCount} paiements — total{' '}
                          <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                            {dashboardData.paymentsSummary.paymentsTotal.toLocaleString("fr-FR")} CFA
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorStatusInfoBackground1)', border: '1px solid rgba(15,108,189,0.15)' }}>
                        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aujourd'hui</p>
                        <p className="fui-title3 mt-1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>
                          {(dashboardData.dailySummary.paymentsTotal || 0).toLocaleString("fr-FR")} CFA
                        </p>
                        <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          {dashboardData.dailySummary.paymentsCount || 0} paiements
                        </p>
                      </div>
                      <div className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorStatusSuccessBackground1)', border: '1px solid var(--colorStatusSuccessStroke1)' }}>
                        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Moyenne / vente</p>
                        <p className="fui-title3 mt-1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>
                          {dashboardData.salesCount ? Math.round(dashboardData.paymentsSummary.paymentsTotal / dashboardData.salesCount).toLocaleString("fr-FR") : 0} CFA
                        </p>
                        <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          Sur {dashboardData.salesCount} ventes
                        </p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Livraison — 3 colonnes */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <GlassCard>
                    <div className="p-5">
                      <p className="fui-subtitle2 mb-1" style={{ color: 'var(--colorNeutralForeground1)' }}>Statistiques de livraison</p>
                      <p className="fui-caption1 mb-4" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        Taux : <strong style={{ color: 'var(--colorNeutralForeground1)' }}>{deliveryStats.deliveryRate}%</strong>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Livrées', value: deliveryStats.delivered, bg: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)', stroke: 'var(--colorStatusSuccessStroke1)' },
                          { label: 'En attente', value: deliveryStats.pending, bg: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)', stroke: 'var(--colorStatusWarningStroke1)' },
                          { label: 'Non livrées', value: deliveryStats.not_delivered, bg: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', stroke: 'var(--colorStatusDangerStroke1)' },
                        ].map(({ label, value, bg, color, stroke }) => (
                          <div key={label} className="rounded-[var(--radiusLarge)] p-3 text-center" style={{ background: bg, border: `1px solid ${stroke}` }}>
                            <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
                            <p className="fui-title3 mt-1 tabular-nums" style={{ color }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <div className="p-5">
                      <p className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Répartition</p>
                      <div className="h-48">
                        <Doughnut data={deliveryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} />
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <div className="p-5">
                      <p className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Timeline (7 jours)</p>
                      <div className="h-48">
                        <Bar data={deliveryTimelineData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } }, x: { grid: { display: false } } } }} />
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* Tendance & Top produits */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GlassCard>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4 gap-3">
                        <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Tendance des ventes</p>
                        <button onClick={() => navigate("/sales/partially-paid")} className="ms-button ms-button-secondary ms-button-sm shrink-0">
                          Paiements partiels →
                        </button>
                      </div>
                      <div className="h-48 sm:h-52 min-h-[180px]">
                        <Line data={salesTrendChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", labels: { font: CHART_LABEL_FONT } } }, scales: { y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" }, ticks: { font: CHART_LABEL_FONT } }, x: { grid: { display: false }, ticks: { font: CHART_LABEL_FONT } } } }} />
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <div className="p-5">
                      <p className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Top produits (quantités)</p>
                      <div className="h-48 sm:h-52 min-h-[180px]">
                        <Bar data={topProductsChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" }, ticks: { font: CHART_LABEL_FONT } }, x: { grid: { display: false }, ticks: { font: CHART_LABEL_FONT, maxRotation: 45, minRotation: 0, maxTicksLimit: 8 } } } }} />
                      </div>
                    </div>
                  </GlassCard>

                  {/* Statut des ventes */}
                  <GlassCard>
                    <section className="p-5" aria-labelledby="status-sales-heading">
                      <p id="status-sales-heading" className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>
                        Statut des ventes
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex justify-center md:justify-start">
                          <div className="w-full max-w-[260px] h-[220px] sm:h-[260px] mx-auto md:max-w-none md:w-full md:h-[200px]">
                            <Pie
                              data={statusChart}
                              options={{
                                responsive: true,
                                maintainAspectRatio: true,
                                plugins: { legend: { position: "top" } },
                              }}
                            />
                          </div>
                        </div>
                        {/* Desktop: table */}
                        <div className="hidden md:block overflow-visible">
                          <table ref={statusTableRef} className="w-full text-left">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-sm font-medium text-gray-600 rounded-tl-xl">Statut</th>
                                <th className="px-4 py-2 text-sm font-medium text-gray-600 text-right">Nombre</th>
                                <th className="px-4 py-2 text-sm font-medium text-gray-600 text-right rounded-tr-xl">Montant</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {[
                                ["Payée", "completed"],
                                ["Partiellement payée", "partially_paid"],
                                ["En attente", "pending"],
                                ["Annulée", "cancelled"],
                              ].map(([label, key]) => (
                                <tr key={key}>
                                  <td className="px-4 py-3 text-sm text-gray-900">{label}</td>
                                  <td className="px-4 py-3 text-sm text-right tabular-nums">{dashboardData.statusStats?.[key]?.count || 0}</td>
                                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-600">{(dashboardData.statusStats?.[key]?.totalAmount || 0).toLocaleString("fr-FR")} CFA</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Mobile: status cards list */}
                        <div className="md:hidden space-y-3">
                          {[
                            ["Payée", "completed", "bg-green-50 border-green-200/80", "text-green-800"],
                            ["Partiellement payée", "partially_paid", "bg-amber-50 border-amber-200/80", "text-amber-800"],
                            ["En attente", "pending", "bg-[var(--ms-blue-soft)] border-[var(--ms-blue-soft)]", "text-[var(--ms-blue-dark)]"],
                            ["Annulée", "cancelled", "bg-gray-100 border-gray-200/80", "text-gray-700"],
                          ].map(([label, key, cardClass, textClass]) => {
                            const count = dashboardData.statusStats?.[key]?.count || 0;
                            const amount = dashboardData.statusStats?.[key]?.totalAmount || 0;
                            return (
                              <div
                                key={key}
                                className={`rounded-xl border p-4 ${cardClass}`}
                              >
                                <p className={`text-sm font-semibold ${textClass}`}>{label}</p>
                                <div className="mt-2 flex items-baseline justify-between gap-2 text-sm text-gray-600">
                                  <span>{count} vente{count !== 1 ? "s" : ""}</span>
                                  <span className="tabular-nums font-medium text-gray-900">{amount.toLocaleString("fr-FR")} CFA</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  </GlassCard>
                </div>
              </>
            )}

            {/* Formulaire & Historique */}
            <MobilePanelToggle value={mobilePanel} onChange={setMobilePanel} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div id="sale-form" className={`scroll-mt-[var(--app-nav-offset)] ${mobilePanel === "form" ? "block" : "hidden"} lg:block`}>
                <GlassCard>
                  <div className="p-6">
                    <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} text="Chargement du formulaire…" /></div>}>
                      <SaleForm clients={clients} products={products} onSubmit={handleSubmitSale} initialProductId={prefillProductId} />
                    </Suspense>
                  </div>
                </GlassCard>
              </div>

              <GlassCard className={`${mobilePanel === "history" ? "block" : "hidden"} lg:block`}>
                <section className="p-5 sm:p-6" aria-labelledby="history-heading-admin">
                  <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-5">
                    <h2 id="history-heading-admin" className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-700 shrink-0" aria-hidden="true">
                        <ReceiptText className="h-5 w-5" />
                      </span>
                      Historique des Ventes
                    </h2>
                    <nav className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Actions historique">
                      <button
                        type="button"
                        onClick={() => setShowHistoryModal(true)}
                        className="inline-flex items-center min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 text-sm font-medium text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] hover:bg-[var(--ms-blue-soft)] rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] focus-visible:ring-offset-2"
                      >
                        {historyLinkLabel}
                      </button>
                      {isAdmin && (
                        <Link
                          to="/sales/deleted"
                          className="inline-flex items-center min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                          {...desktopLinkProps}
                        >
                          Ventes supprimées
                        </Link>
                      )}
                    </nav>
                  </header>

                  {/* Filtres — collapsible on mobile, always visible on sm+ */}
                  <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 overflow-hidden mb-5">
                    <button
                      type="button"
                      onClick={() => setHistoryFiltersOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-3 py-4 px-4 sm:hidden bg-white hover:bg-gray-50/80 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] focus-visible:ring-inset"
                      aria-expanded={historyFiltersOpen}
                      aria-controls="history-filters-admin"
                      id="history-filters-toggle-admin"
                    >
                      <span className="font-medium text-gray-900">Filtres</span>
                      {hasActiveFilters && (
                        <span className="text-xs font-medium text-[var(--ms-blue)] bg-[var(--ms-blue-soft)] px-2.5 py-1 rounded-full">
                          Actifs
                        </span>
                      )}
                      <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${historyFiltersOpen ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    <div
                      id="history-filters-admin"
                      role="region"
                      aria-labelledby="history-filters-toggle-admin"
                      className={`${historyFiltersOpen ? "block" : "hidden"} sm:block border-t border-gray-200/80 sm:border-t-0`}
                    >
                      <div className="p-4 sm:p-5 pt-0 sm:pt-5">
                        <SalesFiltersBar
                          statusFilter={statusFilter}
                          clientFilter={clientFilter}
                          sellerFilter={sellerFilter}
                          saleTypeFilter={saleTypeFilter}
                          paymentStructureFilter={paymentStructureFilter}
                          dateFilter={dateFilter}
                          deliveryFilter={deliveryFilter}
                          containerFilter={containerFilter}
                          clients={clients}
                          containers={containers}
                          sellers={sellers}
                          onStatusChange={setStatusFilter}
                          onClientChange={setClientFilter}
                          onSellerChange={setSellerFilter}
                          onSaleTypeChange={setSaleTypeFilter}
                          onPaymentStructureChange={setPaymentStructureFilter}
                          onDateChange={setDateFilter}
                          onDeliveryChange={setDeliveryFilter}
                          onContainerChange={setContainerFilter}
                          onReset={() => {
                            setStatusFilter("");
                            setClientFilter("");
                            setSellerFilter("");
                            setSaleTypeFilter("");
                            setPaymentStructureFilter("");
                            setDateFilter("");
                            setDeliveryFilter("");
                            setContainerFilter("");
                            setQuickFilters({ highValue: false, latePayments: false, recurring: false, highProfit: false });
                          }}
                          variant="archive"
                        />
                      </div>
                    </div>
                  </div>

                  <HistoryStatsSummary />

                  <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-gray-600">
                      Export des ventes affichées: <span className="font-semibold text-gray-950">{filteredSales.length}</span>
                    </p>
                    <SalesListExportButtons
                      sales={filteredSales}
                      filenamePrefix="ventes-filtrees"
                      label="Ventes filtrées"
                    />
                  </div>

                  {/* Liste des ventes — une carte par ligne (mobile et desktop) */}
                  <div className="grid grid-cols-1 gap-4">
                    {filteredSales.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                        Aucune vente trouvée
                      </div>
                    ) : (
                      filteredSales.map((sale) => {
                        const { totalPaid, balance } = calculateSaleTotals(sale);
                        const saleMargin = sale?.computedMargin ?? calculateSaleMargin(sale);
                        const profitCategory =
                          sale?.computedProfitCategory ?? deriveProfitCategoryFromMargin(saleMargin);
                        const showProfitInfo = isAdmin && sale.products?.length > 0;
                        const isModified = (sale.modificationCount || 0) > 0;

                        return (
                          <SaleCard
                            key={sale._id}
                            sale={sale}
                            totalPaid={totalPaid}
                            balance={balance}
                            formatDate={formatDate}
                            getStatusClass={getStatusClass}
                            getStatusText={getStatusText}
                            getProfitCategoryClass={getProfitCategoryClass}
                            getProfitCategoryText={getProfitCategoryText}
                            showProfitBadge={showProfitInfo}
                            profitCategory={profitCategory}
                            isModified={isModified}
                            desktopLinkProps={desktopLinkProps}
                            linkState={saleLinkState}
                            returnTo={salesReturnPath}
                            actions={
                              <>
                                {sale.status === "completed" && (
                                  <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
                                    <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
                                      <Suspense fallback={<div className="flex justify-center py-2"><AppLoader fullScreen={false} text="PDF…" /></div>}>
                                        <ExportSalesPdf sale={sale} />
                                      </Suspense>
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        setSelectedSale(sale);
                                        setDeliveryStatus(sale.deliveryStatus || "pending");
                                        setDeliveryNote(sale.deliveryNote || "");
                                        setShowDeliveryModal(true);
                                      }}
                                      size="sm"
                                    >
                                      Gérer livraison
                                    </Button>
                                  </div>
                                )}
                                {sale.status !== "completed" && sale.status !== "cancelled" && (
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSale(sale);
                                      setShowPaymentModal(true);
                                    }}
                                    variant="primary"
                                    className="w-full sm:w-auto"
                                  >
                                    Ajouter Paiement
                                  </Button>
                                )}
                              </>
                            }
                          />
                        );
                      })
                    )}
                  </div>
                </section>
              </GlassCard>
            </div>

            {/* Modal Export */}
            {isAdmin && showExportModal && (
              <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-gray-950/45 backdrop-blur-md p-4"
                onClick={() => setShowExportModal(false)}
              >
                <div
                  className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--ms-blue-soft)] text-[var(--ms-blue)]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </span>
                      Exporter les ventes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowExportModal(false)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
                      aria-label="Fermer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                    <Suspense fallback={<div className="flex justify-center py-4"><AppLoader fullScreen={false} text="Préparation…" /></div>}>
                      <ExportSales />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Livraison */}
            {showDeliveryModal && selectedSale && (
              <div
                className="fixed inset-0 z-[260] flex items-center justify-center bg-gray-950/45 backdrop-blur-md p-4"
                onClick={() => setShowDeliveryModal(false)}
              >
                <div
                  className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-100 text-green-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2M5 8a2 2 0 011-2h12a2 2 0 011 2m-2 6h.01M17 16h.01" />
                        </svg>
                      </span>
                      Statut de livraison
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowDeliveryModal(false)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
                      aria-label="Fermer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-5 sm:p-6 space-y-4">
                    <div>
                      <label htmlFor="delivery-status-admin" className="block text-sm font-medium text-gray-700 mb-2">
                        Statut
                      </label>
                      <select
                        id="delivery-status-admin"
                        value={deliveryStatus || selectedSale.deliveryStatus || "pending"}
                        onChange={(e) => setDeliveryStatus(e.target.value)}
                        className="w-full min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue)] focus:border-[var(--ms-blue)]"
                      >
                        <option value="pending">En attente</option>
                        <option value="delivered">Livré</option>
                        <option value="not_delivered">Non livré</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="delivery-note-admin" className="block text-sm font-medium text-gray-700 mb-2">
                        Note (optionnelle)
                      </label>
                      <textarea
                        id="delivery-note-admin"
                        value={deliveryNote || selectedSale.deliveryNote || ""}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Notes sur la livraison…"
                        className="w-full min-h-[88px] px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue)] focus:border-[var(--ms-blue)] resize-y"
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-gray-500 mt-1">{deliveryNote.length}/500 caractères</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 px-5 py-4 sm:px-6 border-t border-gray-100 bg-gray-50/30">
                    <button
                      type="button"
                      onClick={() => setShowDeliveryModal(false)}
                      disabled={isUpdatingDelivery}
                      className="min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateDelivery}
                      disabled={isUpdatingDelivery}
                      className="min-h-[44px] px-4 py-2.5 bg-[var(--ms-blue)] text-white rounded-xl hover:bg-[var(--ms-blue-dark)] flex items-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] focus-visible:ring-offset-2"
                    >
                      {isUpdatingDelivery ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Mise à jour…
                        </>
                      ) : (
                        "Enregistrer"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Paiement */}
            <Suspense fallback={null}>
              <PaymentModal
                show={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                sale={selectedSale}
                onAddPayment={handleAddPayment}
              />
            </Suspense>

            {/* Modal Détail Paiements */}
            {showPaymentsDetailModal && (() => {
              const totalEncaisse = paymentsDetailData.reduce((sum, p) => sum + (p.amount || 0), 0);
              const avgEncaisse = paymentsDetailData.length ? Math.round(totalEncaisse / paymentsDetailData.length) : 0;
              const dayLabel = dateFilter
                ? new Date(dateFilter + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Toutes périodes';
              return (
                <div
                  className="fixed inset-0 z-[260] flex items-end justify-center bg-[rgba(32,31,30,0.45)] backdrop-blur-sm p-0 sm:items-center sm:p-4"
                  onClick={() => setShowPaymentsDetailModal(false)}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Paiements encaissés"
                >
                  <div
                    className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[var(--ms-shadow-lg)] sm:max-h-[88vh] sm:max-w-2xl sm:rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Grabber (mobile) */}
                    <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
                      <div className="h-1 w-10 rounded-full bg-[var(--ms-border)]" aria-hidden />
                    </div>

                    {/* Header */}
                    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 pb-4 pt-3 sm:px-6 sm:pt-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                          <CreditCard className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Paiements encaissés</h2>
                          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>{dayLabel}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPaymentsDetailModal(false)}
                        className="ms-icon-button shrink-0"
                        aria-label="Fermer"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Summary band */}
                    {!paymentsDetailLoading && paymentsDetailData.length > 0 && (
                      <div className="grid shrink-0 grid-cols-3 divide-x divide-[var(--ms-border)] border-b border-[var(--ms-border)] bg-[var(--ms-white)]">
                        <div className="px-4 py-3">
                          <p className="ms-kpi-title">Encaissé</p>
                          <p className="fui-subtitle2" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{totalEncaisse.toLocaleString('fr-FR')} CFA</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="ms-kpi-title">Paiements</p>
                          <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>{paymentsDetailData.length}</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="ms-kpi-title">Moyenne</p>
                          <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>{avgEncaisse.toLocaleString('fr-FR')} CFA</p>
                        </div>
                      </div>
                    )}

                    {/* Body */}
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                      {paymentsDetailLoading ? (
                        <LoadingSkeleton rows={5} />
                      ) : paymentsDetailData.length === 0 ? (
                        <EmptyState
                          title="Aucun paiement"
                          description={`Aucun encaissement enregistré pour ${dayLabel.toLowerCase()}.`}
                        />
                      ) : (
                        <div className="space-y-2.5">
                          {paymentsDetailData.map((payment) => {
                            const m = paymentMethodMeta(payment.method);
                            return (
                              <div key={payment._id} className="fluent-card-filled p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                                        {payment.amount?.toLocaleString('fr-FR')} CFA
                                      </p>
                                      <span className={`ms-status-badge ${m.cls}`}>{m.label}</span>
                                    </div>
                                    <p className="fui-caption1 mt-1 truncate" style={{ color: 'var(--colorNeutralForeground2)' }}>
                                      {payment.client?.name || 'Client inconnu'}
                                    </p>
                                    <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                                      {payment.paymentDate ? new Date(payment.paymentDate).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                    </p>
                                  </div>
                                  <Link
                                    to={`/sales/${payment.saleId}`}
                                    onClick={() => setShowPaymentsDetailModal(false)}
                                    className="ms-button ms-button-secondary ms-button-sm shrink-0"
                                    {...(isDesktop ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                  >
                                    Voir vente →
                                  </Link>
                                </div>
                                <div className="mt-2.5 flex items-center gap-2 rounded-[var(--radiusMedium)] px-3 py-1.5" style={{ background: 'var(--colorNeutralBackground3)' }}>
                                  <ReceiptText className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--colorNeutralForeground3)' }} />
                                  <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground2)' }}>
                                    Vente {payment.saleNumber ? `#${payment.saleNumber}` : `#${payment.saleId?.slice(-8)}`}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Historique (sales/all) */}
            {showHistoryModal && (
              <div
                className="fixed inset-0 z-[260] flex items-center justify-center bg-gray-950/45 backdrop-blur-md p-4"
                onClick={() => setShowHistoryModal(false)}
              >
                <div
                  className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <ReceiptText className="h-5 w-5 text-[var(--ms-blue)]" />
                      Historique des ventes
                      <span className="text-sm font-normal text-[var(--ms-text-muted)]">({filteredSales.length} ventes)</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowHistoryModal(false)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100"
                      aria-label="Fermer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                    {filteredSales.length === 0 ? (
                      <div className="text-center py-8 text-[var(--ms-text-muted)]">
                        Aucune vente trouvée avec ces filtres.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredSales.map((sale) => {
                          const { totalPaid, balance } = calculateSaleTotals(sale);
                          const isModified = (sale.modificationCount || 0) > 0;
                          return (
                            <SaleCard
                              key={sale._id}
                              sale={sale}
                              totalPaid={totalPaid}
                              balance={balance}
                              formatDate={formatDate}
                              getStatusClass={getStatusClass}
                              getStatusText={getStatusText}
                              isModified={isModified}
                              desktopLinkProps={desktopLinkProps}
                              linkState={saleLinkState}
                              returnTo={salesReturnPath}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 px-5 py-4 sm:px-6 border-t border-gray-100 bg-gray-50/30">
                    <SalesListExportButtons
                      sales={filteredSales}
                      filenamePrefix="ventes-filtrees"
                      label="Ventes filtrées"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Workspace>
  );
};

export default Sales;
