import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { productEditPath, productPath } from '../utils/paths';
import { AlertTriangle, ArrowLeft, BarChart3, Edit3, Wallet } from 'lucide-react';

const CriticalStockProducts = () => {
  const [products, setProducts] = useState([]);
  const [, setError] = useState('');
  const [, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCriticalProducts = async () => {
      try {
        const res = await api.get('/products/dashboard');
        setProducts(res.data.lowStockProducts || []);
      } catch (err) {
        console.error(err);
        setError('Erreur lors du chargement des produits à stock critique.');
      } finally {
        setLoading(false);
      }
    };
    fetchCriticalProducts();
  }, []);

  const totalValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);

  const chartData = products.map((p) => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name,
    stock: p.stock,
  }));

  return (
    <motion.div
      className="min-h-full bg-[#f6f7f9] px-3 py-4 sm:px-5 lg:px-6"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">Stock</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Produits à stock critique</h1>
          <p className="text-slate-500 mt-1">
            Liste des articles dont le stock est inférieur à 5 unités.
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

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard title="Produits Critiques" value={products.length} tone="amber" icon={AlertTriangle} />
        <StatCard
          title="Valeur Totale du Stock"
          value={`${totalValue.toLocaleString()} CFA`}
          tone="sky"
          icon={Wallet}
        />
        <StatCard
          title="Stock Moyen"
          value={
            products.length
              ? (products.reduce((sum, p) => sum + (p.stock || 0), 0) / products.length).toFixed(1)
              : '0'
          }
          tone="slate"
          icon={BarChart3}
        />
      </div>

      {/* Graphique */}
      {products.length > 0 && (
        <div className="bg-white rounded-[1.5rem] shadow-sm p-4 sm:p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">
            Niveaux de Stock des Produits Critiques
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="stock" fill="#F59E0B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau */}
      <div className="hidden md:block overflow-x-auto bg-white rounded-[1.5rem] shadow-sm border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Produit', 'Catégorie', 'Fournisseur', 'Prix (CFA)', 'Stock', 'Valeur Totale', 'Actions'].map((h) => (
                <th key={h} className="px-6 py-3 text-left font-medium text-slate-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {products.map((p) => (
              <tr
                key={p._id}
                className="hover:bg-slate-50 transition cursor-pointer"
                onClick={() => navigate(productPath(p))}
              >
                <td className="px-6 py-4 font-semibold text-slate-950">{p.name}</td>
                <td className="px-6 py-4 text-slate-600">{p.category || '—'}</td>
                <td className="px-6 py-4 text-slate-600">{p.supplierName || '—'}</td>
                <td className="px-6 py-4 text-slate-700">{p.price?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 text-rose-700 font-semibold">{p.stock}</td>
                <td className="px-6 py-4 text-slate-950 font-semibold">
                  {((p.stock || 0) * (p.price || 0)).toLocaleString()} CFA
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(productEditPath(p));
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    <Edit3 className="h-4 w-4" />
                    Réapprovisionner
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes mobiles */}
      <div className="md:hidden space-y-4">
        {products.map((p) => (
          <div
            key={p._id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4"
            onClick={() => navigate(productPath(p))}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-base font-semibold text-slate-950">{p.name}</p>
                <p className="text-xs text-slate-500">{p.category || '—'}</p>
              </div>
              <span className="text-xs text-rose-700">Stock: {p.stock}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Fournisseur : <span className="text-slate-800">{p.supplierName || '—'}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-xs text-slate-500 uppercase">Prix</p>
                <p className="font-semibold text-slate-950">{p.price?.toLocaleString() || '—'} CFA</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Valeur</p>
                <p className="font-semibold text-rose-700">
                  {((p.stock || 0) * (p.price || 0)).toLocaleString()} CFA
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(productEditPath(p));
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              <Edit3 className="h-4 w-4" />
              Réapprovisionner
            </button>
          </div>
        ))}
      </div>
      </div>
    </motion.div>
  );
};

// ---- Carte statistique ----
const toneMap = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};
const StatCard = ({ title, value, tone = 'slate', icon: Icon = BarChart3 }) => {
  return (
    <motion.div
      className="flex justify-between items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <h3 className="text-2xl font-semibold mt-1 text-slate-950">{value}</h3>
      </div>
      <div className={`rounded-2xl border p-3 ${toneMap[tone] || toneMap.slate}`}>
        <Icon className="h-5 w-5" />
      </div>
    </motion.div>
  );
};

export default CriticalStockProducts;
