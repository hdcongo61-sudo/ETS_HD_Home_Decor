import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import {
  AlertTriangle,
  Boxes,
  Download,
  Package,
  PackageCheck,
  PackageX,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  ProductActionButton,
  ProductHero,
  ProductMetricCard,
  ProductPageShell,
  ProductSection,
  formatProductCurrency,
  formatProductNumber,
} from '../components/ProductAnalyticsUI';
import { Workspace } from '../components/business';

const ProductDashboard = () => {
  const navigate = useNavigate();
  const topSellingTableRef = useRef(null);
  const supplierTableRef = useRef(null);
  const containerTableRef = useRef(null);
  const warehouseTableRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stats, setStats] = useState({
    totalProducts: 0,
    soldProducts: 0,
    totalStockValue: 0,
    neverSoldStockValue: 0,
    neverSoldCount: 0,
    topSellingProducts: [],
    lowStockProducts: [],
    outOfStockProducts: [],
    salesTrend: [],
    supplierStats: [],
    containerStats: [],
    warehouseStats: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/products/dashboard');
        setStats({
          totalProducts: res.data.totalProducts || 0,
          soldProducts: res.data.soldProducts || 0,
          totalStockValue: res.data.totalStockValue || 0,
          neverSoldStockValue: res.data.neverSoldStockValue || 0,
          neverSoldCount: res.data.neverSoldProducts?.length || 0,
          topSellingProducts: res.data.topSellingProducts || [],
          lowStockProducts: res.data.lowStockProducts || [],
          outOfStockProducts: res.data.outOfStockProducts || [],
          salesTrend: res.data.salesTrend || [],
          supplierStats: res.data.supplierStats || [],
          containerStats: res.data.containerStats || [],
          warehouseStats: res.data.warehouseStats || []
        });

        if (res.data.outOfStockProducts?.length > 0) {
          toast.error(
            `🚨 ${res.data.outOfStockProducts.length} produit(s) en rupture de stock !`,
            { duration: 6000, position: 'top-right' }
          );
        }

        if (res.data.lowStockProducts?.length > 0) {
          toast(
            `⚠️ ${res.data.lowStockProducts.length} produit(s) en stock critique.`,
            { icon: '⚠️', duration: 5000, position: 'top-right' }
          );
        }

      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement du tableau de bord produits.");
        toast.error("Erreur lors du chargement du tableau de bord.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 📦 Export supplier stats to Excel
  const exportSuppliersToExcel = () => {
    if (!stats.supplierStats || stats.supplierStats.length === 0) {
      toast.error('Aucune donnée fournisseur à exporter.');
      return;
    }

    const data = stats.supplierStats.map((s) => ({
      Fournisseur: s.supplierName,
      Téléphone: s.supplierPhone || '',
      'Produits Totaux': s.totalProducts,
      'Stock Total (CFA)': s.totalStockValue.toLocaleString(),
      'Revenu Total (CFA)': s.totalRevenue.toLocaleString(),
      'Profit Total (CFA)': s.totalProfit.toLocaleString(),
      'Stock Critique': s.lowStockCount,
      'Ruptures': s.outOfStockCount
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fournisseurs');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `Statistiques_Fournisseurs_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export Excel généré avec succès 📊');
  };

  useResponsiveTable(topSellingTableRef, [stats.topSellingProducts]);
  useResponsiveTable(supplierTableRef, [stats.supplierStats]);
  useResponsiveTable(containerTableRef, [stats.containerStats]);
  useResponsiveTable(warehouseTableRef, [stats.warehouseStats]);

  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-950"></div>
      </div>
    );

  if (error)
    return <p className="mt-8 text-center text-red-600">{error}</p>;

  const supplierChartData = stats.supplierStats.slice(0, 5).map((s) => ({
    ...s,
    totalRevenue: Number(s.totalRevenue || 0),
    totalProfit: Number(s.totalProfit || 0),
    lowStockCount: Number(s.lowStockCount || 0),
    outOfStockCount: Number(s.outOfStockCount || 0),
  }));
  const containerChartData = stats.containerStats.slice(0, 5).map((c) => ({
    ...c,
    totalRevenue: Number(c.totalRevenue || 0),
    totalProfit: Number(c.totalProfit || 0),
    lowStockCount: Number(c.lowStockCount || 0),
    outOfStockCount: Number(c.outOfStockCount || 0),
  }));
  const warehouseChartData = stats.warehouseStats.slice(0, 5).map((w) => ({
    ...w,
    totalRevenue: Number(w.totalRevenue || 0),
    totalProfit: Number(w.totalProfit || 0),
    lowStockCount: Number(w.lowStockCount || 0),
    outOfStockCount: Number(w.outOfStockCount || 0),
  }));

  return (
  <Workspace>
    <ProductPageShell>
      <ProductHero
        eyebrow="Inventaire"
        title="Tableau de bord produits"
        description="Stock, ventes, marges et regroupements par fournisseur, conteneur et entrepôt."
      />

      {/* 1️⃣ Synthèse Globale */}
      <ProductSection
        title="Synthèse globale"
        description="Vue consolidée de l’inventaire et de la performance commerciale."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ProductMetricCard title="Total produits" value={formatProductNumber(stats.totalProducts)} icon={Package} tone="slate" />
          <ProductMetricCard title="Produits vendus" value={formatProductNumber(stats.soldProducts)} icon={TrendingUp} tone="emerald" />
          <ProductMetricCard title="Stock critique" value={formatProductNumber(stats.lowStockProducts.length)} icon={AlertTriangle} tone="amber" />
          <ProductMetricCard title="Rupture de stock" value={formatProductNumber(stats.outOfStockProducts.length)} icon={PackageX} tone="rose" />
          <ProductMetricCard title="Valeur totale du stock" value={formatProductCurrency(stats.totalStockValue)} icon={Wallet} tone="sky" />
          <ProductMetricCard title="Valeur des invendus" value={formatProductCurrency(stats.neverSoldStockValue)} icon={Boxes} tone="violet" />
        </div>

        {/* Graphique tendance ventes */}
        <div className="mt-5 h-48 rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.salesTrend}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f172a" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => `${v.toLocaleString()} CFA`} />
              <Area type="monotone" dataKey="value" stroke="#0f172a" fillOpacity={1} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ProductSection>

      {/* 2️⃣ Liens Rapides */}
      <motion.div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <QuickLinkCard title="Top Ventes" subtitle="Produits performants" icon={TrendingUp} tone="emerald" path="/products/top-sellers" count={stats.topSellingProducts.length} />
        <QuickLinkCard title="Stock Critique" subtitle="Moins de 5 unités" icon={AlertTriangle} tone="amber" path="/products/critical" count={stats.lowStockProducts.length} />
        <QuickLinkCard title="Rupture de Stock" subtitle="Stock épuisé" icon={PackageX} tone="rose" path="/products/out-of-stock" count={stats.outOfStockProducts.length} />
        <QuickLinkCard title="Jamais Vendus" subtitle="Aucune vente enregistrée" icon={PackageCheck} tone="violet" path="/products/never-sold" count={stats.neverSoldCount} />
      </motion.div>

      {/* 3️⃣ Graphique Revenu vs Profit */}
      <ProductSection
        title="Comparatif revenu / profit"
        description="Les produits qui génèrent le plus de chiffre d’affaires et de marge."
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.topSellingProducts.slice(0, 10)}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip formatter={(v) => `${v.toLocaleString()} CFA`} />
            <Legend />
            <Bar dataKey="revenue" fill="#6366F1" name="Revenu" />
            <Bar dataKey="profit" fill="#10B981" name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      </ProductSection>

      {/* 4️⃣ Top Produits Vendus */}
      <ProductSection title="Top produits vendus" description="Les cinq produits les plus performants.">
        <div className="overflow-x-auto">
          <table ref={topSellingTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-[var(--colorNeutralBackground2)] text-xs uppercase text-[var(--colorNeutralForeground3)]">
              <tr>
                <th className="py-2 px-3">Produit</th>
                <th className="py-2 px-3">Catégorie</th>
                <th className="py-2 px-3">Quantité</th>
                <th className="py-2 px-3">Revenu</th>
                <th className="py-2 px-3">Marge (%)</th>
              </tr>
            </thead>
            <tbody>
              {stats.topSellingProducts.slice(0, 5).map((p) => (
                <tr key={p._id} className="border-b border-gray-100 transition hover:bg-[var(--colorNeutralBackground2)]">
                  <td className="py-2 px-3">{p.name}</td>
                  <td className="py-2 px-3">{p.category}</td>
                  <td className="py-2 px-3">{p.sold}</td>
                  <td className="py-2 px-3">{p.revenue.toLocaleString()} CFA</td>
                  <td className="py-2 px-3">{p.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProductSection>

      {/* 5️⃣ Statistiques Fournisseurs */}
      <ProductSection
        title="Statistiques fournisseurs"
        description="Revenu, profit, risques de stock et performance par fournisseur."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ProductActionButton onClick={() => navigate('/products/by-supplier')}>Vue détaillée</ProductActionButton>
            <ProductActionButton onClick={exportSuppliersToExcel} variant="primary" icon={Download}>Export Excel</ProductActionButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        </div>

        <div className="mb-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierChartData}>
              <XAxis dataKey="supplierName" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => {
                  const numeric = Number(value || 0);
                  if (name === 'Stock critique' || name === 'Ruptures') {
                    return numeric.toLocaleString('fr-FR');
                  }
                  return `${numeric.toLocaleString('fr-FR')} CFA`;
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="totalRevenue" fill="#6366F1" name="Revenu" />
              <Bar yAxisId="left" dataKey="totalProfit" fill="#10B981" name="Profit" />
              <Bar yAxisId="right" dataKey="lowStockCount" fill="#F59E0B" name="Stock critique" />
              <Bar yAxisId="right" dataKey="outOfStockCount" fill="#EF4444" name="Ruptures" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-purple-50 rounded-[var(--radiusLarge)] p-4">
            <p className="text-[var(--colorNeutralForeground3)]">Stock critique</p>
            <p className="text-lg font-semibold text-yellow-600">
              {stats.supplierStats.reduce((sum, s) => sum + (s.lowStockCount || 0), 0)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-[var(--radiusLarge)] p-4">
            <p className="text-[var(--colorNeutralForeground3)]">Ruptures</p>
            <p className="text-lg font-semibold text-red-600">
              {stats.supplierStats.reduce((sum, s) => sum + (s.outOfStockCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table ref={supplierTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-[var(--colorNeutralBackground2)] text-[var(--colorNeutralForeground3)] uppercase text-xs">
              <tr>
                <th className="py-2 px-3">Fournisseur</th>
                <th className="py-2 px-3">Téléphone</th>
                <th className="py-2 px-3">Produits</th>
                <th className="py-2 px-3">Stock Total (CFA)</th>
                <th className="py-2 px-3">Revenu Total (CFA)</th>
                <th className="py-2 px-3">Profit Total (CFA)</th>
                <th className="py-2 px-3">Stock Critique</th>
                <th className="py-2 px-3">Ruptures</th>
              </tr>
            </thead>
            <tbody>
              {stats.supplierStats.slice(0, 10).map((s, index) => (
                <tr key={index} className="border-b hover:bg-[var(--colorNeutralBackground2)]">
                  <td className="py-2 px-3 font-medium">
                    <Link
                      to={`/suppliers/${encodeURIComponent(
                        s.supplierName || 'Inconnu'
                      )}`}
                      className="text-[var(--ms-blue-dark)] hover:text-[var(--ms-blue-dark)] hover:underline"
                    >
                      {s.supplierName}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-[var(--colorNeutralForeground3)]">{s.supplierPhone || '—'}</td>
                  <td className="py-2 px-3">{s.totalProducts}</td>
                  <td className="py-2 px-3">{s.totalStockValue.toLocaleString()} CFA</td>
                  <td className="py-2 px-3 text-green-600 font-semibold">
                    {Number(s.totalRevenue || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-[var(--ms-blue)] font-semibold">
                    {Number(s.totalProfit || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-yellow-600">
                    {Number(s.lowStockCount || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2 px-3 text-red-600">
                    {Number(s.outOfStockCount || 0).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProductSection>

      {/* 6️⃣ Statistiques Conteneurs */}
      <ProductSection
        title="Statistiques conteneurs"
        description="Lecture de la performance par arrivage ou conteneur."
        action={<ProductActionButton onClick={() => navigate('/products/by-container')}>Vue détaillée</ProductActionButton>}
      >

        <div className="mb-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={containerChartData}>
              <XAxis dataKey="containerName" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
              <Tooltip formatter={(v) => `${Number(v || 0).toLocaleString()} CFA`} />
              <Legend />
              <Bar yAxisId="left" dataKey="totalRevenue" fill="#0EA5E9" name="Revenu" />
              <Bar yAxisId="left" dataKey="totalProfit" fill="#10B981" name="Profit" />
              <Bar yAxisId="right" dataKey="lowStockCount" fill="#F59E0B" name="Stock critique" />
              <Bar yAxisId="right" dataKey="outOfStockCount" fill="#EF4444" name="Ruptures" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-emerald-50 rounded-[var(--radiusLarge)] p-4">
            <p className="text-[var(--colorNeutralForeground3)]">Stock critique</p>
            <p className="text-lg font-semibold text-yellow-600">
              {stats.containerStats.reduce((sum, c) => sum + (c.lowStockCount || 0), 0)}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-[var(--radiusLarge)] p-4">
            <p className="text-[var(--colorNeutralForeground3)]">Ruptures</p>
            <p className="text-lg font-semibold text-red-600">
              {stats.containerStats.reduce((sum, c) => sum + (c.outOfStockCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table ref={containerTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-[var(--colorNeutralBackground2)] text-[var(--colorNeutralForeground3)] uppercase text-xs">
              <tr>
                <th className="py-2 px-3">Conteneur</th>
                <th className="py-2 px-3">Produits</th>
                <th className="py-2 px-3">Stock Total (CFA)</th>
                <th className="py-2 px-3">Revenu Total (CFA)</th>
                <th className="py-2 px-3">Profit Total (CFA)</th>
                <th className="py-2 px-3">Stock Critique</th>
                <th className="py-2 px-3">Ruptures</th>
              </tr>
            </thead>
            <tbody>
              {stats.containerStats.slice(0, 10).map((c, index) => (
                <tr key={index} className="border-b hover:bg-[var(--colorNeutralBackground2)]">
                  <td className="py-2 px-3 font-medium text-[var(--colorNeutralForeground1)]">
                    {c.containerName}
                  </td>
                  <td className="py-2 px-3">{c.totalProducts}</td>
                  <td className="py-2 px-3">{Number(c.totalStockValue || 0).toLocaleString()} CFA</td>
                  <td className="py-2 px-3 text-emerald-700 font-semibold">
                    {Number(c.totalRevenue || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-[var(--ms-blue)] font-semibold">
                    {Number(c.totalProfit || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-yellow-600">
                    {Number(c.lowStockCount || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2 px-3 text-red-600">
                    {Number(c.outOfStockCount || 0).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProductSection>

      {/* 7️⃣ Statistiques Entrepots */}
      <ProductSection
        title="Statistiques entrepôts"
        description="Suivi des emplacements de stockage et des risques de rupture."
        action={<ProductActionButton onClick={() => navigate('/products/by-warehouse')}>Vue détaillée</ProductActionButton>}
      >

        <div className="mb-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={warehouseChartData}>
              <XAxis dataKey="warehouseName" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => {
                  const numeric = Number(value || 0);
                  if (name === 'Stock critique' || name === 'Ruptures') {
                    return numeric.toLocaleString('fr-FR');
                  }
                  return `${numeric.toLocaleString('fr-FR')} CFA`;
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="totalRevenue" fill="#38BDF8" name="Revenu" />
              <Bar yAxisId="left" dataKey="totalProfit" fill="#22C55E" name="Profit" />
              <Bar yAxisId="right" dataKey="lowStockCount" fill="#F59E0B" name="Stock critique" />
              <Bar yAxisId="right" dataKey="outOfStockCount" fill="#EF4444" name="Ruptures" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-sky-50 rounded-[var(--radiusLarge)] p-4">
            <p className="text-[var(--colorNeutralForeground3)]">Stock critique</p>
            <p className="text-lg font-semibold text-yellow-600">
              {stats.warehouseStats.reduce((sum, w) => sum + (w.lowStockCount || 0), 0)}
            </p>
          </div>
          <div className="bg-sky-50 rounded-[var(--radiusLarge)] p-4">
            <p className="text-[var(--colorNeutralForeground3)]">Ruptures</p>
            <p className="text-lg font-semibold text-red-600">
              {stats.warehouseStats.reduce((sum, w) => sum + (w.outOfStockCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table ref={warehouseTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-[var(--colorNeutralBackground2)] text-[var(--colorNeutralForeground3)] uppercase text-xs">
              <tr>
                <th className="py-2 px-3">Entrepot</th>
                <th className="py-2 px-3">Produits</th>
                <th className="py-2 px-3">Stock Total (CFA)</th>
                <th className="py-2 px-3">Revenu Total (CFA)</th>
                <th className="py-2 px-3">Profit Total (CFA)</th>
                <th className="py-2 px-3">Stock Critique</th>
                <th className="py-2 px-3">Ruptures</th>
              </tr>
            </thead>
            <tbody>
              {stats.warehouseStats.slice(0, 10).map((w, index) => (
                <tr key={index} className="border-b hover:bg-[var(--colorNeutralBackground2)]">
                  <td className="py-2 px-3 font-medium text-[var(--colorNeutralForeground1)]">
                    {w.warehouseName}
                  </td>
                  <td className="py-2 px-3">{w.totalProducts}</td>
                  <td className="py-2 px-3">{Number(w.totalStockValue || 0).toLocaleString()} CFA</td>
                  <td className="py-2 px-3 text-sky-700 font-semibold">
                    {Number(w.totalRevenue || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-emerald-700 font-semibold">
                    {Number(w.totalProfit || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-yellow-600">
                    {Number(w.lowStockCount || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2 px-3 text-red-600">
                    {Number(w.outOfStockCount || 0).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProductSection>
    </ProductPageShell>
  </Workspace>
  );
};

// Sous-composants
const toneClasses = {
  slate: 'border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] text-[var(--colorNeutralForeground2)]',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-[var(--colorStatusDangerBackground1)] text-[var(--colorStatusDangerForeground1)]',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

const QuickLinkCard = ({ title, subtitle, icon: Icon, tone = 'slate', path, count }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => navigate(path)}
      className="cursor-pointer rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-white p-5 shadow-sm transition hover:border-slate-300"
    >
      <div className="flex items-center justify-between">
        <div className={`rounded-[var(--radiusLarge)] border p-3 ${toneClasses[tone] || toneClasses.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
        {count > 0 && (
          <div className="rounded-full bg-[var(--colorNeutralBackground3)] px-2 py-0.5 text-xs font-semibold text-[var(--colorNeutralForeground2)]">
            {count}
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-lg font-semibold text-[var(--colorNeutralForeground1)]">{title}</h3>
        <p className="text-sm text-[var(--colorNeutralForeground3)]">{subtitle}</p>
      </div>
    </motion.div>
  );
};

export default ProductDashboard;
