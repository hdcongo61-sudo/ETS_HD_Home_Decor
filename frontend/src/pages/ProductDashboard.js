import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
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
  ArrowUpRight,
  Boxes,
  Download,
  Package,
  PackageCheck,
  PackageX,
  TrendingUp,
  Wallet,
} from 'lucide-react';

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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );

  if (error)
    return <p className="text-center text-red-600 mt-8">{error}</p>;

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
    <motion.div
      className="min-h-full bg-[#f6f7f9] px-3 py-4 sm:px-5 lg:px-6"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Toaster />
      <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-medium uppercase text-slate-500">Inventaire</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">
          Tableau de bord produits
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Stock, ventes, marges et regroupements par fournisseur, conteneur et entrepôt.
        </p>
      </header>

      {/* 1️⃣ Synthèse Globale */}
      <motion.div
        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <OverviewCard title="Total Produits" value={stats.totalProducts} icon={Package} tone="slate" />
          <OverviewCard title="Produits Vendus" value={stats.soldProducts} icon={TrendingUp} tone="emerald" />
          <OverviewCard title="Stock Critique" value={stats.lowStockProducts.length} icon={AlertTriangle} tone="amber" />
          <OverviewCard title="Rupture de Stock" value={stats.outOfStockProducts.length} icon={PackageX} tone="rose" />
          <OverviewCard title="Valeur Totale du Stock" value={`${stats.totalStockValue.toLocaleString()} CFA`} icon={Wallet} tone="sky" />
          <OverviewCard title="Valeur des Invendus" value={`${stats.neverSoldStockValue.toLocaleString()} CFA`} icon={Boxes} tone="violet" />
        </div>

        {/* Graphique tendance ventes */}
        <div className="mt-8 h-40">
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
      </motion.div>

      {/* 2️⃣ Liens Rapides */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
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
      <motion.div
        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-xl font-semibold mb-4 text-slate-950">Comparatif Revenu / Profit</h2>
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
      </motion.div>

      {/* 4️⃣ Top Produits Vendus */}
      <motion.div
        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-xl font-semibold mb-4 text-slate-950">Top Produits Vendus</h2>
        <div className="overflow-x-auto">
          <table ref={topSellingTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
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
                <tr key={p._id} className="border-b hover:bg-indigo-50">
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
      </motion.div>

      {/* 5️⃣ Statistiques Fournisseurs */}
      <motion.div
        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-950">Statistiques Fournisseurs</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => navigate('/products/by-supplier')}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 w-full sm:w-auto"
            >
              <ArrowUpRight className="h-4 w-4" />
              Vue détaillée
            </button>
            <button
              onClick={exportSuppliersToExcel}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </div>
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
          <div className="bg-purple-50 rounded-2xl p-4">
            <p className="text-gray-500">Stock critique</p>
            <p className="text-lg font-semibold text-yellow-600">
              {stats.supplierStats.reduce((sum, s) => sum + (s.lowStockCount || 0), 0)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-2xl p-4">
            <p className="text-gray-500">Ruptures</p>
            <p className="text-lg font-semibold text-red-600">
              {stats.supplierStats.reduce((sum, s) => sum + (s.outOfStockCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table ref={supplierTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
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
                <tr key={index} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-3 font-medium">
                    <Link
                      to={`/suppliers/${encodeURIComponent(
                        s.supplierName || 'Inconnu'
                      )}`}
                      className="text-indigo-700 hover:text-indigo-900 hover:underline"
                    >
                      {s.supplierName}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-gray-600">{s.supplierPhone || '—'}</td>
                  <td className="py-2 px-3">{s.totalProducts}</td>
                  <td className="py-2 px-3">{s.totalStockValue.toLocaleString()} CFA</td>
                  <td className="py-2 px-3 text-green-600 font-semibold">
                    {Number(s.totalRevenue || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-indigo-600 font-semibold">
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
      </motion.div>

      {/* 6️⃣ Statistiques Conteneurs */}
      <motion.div
        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-950">Statistiques Conteneurs</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => navigate('/products/by-container')}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 w-full sm:w-auto"
            >
              <ArrowUpRight className="h-4 w-4" />
              Vue détaillée
            </button>
          </div>
        </div>

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
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-gray-500">Stock critique</p>
            <p className="text-lg font-semibold text-yellow-600">
              {stats.containerStats.reduce((sum, c) => sum + (c.lowStockCount || 0), 0)}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-gray-500">Ruptures</p>
            <p className="text-lg font-semibold text-red-600">
              {stats.containerStats.reduce((sum, c) => sum + (c.outOfStockCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table ref={containerTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
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
                <tr key={index} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-3 font-medium text-gray-900">
                    {c.containerName}
                  </td>
                  <td className="py-2 px-3">{c.totalProducts}</td>
                  <td className="py-2 px-3">{Number(c.totalStockValue || 0).toLocaleString()} CFA</td>
                  <td className="py-2 px-3 text-emerald-700 font-semibold">
                    {Number(c.totalRevenue || 0).toLocaleString()} CFA
                  </td>
                  <td className="py-2 px-3 text-indigo-600 font-semibold">
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
      </motion.div>

      {/* 7️⃣ Statistiques Entrepots */}
      <motion.div
        className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-950">Statistiques Entrepots</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => navigate('/products/by-warehouse')}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 w-full sm:w-auto"
            >
              <ArrowUpRight className="h-4 w-4" />
              Vue detaillee
            </button>
          </div>
        </div>

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
          <div className="bg-sky-50 rounded-2xl p-4">
            <p className="text-gray-500">Stock critique</p>
            <p className="text-lg font-semibold text-yellow-600">
              {stats.warehouseStats.reduce((sum, w) => sum + (w.lowStockCount || 0), 0)}
            </p>
          </div>
          <div className="bg-sky-50 rounded-2xl p-4">
            <p className="text-gray-500">Ruptures</p>
            <p className="text-lg font-semibold text-red-600">
              {stats.warehouseStats.reduce((sum, w) => sum + (w.outOfStockCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table ref={warehouseTableRef} className="responsive-table min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
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
                <tr key={index} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-3 font-medium text-gray-900">
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
      </motion.div>
      </div>
    </motion.div>
  );
};

// Sous-composants
const toneClasses = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

const OverviewCard = ({ title, value, icon: Icon, tone = 'slate' }) => (
  <motion.div
    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    whileHover={{ y: -2 }}
    transition={{ duration: 0.2 }}
  >
    <div>
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="text-2xl font-semibold mt-1 text-slate-950">{value}</h3>
    </div>
    <div className={`rounded-2xl border p-3 ${toneClasses[tone] || toneClasses.slate}`}>
      <Icon className="h-5 w-5" />
    </div>
  </motion.div>
);

const QuickLinkCard = ({ title, subtitle, icon: Icon, tone = 'slate', path, count }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => navigate(path)}
      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
    >
      <div className="flex items-center justify-between">
        <div className={`rounded-2xl border p-3 ${toneClasses[tone] || toneClasses.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
        {count > 0 && (
          <div className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {count}
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </motion.div>
  );
};

export default ProductDashboard;
