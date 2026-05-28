import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion } from 'framer-motion';
import { productPath } from '../utils/paths';
import { ArrowLeft, Medal, TrendingUp, Trophy, Wallet } from 'lucide-react';

const TopSellingProducts = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get('/products/dashboard?range=month');
        setData(response.data.topSellingProducts || []);
      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement des produits les plus vendus.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-600 mt-8">{error}</p>;
  }

  return (
    <motion.div
      className="min-h-full bg-[#f6f7f9] px-3 py-4 sm:px-5 lg:px-6"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">Performance produits</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Produits les plus vendus</h1>
          <p className="text-slate-500 mt-1">
            Classement basé sur les ventes récentes et bénéfices estimés.
          </p>
        </div>
        <button
          onClick={() => navigate('/product-dashboard')}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>
      </div>

      {/* Tableau principal */}
      <div className="hidden md:block overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                'Produit',
                'Catégorie',
                'Fournisseur',
                'Prix (CFA)',
                'Unités Vendues',
                'Revenu Total',
                'Profit (CFA)',
                'Marge (%)',
              ].map((header) => (
                <th
                  key={header}
                  className="px-6 py-3 text-left font-medium text-slate-500 uppercase"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {data.map((p, index) => (
              <tr
                key={p._id || index}
                className="hover:bg-slate-50 transition cursor-pointer"
                onClick={() => navigate(productPath(p))}
              >
                <td className="px-6 py-4 font-semibold text-slate-950">{p.name}</td>
                <td className="px-6 py-4 text-slate-600">{p.category || '—'}</td>
                <td className="px-6 py-4 text-slate-600">{p.supplierName || '—'}</td>
                <td className="px-6 py-4 text-slate-700">{p.price?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 text-slate-700">{p.sold?.toLocaleString() || 0}</td>
                <td className="px-6 py-4 text-slate-950 font-semibold">
                  {p.revenue?.toLocaleString() || '—'} CFA
                </td>
                <td className="px-6 py-4 text-emerald-700 font-semibold">
                  {p.profit?.toLocaleString() || '—'} CFA
                </td>
                <td className="px-6 py-4 text-slate-700 font-semibold">
                  {p.margin ? p.margin.toFixed(1) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes mobiles */}
      <div className="md:hidden space-y-4">
        {data.map((p, index) => (
          <div
            key={p._id || index}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4"
            onClick={() => navigate(productPath(p))}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-base font-semibold text-slate-950">{p.name}</p>
                <p className="text-xs text-slate-500">{p.category || '—'}</p>
              </div>
              <span className="text-xs text-slate-500">#{index + 1}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Fournisseur : <span className="text-slate-800">{p.supplierName || '—'}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-xs text-slate-500 uppercase">Unités vendues</p>
                <p className="font-semibold text-slate-950">{p.sold?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Revenu</p>
                <p className="font-semibold text-emerald-700">{p.revenue?.toLocaleString() || '—'} CFA</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Profit</p>
                <p className="font-semibold text-emerald-600">{p.profit?.toLocaleString() || '—'} CFA</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Marge</p>
                <p className="font-semibold text-indigo-600">
                  {p.margin ? p.margin.toFixed(1) + '%' : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
        <StatCard
          title="Revenu Total"
          value={`${data.reduce((sum, p) => sum + (p.revenue || 0), 0).toLocaleString()} CFA`}
          tone="sky"
          icon={Wallet}
        />
        <StatCard
          title="Profit Total"
          value={`${data.reduce((sum, p) => sum + (p.profit || 0), 0).toLocaleString()} CFA`}
          tone="emerald"
          icon={TrendingUp}
        />
        <StatCard
          title="Marge Moyenne"
          value={
            data.length
              ? (
                  data.reduce((sum, p) => sum + (p.margin || 0), 0) / data.length
                ).toFixed(1) + '%'
              : '0%'
          }
          tone="amber"
          icon={Trophy}
        />
      </div>
      </div>
    </motion.div>
  );
};

// ---- Composant de carte statistique ----
const toneMap = {
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
};
const StatCard = ({ title, value, tone = 'sky', icon: Icon = Medal }) => {
  return (
    <motion.div
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <h3 className="text-2xl font-semibold mt-1 text-slate-950">{value}</h3>
      </div>
      <div className={`rounded-2xl border p-3 ${toneMap[tone] || toneMap.sky}`}>
        <Icon className="h-5 w-5" />
      </div>
    </motion.div>
  );
};

export default TopSellingProducts;
