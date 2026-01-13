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
import api from "../services/api";
import toast, { Toaster } from "react-hot-toast";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import AuthContext from "../context/AuthContext";
import useAutoClearMessage from "../hooks/useAutoClearMessage";
import useResponsiveTable from "../hooks/useResponsiveTable";
import {
  calculateSaleTotals,
  calculateSaleProfit,
  calculateSaleMargin,
  deriveProfitCategoryFromMargin,
  formatDate,
  getStatusClass,
  getStatusText,
  getProfitCategoryClass,
  getProfitCategoryText,
  parseDateSafely,
} from "../utils/saleUtils";

// Enregistrement Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Lazy components
const SaleForm = lazy(() => import("../components/SaleForm"));
const ExportSales = lazy(() => import("../components/ExportSales"));
const ExportSalesPdf = lazy(() => import("../components/ExportSalesPdf"));
const PaymentModal = lazy(() => import("../components/PaymentModal"));

/* ===============================
   Utilitaires
   =============================== */
const getTodayFilterValue = () => new Date().toLocaleDateString("fr-CA");

/* ===============================
   Sous-composants UI
   =============================== */
const GlassCard = ({ children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className={`rounded-2xl border border-gray-200/70 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow ${className}`}
  >
    {children}
  </motion.div>
);

const StatCard = ({ title, value, icon, color }) => (
  <GlassCard>
    <div className="p-5 flex items-center">
      <div
        className={`p-3 rounded-xl mr-4 text-white shadow-inner ${color}`}
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  </GlassCard>
);

const AdvancedMetricCard = ({ title, value, change, icon, color, description }) => (
  <GlassCard>
    <div className="p-6">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <div
              className={`flex items-center mt-1 text-sm ${
                change > 0
                  ? "text-green-600"
                  : change < 0
                  ? "text-red-600"
                  : "text-gray-500"
              }`}
            >
              <svg
                className={`w-4 h-4 mr-1 ${change > 0 ? "rotate-0" : "rotate-180"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {change > 0 ? "+" : ""}
              {typeof change === "number" ? change.toFixed(1) : change}%
            </div>
          )}
        </div>
        <div
          className={`p-3 rounded-xl text-white ${color}`}
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }}
        >
          {icon}
        </div>
      </div>
      {description && <p className="text-xs text-gray-500 mt-2">{description}</p>}
    </div>
  </GlassCard>
);

const ClientSegmentationChart = ({ segmentation }) => {
  const segments = segmentation.reduce((acc, client) => {
    acc[client.segment] = (acc[client.segment] || 0) + 1;
    return acc;
  }, {});
  const data = {
    labels: Object.keys(segments),
    datasets: [
      {
        data: Object.values(segments),
        backgroundColor: ["#a78bfa", "#34d399", "#60a5fa", "#fbbf24", "#f87171"],
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
          plugins: { legend: { position: "bottom" } },
        }}
      />
    </div>
  );
};

const ProductPerformanceChart = ({ products }) => {
  const data = {
    labels: products.slice(0, 6).map((p) => p.product?.name || "Produit"),
    datasets: [
      {
        label: "Revenus (CFA)",
        data: products.slice(0, 6).map((p) => p.quantity * (p.product?.price || 0)),
        backgroundColor: "rgba(59, 130, 246, .85)",
      },
    ],
  };
  return (
    <div className="h-64">
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        }}
      />
    </div>
  );
};

/* ===============================
   Analytics bénéfices (réutilisable)
   =============================== */
const ProfitAnalysis = () => {
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    period: "month",
    startDate: "",
    endDate: "",
    category: "",
  });

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

  const handleFilterChange = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const topProductsTableRef = useRef(null);
  const categoryTableRef = useRef(null);
  useResponsiveTable(topProductsTableRef, [profitData?.topProducts || []]);
  useResponsiveTable(categoryTableRef, [profitData?.profitByCategory || []]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500" />
      </div>
    );

  if (!profitData)
    return (
      <GlassCard>
        <div className="text-center p-6 text-red-600">
          Impossible de charger l’analyse des bénéfices
        </div>
      </GlassCard>
    );

  const { periodAnalytics, topProducts, generalStats, profitByCategory } =
    profitData;

  const profitTrendChart = {
    labels: periodAnalytics.map((item) =>
      filters.period === "day"
        ? `Jour ${item._id}`
        : filters.period === "week"
        ? `Semaine ${item._id}`
        : filters.period === "month"
        ? `Mois ${item._id}`
        : `Année ${item._id}`
    ),
    datasets: [
      {
        label: "Bénéfice (CFA)",
        data: periodAnalytics.map((i) => i.totalProfit || 0),
        borderColor: "rgb(34,197,94)",
        backgroundColor: "rgba(34,197,94,.12)",
        fill: true,
        tension: 0.35,
      },
      {
        label: "Chiffre d'affaires (CFA)",
        data: periodAnalytics.map((i) => i.totalSales || 0),
        borderColor: "rgb(59,130,246)",
        backgroundColor: "rgba(59,130,246,.12)",
        fill: true,
        tension: 0.35,
      },
    ],
  };

  const topProductsChart = {
    labels: topProducts.slice(0, 8).map((p) =>
      p.productName.length > 24 ? p.productName.slice(0, 24) + "…" : p.productName
    ),
    datasets: [
      {
        label: "Bénéfice (CFA)",
        data: topProducts.slice(0, 8).map((p) => p.totalProfit || 0),
        backgroundColor: "rgba(34,197,94,.9)",
        borderColor: "rgb(34,197,94)",
        borderWidth: 1,
      },
    ],
  };

  const profitByCategoryChart = {
    labels: profitByCategory.map((c) => c._id || "Non catégorisé"),
    datasets: [
      {
        label: "Bénéfice (CFA)",
        data: profitByCategory.map((c) => c.totalProfit || 0),
        backgroundColor: [
          "rgba(99,102,241,.85)",
          "rgba(34,197,94,.85)",
          "rgba(59,130,246,.85)",
          "rgba(234,179,8,.85)",
          "rgba(239,68,68,.85)",
        ],
      },
    ],
  };

  return (
    
    <div className="space-y-6">
      
      {/* Filtres */}
      <GlassCard>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Filtres d’analyse
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Période
              </label>
              <select
                value={filters.period}
                onChange={(e) => handleFilterChange("period", e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
              >
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date début
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date fin
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() =>
                  setFilters({ period: "month", startDate: "", endDate: "", category: "" })
                }
                className="w-full p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* KPIs Bénéfices */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Bénéfice total"
          value={`${(profitData.generalStats.totalProfit || 0).toLocaleString("fr-FR")} CFA`}
          icon={<span className="inline-block">💵</span>}
          color="bg-green-500"
        />
        <StatCard
          title="Marge moyenne"
          value={`${(profitData.generalStats.averageMargin || 0).toFixed(2)}%`}
          icon={<span className="inline-block">📈</span>}
          color="bg-blue-500"
        />
        <StatCard
          title="Bénéfice moyen / vente"
          value={`${(profitData.generalStats.averageProfit || 0).toLocaleString("fr-FR")} CFA`}
          icon={<span className="inline-block">➕</span>}
          color="bg-purple-500"
        />
        <StatCard
          title="Ventes rentables"
          value={`${profitData.generalStats.profitableSales || 0}/${profitData.generalStats.saleCount || 0}`}
          icon={<span className="inline-block">✅</span>}
          color="bg-teal-500"
        />
      </div>

      {/* Graphiques bénéfices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Évolution des bénéfices
            </h3>
            <div className="h-64">
              <Line
                data={profitTrendChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "top" } },
                  scales: {
                    y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Top produits rentables
            </h3>
            <div className="h-64">
              <Bar
                data={topProductsChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Détails produits & par catégorie */}
      <GlassCard>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Détail des produits les plus rentables
          </h3>
          <div className="overflow-visible md:overflow-x-auto">
            <table ref={topProductsTableRef} className="w-full responsive-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-gray-600">Produit</th>
                  <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Qté</th>
                  <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">CA</th>
                  <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Coût</th>
                  <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Bénéfice</th>
                  <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Marge</th>
                </tr>
              </thead>
              <tbody className="md:divide-y md:divide-gray-100">
                {profitData.topProducts.slice(0, 10).map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium text-gray-900">
                      {p.productName}
                      <div className="mt-2 text-xs text-gray-500 space-y-1 md:hidden">
                        <p>Quantité: {p.totalQuantity}</p>
                        <p>CA: {(p.totalRevenue || 0).toLocaleString("fr-FR")} CFA</p>
                        <p>Coût: {(p.totalCost || 0).toLocaleString("fr-FR")} CFA</p>
                        <p>Bénéfice: {(p.totalProfit || 0).toLocaleString("fr-FR")} CFA</p>
                        <p>Marge: {(p.profitMargin || 0).toFixed(2)}%</p>
                      </div>
                    </td>
                    <td className="hidden md:table-cell p-3 text-sm md:text-right">
                      {p.totalQuantity}
                    </td>
                    <td className="hidden md:table-cell p-3 text-sm md:text-right">
                      {(p.totalRevenue || 0).toLocaleString("fr-FR")} CFA
                    </td>
                    <td className="hidden md:table-cell p-3 text-sm md:text-right">
                      {(p.totalCost || 0).toLocaleString("fr-FR")} CFA
                    </td>
                    <td className="hidden md:table-cell p-3 text-sm font-semibold text-green-600 md:text-right">
                      {(p.totalProfit || 0).toLocaleString("fr-FR")} CFA
                    </td>
                    <td className="hidden md:table-cell p-3 text-sm font-semibold text-blue-600 md:text-right">
                      {(p.profitMargin || 0).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>

      {profitData.profitByCategory.length > 0 && (
        <GlassCard>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Bénéfices par catégorie
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <Bar
                  data={profitByCategoryChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
              <div className="overflow-visible md:overflow-x-auto">
                <table ref={categoryTableRef} className="w-full responsive-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium text-gray-600">
                        Catégorie
                      </th>
                      <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">
                        Bénéfice
                      </th>
                      <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">
                        Marge
                      </th>
                      <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">
                        Ventes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="md:divide-y md:divide-gray-100">
                    {profitData.profitByCategory.map((c, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="p-3 text-sm font-medium text-gray-900">
                          {c._id || "Non catégorisé"}
                          <div className="mt-2 text-xs text-gray-500 space-y-1 md:hidden">
                            <p>Bénéfice: {(c.totalProfit || 0).toLocaleString("fr-FR")} CFA</p>
                            <p>Marge: {(c.profitMargin || 0).toFixed(2)}%</p>
                            <p>Ventes: {c.saleCount}</p>
                          </div>
                        </td>
                        <td className="hidden md:table-cell p-3 text-sm font-semibold text-green-600 md:text-right">
                          {(c.totalProfit || 0).toLocaleString("fr-FR")} CFA
                        </td>
                        <td className="hidden md:table-cell p-3 text-sm text-blue-600 md:text-right">
                          {(c.profitMargin || 0).toFixed(2)}%
                        </td>
                        <td className="hidden md:table-cell p-3 text-sm text-gray-700 md:text-right">
                          {c.saleCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </GlassCard>
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
  const [dateFilter, setDateFilter] = useState(() => getTodayFilterValue());
  const [deliveryFilter, setDeliveryFilter] = useState("");
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

  // Livraison
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);

  // Vues
  const [viewMode, setViewMode] = useState("dashboard"); // 'dashboard' | 'analytics' | 'profits' | 'clients'
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
    if (params.has("date")) {
      setDateFilter(params.get("date") || "");
    }
    if (params.has("delivery")) {
      setDeliveryFilter(params.get("delivery") || "");
    }
  }, [location.search]);

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
      const list = Array.isArray(res.data) ? res.data : res.data.clients || [];
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
      setProducts(res.data);
      return res.data;
    } catch {
      setError("Erreur de chargement des produits");
      return [];
    }
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api.get("/sales");
      setSales(res.data || []);
      return res.data || [];
    } catch {
      setError("Erreur de chargement des ventes");
      setSales([]);
      return [];
    }
  }, []);

  const fetchDashboardData = useCallback(
    async (range, dayFilter) => {
      try {
        setDashboardLoading(true);
        const params = new URLSearchParams({ range });
        if (dayFilter) params.append("summaryDate", dayFilter);
        const { data } = await api.get(`/sales/dashboard-sale?${params.toString()}`);
        setDashboardData((prev) => ({ ...prev, ...data }));
      } catch (e) {
        setMessage("Erreur de chargement du tableau de bord");
      } finally {
        setDashboardLoading(false);
      }
    },
    [setMessage]
  );

  // Essaye d'utiliser l’endpoint /sales/delivery-stats sinon calcule localement
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

  // Chargers initiaux
  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const [clientsData, , salesData] = await Promise.all([
          fetchClients(),
          fetchProducts(),
          fetchSales(),
        ]);

        await hydrateDeliveryStats(salesData);

        if (isAdmin) {
          await fetchDashboardData(timeRange, dateFilter);
          const predictive = calculatePredictiveAnalytics(salesData);
          const segmentation = analyzeClientSegmentation(salesData);
          const anomaliesDetected = detectAnomalies(salesData);
          const kpis = calculateAdvancedKPIs(salesData, clientsData);

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
        }
      } catch {
        setError("Erreur de chargement des données");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [isAdmin, timeRange, dateFilter, fetchClients, fetchProducts, fetchSales, fetchDashboardData, hydrateDeliveryStats]);

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

  const filteredSales = useMemo(() => {
    const base = salesWithProfit.filter((sale) => {
      const statusMatch = !statusFilter || sale.status === statusFilter;
      const clientMatch = !clientFilter || sale.client?._id === clientFilter;
      const d = parseDateSafely(sale.saleDate);
      const dateMatch = !dateFilter || (d && d.toLocaleDateString("fr-CA") === dateFilter);
      const deliveryMatch =
        !deliveryFilter ||
        (sale.status === "completed" &&
          (deliveryFilter === "all_completed" || sale.deliveryStatus === deliveryFilter));
      return statusMatch && clientMatch && dateMatch && deliveryMatch;
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
      const byClient = salesWithProfit.reduce((acc, s) => {
        if (s.client) acc[s.client._id] = (acc[s.client._id] || 0) + 1;
        return acc;
      }, {});
      out = out.filter((s) => s.client && byClient[s.client._id] > 1);
    }
    if (quickFilters.highProfit) out = out.filter((s) => (s.computedProfit || 0) > 10000);
    return out;
  }, [salesWithProfit, statusFilter, clientFilter, dateFilter, deliveryFilter, quickFilters]);

  const desktopLinkProps = useMemo(
    () => (isDesktop ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    [isDesktop]
  );

  const hasActiveFilters = Boolean(statusFilter || clientFilter || dateFilter || deliveryFilter);

  const historyLinkSearch = useMemo(() => {
    const params = new URLSearchParams();
    params.set("history", "1");
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("client", clientFilter);
    if (dateFilter) params.set("date", dateFilter);
    if (deliveryFilter) params.set("delivery", deliveryFilter);
    return `?${params.toString()}`;
  }, [statusFilter, clientFilter, dateFilter, deliveryFilter]);

  const historyLinkLabel = hasActiveFilters ? "Ouvrir ces filtres" : "Voir toutes les ventes";

  /* ========= Manipulations ========= */
  const handleSubmitSale = async (saleData) => {
    try {
      setMessage("");
      await api.post("/sales", saleData);
      setMessage("Vente enregistrée avec succès !");
      toast.success("Vente enregistrée avec succès !");
      const updated = await fetchSales();
      await hydrateDeliveryStats(updated);
      if (isAdmin) await fetchDashboardData(timeRange, dateFilter);
    } catch (e) {
      setMessage("Erreur: " + (e.response?.data?.message || e.message));
    }
  };

  const handleAddPayment = async (paymentData) => {
    if (!selectedSale) return;
    try {
      await api.post(`/sales/${selectedSale._id}/payments`, paymentData);
      const updated = await fetchSales();
      setMessage("Paiement ajouté avec succès !");
      setShowPaymentModal(false);
      await hydrateDeliveryStats(updated);
      if (isAdmin) await fetchDashboardData(timeRange, dateFilter);
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
      await api.put(`/sales/${selectedSale._id}/delivery`, payload);
      const updated = await fetchSales();
      await hydrateDeliveryStats(updated);
      setMessage("✅ Statut de livraison mis à jour avec succès !");
      setIsUpdatingDelivery(false);
      setShowDeliveryModal(false);
    } catch (e) {
      setMessage("❌ Erreur: " + (e.response?.data?.message || e.message));
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
    labels: dashboardData.topProducts.map((i) => i.product?.name || "Produit").slice(0, 6),
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

  const paymentMethodsChart = {
    labels: Object.keys(dashboardData.paymentMethods || {}).map((m) =>
      m === "MobileMoney" ? "Mobile Money" : m || "Non spécifié"
    ),
    datasets: [
      {
        label: "Répartition %",
        data: Object.values(dashboardData.paymentMethods || {}),
        backgroundColor: [
          "rgba(59,130,246,.9)",
          "rgba(34,197,94,.9)",
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

  // Timeline livraison (7 jours)
  const last7Days = [...Array(7)]
    .map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
    })
    .reverse();

  // Data factice timeline (vous pouvez l’alimenter avec vos données agrégées si disponibles)
  const deliveryTimelineData = {
    labels: last7Days,
    datasets: [
      {
        label: "Livraisons / jour (estim.)",
        data: last7Days.map(() => Math.floor(Math.random() * 10)),
        backgroundColor: "rgba(34,197,94,.85)",
        borderRadius: 8,
      },
    ],
  };

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

  const paymentTableRef = useRef(null);
  const statusTableRef = useRef(null);
  useResponsiveTable(paymentTableRef, [dashboardData?.paymentMethods]);
  useResponsiveTable(statusTableRef, [dashboardData?.statusStats]);

  /* ========= Barre de filtres rapides ========= */
  const QuickFilterBar = () => (
    <div className="flex flex-wrap gap-3 mb-2">
      <button
        onClick={() => setQuickFilters((p) => ({ ...p, highValue: !p.highValue }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.highValue
            ? "bg-purple-100 border-purple-500 text-purple-700"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        💎 Hautes Valeurs
      </button>
      <button
        onClick={() => setQuickFilters((p) => ({ ...p, latePayments: !p.latePayments }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.latePayments
            ? "bg-red-100 border-red-500 text-red-700"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        ⚠️ Retards Paiement
      </button>
      <button
        onClick={() => setQuickFilters((p) => ({ ...p, recurring: !p.recurring }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.recurring
            ? "bg-green-100 border-green-500 text-green-700"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        🔄 Clients Récurrents
      </button>
      <button
        onClick={() => setQuickFilters((p) => ({ ...p, highProfit: !p.highProfit }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.highProfit
            ? "bg-emerald-100 border-emerald-500 text-emerald-700"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        💰 Hauts Bénéfices
      </button>
      {(quickFilters.highValue ||
        quickFilters.latePayments ||
        quickFilters.recurring ||
        quickFilters.highProfit) && (
        <button
          onClick={() =>
            setQuickFilters({
              highValue: false,
              latePayments: false,
              recurring: false,
              highProfit: false,
            })
          }
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
        >
          ✕ Effacer
        </button>
      )}
    </div>
  );

  /* ========= Écrans d’attente / erreur ========= */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (error) {
    return (
      <GlassCard>
        <div className="p-4 text-red-700">{error}</div>
      </GlassCard>
    );
  }

  // Vue simplifiée pour les utilisateurs non administrateurs
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              Gestion des ventes
            </h1>
            <p className="text-gray-600 mt-1">
              Enregistrez vos ventes et consultez l'historique en temps réel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard>
              <div className="p-6">
                <Suspense fallback={<div className="text-sm text-gray-500">Chargement du formulaire…</div>}>
                  <SaleForm clients={clients} products={products} onSubmit={handleSubmitSale} />
                </Suspense>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <span className="bg-purple-500 p-1.5 rounded-lg text-white">📚</span>
                    Historique des Ventes
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to={{ pathname: "/sales/all", search: historyLinkSearch }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      {...desktopLinkProps}
                    >
                      {historyLinkLabel}
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/sales/deleted"
                        className="text-sm font-medium text-rose-600 hover:text-rose-700"
                        {...desktopLinkProps}
                      >
                        Ventes supprimées
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Statut</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Tous</option>
                      <option value="completed">Payée</option>
                      <option value="partially_paid">Partiellement payée</option>
                      <option value="pending">En attente</option>
                      <option value="cancelled">Annulée</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Client</label>
                    <select
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Tous les clients</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Date</label>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Toutes les dates</option>
                      <option value="today">Aujourd'hui</option>
                      <option value="week">Cette semaine</option>
                      <option value="month">Ce mois</option>
                      <option value="quarter">Ce trimestre</option>
                      <option value="year">Cette année</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Livraison</label>
                    <select
                      value={deliveryFilter}
                      onChange={(e) => setDeliveryFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Tous</option>
                      <option value="delivered">Livré</option>
                      <option value="pending">En attente</option>
                      <option value="not_delivered">Non livré</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 invisible md:visible">
                      &nbsp;
                    </label>
                    <button
                      onClick={() => {
                        setStatusFilter("");
                        setClientFilter("");
                        setDateFilter("");
                        setDeliveryFilter("");
                        setQuickFilters({ highValue: false, latePayments: false, recurring: false, highProfit: false });
                      }}
                      className="w-full p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredSales.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                      Aucune vente trouvée
                    </div>
                  ) : (
                    filteredSales.map((sale) => {
                      const { totalPaid, balance } = calculateSaleTotals(sale);
                      return (
                        <motion.div
                          key={sale._id}
                          whileHover={{ scale: 1.01 }}
                          className="bg-white p-5 rounded-xl shadow-sm border border-gray-200"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <Link
                              to={`/sales/${sale._id}`}
                              className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 transition-colors"
                              {...desktopLinkProps}
                            >
                              <span>Vente #{sale._id.slice(-6)}</span>
                            </Link>
                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">
                              <span className="text-sm text-gray-500 inline-flex items-center gap-1">
                                📅 {formatDate(sale.saleDate)}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs ${getStatusClass(sale.status)}`}>
                                {getStatusText(sale.status)}
                              </span>
                              {sale.status === "completed" && (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    sale.deliveryStatus === "delivered"
                                      ? "bg-green-100 text-green-800"
                                      : sale.deliveryStatus === "not_delivered"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {sale.deliveryStatus === "delivered"
                                    ? "Livré"
                                    : sale.deliveryStatus === "not_delivered"
                                    ? "Non livré"
                                    : "En attente"}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <span className="font-medium text-gray-900">
                              {sale.client?.name || "Client non spécifié"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-4">
                            <div>
                              <p className="text-gray-500">Total</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {(sale.totalAmount || 0).toLocaleString()} CFA
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Payé</p>
                              <p className="text-lg font-semibold text-green-600">
                                {totalPaid.toLocaleString()} CFA
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Solde</p>
                              <p className={`text-lg font-semibold ${balance > 0 ? "text-red-600" : "text-gray-900"}`}>
                                {balance.toLocaleString()} CFA
                              </p>
                            </div>
                          </div>

                          {Array.isArray(sale.products) && sale.products.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-semibold text-gray-800 mb-1">Produits</p>
                              <ul className="space-y-1 text-sm text-gray-600">
                                {sale.products.map((item, idx) => (
                                  <li key={idx} className="flex justify-between">
                                    <span>{item.product?.name || "Produit"}</span>
                                    <span className="text-gray-500">
                                      x{item.quantity || 0}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="mt-4 flex flex-col gap-2">
                            {sale.status !== "completed" && sale.status !== "cancelled" && (
                              <button
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setShowPaymentModal(true);
                                }}
                                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors text-sm font-medium"
                              >
                                Ajouter un paiement
                              </button>
                            )}
                            {sale.status === "completed" && (
                              <button
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setDeliveryStatus(sale.deliveryStatus || "pending");
                                  setDeliveryNote(sale.deliveryNote || "");
                                  setShowDeliveryModal(true);
                                }}
                                className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors text-sm font-medium"
                              >
                                Gérer la livraison
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
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
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Statut de livraison</h3>
                  <button
                    onClick={() => setShowDeliveryModal(false)}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Statut
                    </label>
                    <select
                      value={deliveryStatus || selectedSale.deliveryStatus || "pending"}
                      onChange={(e) => setDeliveryStatus(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pending">En attente</option>
                      <option value="delivered">Livré</option>
                      <option value="not_delivered">Non livré</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note (optionnelle)
                    </label>
                    <textarea
                      value={deliveryNote || selectedSale.deliveryNote || ""}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Notes sur la livraison…"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      maxLength="500"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {deliveryNote.length}/500 caractères
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowDeliveryModal(false)}
                      disabled={isUpdatingDelivery}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-60"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleUpdateDelivery}
                      disabled={isUpdatingDelivery}
                      className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 disabled:bg-blue-400"
                    >
                      {isUpdatingDelivery ? (
                        <>
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Mise à jour…
                        </>
                      ) : (
                        "Enregistrer"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ========= Rendu principal ========= */
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Toaster position="top-right" />
        {/* En-tête */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              📊 Tableau de Bord Commercial
            </h1>
            <p className="text-gray-600 mt-1">Analyses avancées, encaissements et livraisons</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-300 transition-colors"
              >
                📤 Exporter
              </button>
            )}

            {isAdmin && (
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="dashboard">📋 Vue Standard</option>
                <option value="analytics">📈 Analytics Avancées</option>
                <option value="profits">💰 Analyse Bénéfices</option>
                <option value="clients">👥 Analyse Clients</option>
              </select>
            )}
          </div>
        </div>

        {/* Notification */}
        {message && (
          <GlassCard>
            <div
              className={`p-4 flex items-center gap-3 ${
                message.includes("succès")
                  ? "text-green-700 bg-green-50 rounded-2xl"
                  : "text-red-700 bg-red-50 rounded-2xl"
              }`}
            >
              {message}
            </div>
          </GlassCard>
        )}

        {/* Vues alternatives */}
        {viewMode === "analytics" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Analytics Avancées</h2>
                <p className="text-gray-600">Données prédictives et analyses détaillées</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => setViewMode("dashboard")}
                      className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                    >
                      Vue Standard
                    </button>
                    <button
                      onClick={() => setViewMode("profits")}
                      className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                    >
                      Analyse Bénéfices
                    </button>
                    <button
                      onClick={() => setViewMode("clients")}
                      className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Analyse Clients
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setViewMode("clients")}
                    className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    Voir Les Analyses Clients
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AdvancedMetricCard
                title="Prévision 30 jours"
                value={`${Math.round(predictiveData?.next30Days || 0).toLocaleString("fr-FR")} CFA`}
                change={predictiveData?.growthRate}
                icon={<span className="inline-block">📊</span>}
                color="bg-gradient-to-r from-blue-500 to-purple-600"
                description={`Confiance: ${predictiveData?.confidence || 0}%`}
              />
              <AdvancedMetricCard
                title="CLV (Valeur Client)"
                value={`${Math.round(dashboardData.kpis.customerLifetimeValue).toLocaleString("fr-FR")} CFA`}
                change={12.5}
                icon={<span className="inline-block">👥</span>}
                color="bg-gradient-to-r from-emerald-500 to-teal-600"
                description="Valeur moyenne par client"
              />
              <AdvancedMetricCard
                title="Taux de conversion"
                value={`${dashboardData.kpis.conversionRate.toFixed(1)}%`}
                change={8.2}
                icon={<span className="inline-block">✅</span>}
                color="bg-gradient-to-r from-orange-500 to-red-600"
                description="Clients actifs / prospects"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Segmentation Client (RFM)
                  </h3>
                  <ClientSegmentationChart segmentation={clientSegmentation} />
                </div>
              </GlassCard>

              <GlassCard>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Performance des Produits
                  </h3>
                  <ProductPerformanceChart products={dashboardData.topProducts} />
                </div>
              </GlassCard>
            </div>

            {anomalies.length > 0 && (
              <GlassCard>
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-2xl">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-3">
                    Alertes d’anomalies ({anomalies.length})
                  </h3>
                  <div className="space-y-2">
                    {anomalies.slice(0, 3).map((a, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-3 bg-white rounded-lg"
                      >
                        <div>
                          <span className="font-medium">
                            Vente #{a._id?.slice(-6) || "N/A"}
                          </span>
                          <span className="text-sm text-gray-600 ml-2">
                            {a.client?.name} - {formatDate(a.saleDate)}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            a.deviation > 0
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {a.deviation > 0 ? "+" : ""}
                          {a.deviation}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {viewMode === "profits" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">💰 Analyse des Bénéfices</h2>
              <button
                onClick={() => setViewMode("analytics")}
                className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
              >
                Retour aux Analytics
              </button>
            </div>
            <ProfitAnalysis />
          </div>
        )}

        {viewMode === "clients" && (
          <GlassCard>
            <div className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Analyse Client</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => navigate("/sales/partially-paid")}
                    className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 text-center"
                  >
                    Consulter les ventes partiellement payées →
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setViewMode("analytics")}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-center"
                    >
                      Retour aux Analytics
                    </button>
                  )}
                </div>
              </div>

              {isAdmin ? (
                <ClientSegmentationChart segmentation={clientSegmentation} />
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-700">
                    Accédez rapidement aux ventes partiellement payées pour suivre les encaissements
                    en attente ou à relancer.
                  </p>
                  <button
                    onClick={() =>
                      navigate({
                        pathname: "/sales/partially-paid",
                        search: `?status=partially_paid`,
                      })
                    }
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors"
                  >
                    Ouvrir les ventes partiellement payées
                  </button>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Vue Standard (Dashboard) */}
        {viewMode === "dashboard" && (
          <>
            {/* Filtres rapides */}
            {isAdmin && <QuickFilterBar />}

            {/* Range & actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span className="bg-indigo-500 p-1.5 rounded-lg text-white">📈</span>
                Tableau de bord des ventes
              </h2>

              <div className="flex flex-wrap gap-2">
                {["7days", "30days", "90days", "all"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      timeRange === r
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-700 border border-gray-300"
                    }`}
                  >
                    {r === "7days"
                      ? "7 jours"
                      : r === "30days"
                      ? "30 jours"
                      : r === "90days"
                      ? "90 jours"
                      : "Tous"}
                  </button>
                ))}
              </div>
            </div>

            {dashboardLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
              </div>
            ) : (
              <>
                {/* KPIs (incluant Encaissements) */}
                <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                  <StatCard
                    title="Chiffre d'affaires"
                    value={`${dashboardData.totalSales.toLocaleString("fr-FR")} CFA`}
                    icon={<span className="inline-block">💶</span>}
                    color="bg-blue-500"
                  />
                  <StatCard
                    title="Nombre de ventes"
                    value={dashboardData.salesCount}
                    icon={<span className="inline-block">🧾</span>}
                    color="bg-green-500"
                  />
                  <StatCard
                    title="Vente moyenne"
                    value={`${dashboardData.averageSale.toLocaleString("fr-FR")} CFA`}
                    icon={<span className="inline-block">📏</span>}
                    color="bg-purple-500"
                  />
                  <StatCard
                    title="Produits vendus"
                    value={dashboardData.totalProducts}
                    icon={<span className="inline-block">📦</span>}
                    color="bg-yellow-500"
                  />
                  <StatCard
                    title="Paiements (nb)"
                    value={dashboardData.paymentsSummary.paymentsCount}
                    icon={<span className="inline-block">💳</span>}
                    color="bg-indigo-500"
                  />
                  <StatCard
                    title="Total payé"
                    value={`${dashboardData.paymentsSummary.paymentsTotal.toLocaleString("fr-FR")} CFA`}
                    icon={<span className="inline-block">✅</span>}
                    color="bg-pink-500"
                  />
                </div>

                {/* ↘︎ Sous-bloc Encaissements (lisible et compact) */}
                <GlassCard>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Encaissements (période sélectionnée)
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {dashboardData.paymentsSummary.paymentsCount} paiements, pour un total de{" "}
                      <span className="font-semibold text-gray-900">
                        {dashboardData.paymentsSummary.paymentsTotal.toLocaleString("fr-FR")} CFA
                      </span>
                      .
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
                        <div className="text-sm text-gray-600">Aujourd’hui</div>
                        <div className="text-xl font-semibold">
                          {(dashboardData.dailySummary.paymentsTotal || 0).toLocaleString("fr-FR")} CFA
                        </div>
                        <div className="text-xs text-gray-500">
                          {dashboardData.dailySummary.paymentsCount || 0} paiements
                        </div>
                      </div>
                      <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 p-4">
                        <div className="text-sm text-gray-600">Moyenne / vente</div>
                        <div className="text-xl font-semibold">
                          {dashboardData.salesCount
                            ? Math.round(
                                dashboardData.paymentsSummary.paymentsTotal / dashboardData.salesCount
                              ).toLocaleString("fr-FR")
                            : 0}{" "}
                          CFA
                        </div>
                        <div className="text-xs text-gray-500">Sur {dashboardData.salesCount} ventes</div>
                      </div>
                      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 p-4">
                        <div className="text-sm text-gray-600">Méthodes de paiement</div>
                        <div className="text-xs text-gray-700 mt-1">
                          {Object.entries(dashboardData.paymentMethods || {}).length === 0
                            ? "Aucune donnée"
                            : Object.entries(dashboardData.paymentMethods)
                                .map(([m, v]) => {
                                  const pct =
                                    typeof v === "number"
                                      ? v
                                      : typeof v?.percentage === "number"
                                      ? v.percentage
                                      : 0;
                                  return `${
                                    m === "MobileMoney" ? "Mobile Money" : m || "Non spécifié"
                                  }: ${pct.toFixed(1)}%`;
                                })
                                .join(" • ")}
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Statistiques de livraison (NOUVEAU BLOC) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <GlassCard>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Statistiques de livraison
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Taux de livraison (commandes complétées) :{" "}
                        <span className="font-semibold text-gray-900">
                          {deliveryStats.deliveryRate}%
                        </span>
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-green-50 p-4">
                          <div className="text-sm text-gray-600">Livrées</div>
                          <div className="text-xl font-semibold text-green-700">
                            {deliveryStats.delivered}
                          </div>
                        </div>
                        <div className="rounded-xl bg-amber-50 p-4">
                          <div className="text-sm text-gray-600">En attente</div>
                          <div className="text-xl font-semibold text-amber-600">
                            {deliveryStats.pending}
                          </div>
                        </div>
                        <div className="rounded-xl bg-rose-50 p-4">
                          <div className="text-sm text-gray-600">Non livrées</div>
                          <div className="text-xl font-semibold text-rose-600">
                            {deliveryStats.not_delivered}
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Répartition (Donut)
                      </h3>
                      <div className="h-56">
                        <Doughnut
                          data={deliveryChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: "bottom" } },
                          }}
                        />
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Timeline (7 jours)
                      </h3>
                      <div className="h-56">
                        <Bar
                          data={deliveryTimelineData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } },
                              x: { grid: { display: false } },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* Tendance & Top produits */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GlassCard>
                    <div className="p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Tendance des ventes
                        </h3>
                        <button
                          onClick={() => navigate("/sales/partially-paid")}
                          className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 w-full sm:w-auto text-center"
                        >
                          Consulter les ventes partiellement payées →
                        </button>
                      </div>
                      <Line
                        data={salesTrendChart}
                        options={{
                          responsive: true,
                          plugins: { legend: { position: "top" } },
                          scales: {
                            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } },
                            x: { grid: { display: false } },
                          },
                        }}
                      />
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Top produits (quantités)
                      </h3>
                      <Bar
                        data={topProductsChart}
                        options={{
                          responsive: true,
                          plugins: { legend: { position: "top" } },
                          scales: {
                            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } },
                            x: { grid: { display: false } },
                          },
                        }}
                      />
                    </div>
                  </GlassCard>

                  {/* Répartition des méthodes de paiement */}
                  <GlassCard>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Méthodes de paiement
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="h-56">
                          <Pie
                            data={paymentMethodsChart}
                            options={{
                              responsive: true,
                              plugins: { legend: { position: "bottom" } },
                            }}
                          />
                        </div>
                        <div className="overflow-visible md:overflow-x-auto">
                          <table ref={paymentTableRef} className="w-full text-left">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-sm font-medium text-gray-600">
                                  Méthode
                                </th>
                                <th className="hidden md:table-cell px-4 py-2 text-sm font-medium text-gray-600">
                                  Part
                                </th>
                              </tr>
                            </thead>
                            <tbody className="md:divide-y md:divide-gray-100">
                              {Object.entries(dashboardData.paymentMethods || {}).map(
                                ([method, value]) => (
                                  <tr key={method} className="border-b border-gray-100">
                                    <td className="px-4 py-3 text-sm">
                                      {method === "MobileMoney" ? "Mobile Money" : method || "Non spécifié"}
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3 text-sm md:text-right">
                                      {value.toFixed(1)}%
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Statut des ventes */}
                  <GlassCard>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Statut des ventes
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Pie
                            data={statusChart}
                            options={{
                              responsive: true,
                              plugins: { legend: { position: "top" } },
                            }}
                          />
                        </div>
                        <div className="overflow-visible md:overflow-x-auto">
                          <table ref={statusTableRef} className="w-full text-left">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-sm font-medium text-gray-600">
                                  Statut
                                </th>
                                <th className="hidden md:table-cell px-4 py-2 text-sm font-medium text-gray-600">
                                  Nombre
                                </th>
                                <th className="hidden md:table-cell px-4 py-2 text-sm font-medium text-gray-600">
                                  Montant
                                </th>
                              </tr>
                            </thead>
                            <tbody className="md:divide-y md:divide-gray-100">
                              {[
                                ["Payée", "completed"],
                                ["Partiellement payée", "partially_paid"],
                                ["En attente", "pending"],
                                ["Annulée", "cancelled"],
                              ].map(([label, key]) => (
                                <tr key={key} className="border-b border-gray-100">
                                  <td className="px-4 py-3 text-sm">{label}</td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm md:text-right">
                                    {dashboardData.statusStats?.[key]?.count || 0}
                                  </td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm md:text-right">
                                    {(dashboardData.statusStats?.[key]?.totalAmount || 0).toLocaleString("fr-FR")} CFA
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </>
            )}

            {/* Formulaire & Historique */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <div className="p-6">
                  <Suspense fallback={<div className="text-sm text-gray-500">Chargement du formulaire…</div>}>
                    <SaleForm clients={clients} products={products} onSubmit={handleSubmitSale} />
                  </Suspense>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <span className="bg-purple-500 p-1.5 rounded-lg text-white">📚</span>
                      Historique des Ventes
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        to={{ pathname: "/sales/all", search: historyLinkSearch }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        {...desktopLinkProps}
                      >
                        {historyLinkLabel}
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/sales/deleted"
                          className="text-sm font-medium text-rose-600 hover:text-rose-700"
                          {...desktopLinkProps}
                        >
                          Ventes supprimées
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Filtres historiques */}
                  <div className="mb-5 grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Statut</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Tous</option>
                        <option value="completed">Payée</option>
                        <option value="partially_paid">Partiellement payée</option>
                        <option value="pending">En attente</option>
                        <option value="cancelled">Annulée</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Client</label>
                      <select
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Tous les clients</option>
                        {clients.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Date</label>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Livraison</label>
                      <select
                        value={deliveryFilter}
                        onChange={(e) => setDeliveryFilter(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Tous</option>
                        <option value="all_completed">Toutes complétées</option>
                        <option value="delivered">Livrées</option>
                        <option value="pending">En attente</option>
                        <option value="not_delivered">Non livrées</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setStatusFilter("");
                          setClientFilter("");
                          setDateFilter("");
                          setDeliveryFilter("");
                          setQuickFilters({ highValue: false, latePayments: false, recurring: false, highProfit: false });
                        }}
                        className="w-full p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                      >
                        Réinitialiser
                      </button>
                    </div>
                  </div>

                  {/* Liste des ventes */}
                  <div className="space-y-4">
                    {filteredSales.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                        Aucune vente trouvée
                      </div>
                    ) : (
                      filteredSales.map((sale) => {
                        const { totalPaid, balance } = calculateSaleTotals(sale);
                        const saleProfit = sale?.computedProfit ?? calculateSaleProfit(sale);
                        const saleMargin = sale?.computedMargin ?? calculateSaleMargin(sale);
                        const profitCategory =
                          sale?.computedProfitCategory ?? deriveProfitCategoryFromMargin(saleMargin);
                        const showProfitInfo = isAdmin && sale.products?.length > 0;

                        return (
                          <motion.div
                            key={sale._id}
                            whileHover={{ scale: 1.01 }}
                            className="bg-white p-5 rounded-xl shadow-sm border border-gray-200"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <Link
                                to={`/sales/${sale._id}`}
                                className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 transition-colors"
                                {...desktopLinkProps}
                              >
                                <span>Vente #{sale._id.slice(-6)}</span>
                              </Link>

                              <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">
                                <span className="text-sm text-gray-500 inline-flex items-center gap-1">
                                  📅 {formatDate(sale.saleDate)}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs ${getStatusClass(sale.status)}`}>
                                  {getStatusText(sale.status)}
                                </span>
                                {sale.status === "completed" && (
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${
                                      sale.deliveryStatus === "delivered"
                                        ? "bg-green-100 text-green-800"
                                        : sale.deliveryStatus === "not_delivered"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {sale.deliveryStatus === "delivered"
                                      ? "Livré"
                                      : sale.deliveryStatus === "not_delivered"
                                      ? "Non livré"
                                      : "En attente"}
                                  </span>
                                )}
                                {showProfitInfo && (
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${getProfitCategoryClass(
                                      profitCategory
                                    )}`}
                                  >
                                    {getProfitCategoryText(profitCategory)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-medium text-gray-900">
                                {sale.client?.name || "Client non spécifié"}
                              </span>
                              {Array.isArray(sale.products) && sale.products.length > 0 && (
                                <div className="text-sm text-gray-500">
                                  •{" "}
                                  {sale.products
                                    .slice(0, 2)
                                    .map((item) => item.product?.name || "Produit")
                                    .join(", ")}
                                  {sale.products.length > 2 && ` +${sale.products.length - 2}`}
                                </div>
                              )}
                            </div>

                            {/* Bénéfices synthétiques */}
                            {showProfitInfo && Number.isFinite(saleProfit) && Number.isFinite(saleMargin) && (
                              <div className="mt-2 flex items-center gap-4 text-sm">
                                <span
                                  className={`font-medium ${
                                    saleProfit >= 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  💰 Bénéfice: {Math.round(saleProfit).toLocaleString("fr-FR")} CFA
                                </span>
                                <span className={saleMargin >= 0 ? "text-blue-600" : "text-red-600"}>
                                  📊 Marge: {saleMargin.toFixed(2)}%
                                </span>
                              </div>
                            )}

                            {/* Produits */}
                            <div className="space-y-3 mt-3">
                              {sale.products.map((item, idx) => {
                                const qty = Number(item.quantity) || 0;
                                const price = Number(item.priceAtSale) || 0;
                                const cost = Number(item.product?.costPrice) || 0;
                                const revenue = qty * price;
                                const profit = revenue - qty * cost;
                                const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                                return (
                                  <div
                                    key={idx}
                                    className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-start sm:justify-between"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{item.product?.name || "Produit"}</div>
                                      <div className="text-sm text-gray-600">
                                        {qty} × {price.toFixed(0)} CFA
                                      </div>
                                      {showProfitInfo && (
                                        <div className="text-xs text-gray-500 mt-1 space-y-1">
                                          <div className={profit >= 0 ? "text-green-600" : "text-red-600"}>
                                            Profit produit: {Math.round(profit).toLocaleString("fr-FR")} CFA
                                          </div>
                                          <div className={margin >= 0 ? "text-blue-600" : "text-red-600"}>
                                            Marge produit: {margin.toFixed(2)}%
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium text-gray-900">
                                        {(qty * price).toFixed(0)} CFA
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Paiements & Totaux */}
                            <div className="pt-4 border-t border-gray-100 mt-3">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-2">Paiements:</h4>
                                  <div className="space-y-2">
                                    {(sale.payments || []).map((p, i) => {
                                      const pd = parseDateSafely(p?.paymentDate);
                                      return (
                                        <div key={i} className="flex justify-between text-sm">
                                          <div>
                                            <span className="font-medium text-gray-700">
                                              {p.method === "MobileMoney" ? "Mobile Money" : p.method}
                                            </span>
                                            <span className="text-gray-500 ml-2">
                                              {pd ? pd.toLocaleDateString("fr-FR") : "Date indisponible"}
                                            </span>
                                          </div>
                                          <div className="font-medium text-gray-900">
                                            {(p.amount || 0).toFixed(0)} CFA
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-gray-700">Total:</span>
                                    <span className="font-bold text-gray-900">
                                      {(sale.totalAmount || 0).toFixed(0)} CFA
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Payé:</span>
                                    <span className="text-gray-700">{totalPaid.toFixed(0)} CFA</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-gray-700">Solde:</span>
                                    <span
                                      className={`font-bold ${
                                        balance > 0 ? "text-red-600" : "text-green-600"
                                      }`}
                                    >
                                      {balance.toFixed(0)} CFA
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                              {sale.status === "completed" && (
                                <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
                                  <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
                                    <Suspense fallback={<span className="text-xs text-gray-400">PDF…</span>}>
                                      <ExportSalesPdf sale={sale} />
                                    </Suspense>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSelectedSale(sale);
                                      setDeliveryStatus(sale.deliveryStatus || "pending");
                                      setDeliveryNote(sale.deliveryNote || "");
                                      setShowDeliveryModal(true);
                                    }}
                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                                  >
                                    Gérer livraison
                                  </button>
                                </div>
                              )}

                              {sale.status !== "completed" && sale.status !== "cancelled" && (
                                <button
                                  onClick={() => {
                                    setSelectedSale(sale);
                                    setShowPaymentModal(true);
                                  }}
                                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl transition-colors w-full sm:w-auto"
                                >
                                  Ajouter Paiement
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Modal Export */}
            {isAdmin && showExportModal && (
              <div
                className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                onClick={() => setShowExportModal(false)}
              >
                <div
                  className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">
                        Exporter les ventes
                      </h2>
                      <button
                        onClick={() => setShowExportModal(false)}
                        className="text-gray-500 hover:bg-gray-100 p-2 rounded-full"
                      >
                        ✕
                      </button>
                    </div>
                    <Suspense fallback={<div className="text-sm text-gray-500">Préparation…</div>}>
                      <ExportSales />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Livraison */}
            {showDeliveryModal && selectedSale && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Statut de livraison</h3>
                    <button
                      onClick={() => setShowDeliveryModal(false)}
                      className="text-gray-500 hover:text-gray-700 p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Statut
                      </label>
                      <select
                        value={deliveryStatus || selectedSale.deliveryStatus || "pending"}
                        onChange={(e) => setDeliveryStatus(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="pending">En attente</option>
                        <option value="delivered">Livré</option>
                        <option value="not_delivered">Non livré</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Note (optionnelle)
                      </label>
                      <textarea
                        value={deliveryNote || selectedSale.deliveryNote || ""}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Notes sur la livraison…"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                        rows="3"
                        maxLength="500"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {deliveryNote.length}/500 caractères
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={() => setShowDeliveryModal(false)}
                        disabled={isUpdatingDelivery}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-60"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleUpdateDelivery}
                        disabled={isUpdatingDelivery}
                        className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 disabled:bg-blue-400"
                      >
                        {isUpdatingDelivery ? (
                          <>
                            <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            Mise à jour…
                          </>
                        ) : (
                          "Enregistrer"
                        )}
                      </button>
                    </div>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Sales;
