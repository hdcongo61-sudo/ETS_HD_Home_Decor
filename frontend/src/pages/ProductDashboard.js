import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
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

const ProductDashboard = () => {
  const navigate = useNavigate();
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
    supplierStats: []
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
          supplierStats: res.data.supplierStats || []
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
  }));

  return (
    <motion.div
      className="p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl shadow-lg"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Toaster />
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        Tableau de Bord Produits
      </h1>

      {/* 1️⃣ Synthèse Globale */}
      <motion.div
        className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-6 rounded-3xl shadow-md mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <OverviewCard title="Total Produits" value={stats.totalProducts} icon="🏬" color="from-indigo-500 to-purple-500" />
          <OverviewCard title="Produits Vendus" value={stats.soldProducts} icon="📈" color="from-green-500 to-emerald-500" />
          <OverviewCard title="Stock Critique" value={stats.lowStockProducts.length} icon="⚠️" color="from-yellow-400 to-orange-500" />
          <OverviewCard title="Rupture de Stock" value={stats.outOfStockProducts.length} icon="❌" color="from-red-500 to-rose-500" />
          <OverviewCard title="Valeur Totale du Stock" value={`${stats.totalStockValue.toLocaleString()} CFA`} icon="💰" color="from-emerald-500 to-green-500" />
          <OverviewCard title="Valeur des Invendus" value={`${stats.neverSoldStockValue.toLocaleString()} CFA`} icon="📦" color="from-blue-500 to-indigo-500" />
        </div>

        {/* Graphique tendance ventes */}
        <div className="mt-8 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.salesTrend}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => `${v.toLocaleString()} CFA`} />
              <Area type="monotone" dataKey="value" stroke="#6366F1" fillOpacity={1} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 2️⃣ Liens Rapides */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <QuickLinkCard title="Top Ventes" subtitle="Produits performants" icon="💸" color="from-emerald-500 to-green-500" path="/products/top-sellers" count={stats.topSellingProducts.length} />
        <QuickLinkCard title="Stock Critique" subtitle="Moins de 5 unités" icon="⚠️" color="from-yellow-400 to-orange-500" path="/products/critical" count={stats.lowStockProducts.length} />
        <QuickLinkCard title="Rupture de Stock" subtitle="Stock épuisé" icon="❌" color="from-red-500 to-rose-500" path="/products/out-of-stock" count={stats.outOfStockProducts.length} />
        <QuickLinkCard title="Jamais Vendus" subtitle="Aucune vente enregistrée" icon="🚫" color="from-indigo-500 to-purple-500" path="/products/never-sold" count={stats.neverSoldCount} />
      </motion.div>

      {/* 3️⃣ Graphique Revenu vs Profit */}
      <motion.div
        className="bg-white p-6 rounded-3xl shadow-md mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-xl font-bold mb-4 text-gray-700">Comparatif Revenu / Profit</h2>
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
        className="bg-white p-6 rounded-3xl shadow-md mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-xl font-bold mb-4 text-gray-700">Top Produits Vendus</h2>
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-indigo-100 text-indigo-800 uppercase text-xs">
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

        <div className="sm:hidden space-y-3">
          {stats.topSellingProducts.slice(0, 5).map((p) => (
            <div key={p._id} className="border border-indigo-100 rounded-2xl p-4 bg-indigo-50/40">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-900">{p.name}</p>
                <span className="text-xs text-gray-500">{p.category}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Quantité</p>
                  <p className="font-semibold text-gray-900">{p.sold}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Revenu</p>
                  <p className="font-semibold text-green-600">
                    {p.revenue.toLocaleString()} CFA
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Marge</p>
                  <p className="font-semibold text-indigo-600">{p.margin}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 5️⃣ Statistiques Fournisseurs */}
      <motion.div
        className="bg-white p-6 rounded-3xl shadow-md"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-700">Statistiques Fournisseurs</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => navigate('/products/by-supplier')}
              className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition shadow-sm w-full sm:w-auto text-center"
            >
              Vue détaillée
            </button>
            <button
              onClick={exportSuppliersToExcel}
              className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:opacity-90 transition shadow-sm w-full sm:w-auto"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Export Excel
            </button>
          </div>
        </div>

        <div className="mb-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierChartData}>
              <XAxis dataKey="supplierName" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(v) => `${Number(v || 0).toLocaleString()} CFA`} />
              <Legend />
              <Bar dataKey="totalRevenue" fill="#6366F1" name="Revenu" />
              <Bar dataKey="totalProfit" fill="#10B981" name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-purple-100 text-purple-800 uppercase text-xs">
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
                <tr key={index} className="border-b hover:bg-purple-50">
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
                  <td className="py-2 px-3 text-yellow-600">{s.lowStockCount}</td>
                  <td className="py-2 px-3 text-red-600">{s.outOfStockCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden space-y-4">
          {stats.supplierStats.slice(0, 10).map((s, index) => (
            <div key={index} className="border border-purple-100 rounded-2xl p-4 bg-purple-50/50">
              <div className="flex justify-between items-center mb-2">
                <Link
                  to={`/suppliers/${encodeURIComponent(
                    s.supplierName || 'Inconnu'
                  )}`}
                  className="font-semibold text-gray-900 hover:underline"
                >
                  {s.supplierName}
                </Link>
                <span className="text-xs text-gray-500">#{index + 1}</span>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                Téléphone : {s.supplierPhone || '—'}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Produits</p>
                  <p className="font-semibold text-gray-900">{s.totalProducts}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Stock (CFA)</p>
                  <p className="font-semibold text-gray-900">{s.totalStockValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Revenu</p>
                  <p className="font-semibold text-green-600">
                    {Number(s.totalRevenue || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Profit</p>
                  <p className="font-semibold text-indigo-600">
                    {Number(s.totalProfit || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Stock critique</p>
                  <p className="font-semibold text-yellow-600">{s.lowStockCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ruptures</p>
                  <p className="font-semibold text-red-600">{s.outOfStockCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Sous-composants
const OverviewCard = ({ title, value, icon, color }) => (
  <motion.div
    className={`bg-gradient-to-r ${color} text-white p-5 rounded-2xl shadow-md flex items-center justify-between`}
    whileHover={{ scale: 1.03 }}
    transition={{ duration: 0.2 }}
  >
    <div>
      <p className="text-sm opacity-90">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
    </div>
    <div className="text-3xl opacity-90">{icon}</div>
  </motion.div>
);

const QuickLinkCard = ({ title, subtitle, icon, color, path, count }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      onClick={() => navigate(path)}
      className={`cursor-pointer bg-gradient-to-r ${color} text-white p-5 rounded-2xl shadow-lg flex flex-col justify-between hover:shadow-xl transition`}
    >
      <div className="flex items-center justify-between">
        <div className="text-4xl">{icon}</div>
        {count > 0 && (
          <div className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            {count}
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm opacity-80">{subtitle}</p>
      </div>
    </motion.div>
  );
};

export default ProductDashboard;
