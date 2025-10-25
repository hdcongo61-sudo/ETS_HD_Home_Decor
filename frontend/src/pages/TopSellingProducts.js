import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion } from 'framer-motion';

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
        console.log('🔥 Top selling products:', response.data.topSellingProducts);
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
      className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl p-6 shadow-lg"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Produits les Plus Vendus</h1>
          <p className="text-gray-500 mt-1">
            Classement basé sur les ventes récentes et bénéfices estimés.
          </p>
        </div>
        <button
          onClick={() => navigate('/product-dashboard')}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition"
        >
          ⬅ Retour au Tableau de Bord
        </button>
      </div>

      {/* Tableau principal */}
      <div className="hidden md:block overflow-x-auto bg-white rounded-2xl shadow border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
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
                  className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((p, index) => (
              <tr
                key={p._id || index}
                className="hover:bg-indigo-50 transition cursor-pointer"
                onClick={() => navigate(`/products/${p._id}`)}
              >
                <td className="px-6 py-4 font-semibold text-gray-800">{p.name}</td>
                <td className="px-6 py-4 text-gray-600">{p.category || '—'}</td>
                <td className="px-6 py-4 text-gray-600">{p.supplierName || '—'}</td>
                <td className="px-6 py-4 text-gray-700">{p.price?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 text-gray-700">{p.sold?.toLocaleString() || 0}</td>
                <td className="px-6 py-4 text-gray-800 font-semibold">
                  {p.revenue?.toLocaleString() || '—'} CFA
                </td>
                <td className="px-6 py-4 text-green-600 font-semibold">
                  {p.profit?.toLocaleString() || '—'} CFA
                </td>
                <td className="px-6 py-4 text-indigo-600 font-semibold">
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
            className="bg-white rounded-2xl shadow border border-gray-100 p-4"
            onClick={() => navigate(`/products/${p._id}`)}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-base font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.category || '—'}</p>
              </div>
              <span className="text-xs text-gray-500">#{index + 1}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Fournisseur : <span className="text-gray-800">{p.supplierName || '—'}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-xs text-gray-500 uppercase">Unités vendues</p>
                <p className="font-semibold text-gray-900">{p.sold?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Revenu</p>
                <p className="font-semibold text-green-600">{p.revenue?.toLocaleString() || '—'} CFA</p>
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
          color="purple"
          icon="💰"
        />
        <StatCard
          title="Profit Total"
          value={`${data.reduce((sum, p) => sum + (p.profit || 0), 0).toLocaleString()} CFA`}
          color="green"
          icon="📈"
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
          color="yellow"
          icon="🏆"
        />
      </div>
    </motion.div>
  );
};

// ---- Composant de carte statistique ----
const StatCard = ({ title, value, color, icon }) => {
  const colorMap = {
    purple: 'from-purple-500 to-indigo-500',
    green: 'from-emerald-500 to-green-500',
    yellow: 'from-yellow-400 to-orange-400',
  };
  return (
    <motion.div
      className={`bg-gradient-to-r ${colorMap[color]} text-white p-5 rounded-2xl shadow-md flex justify-between items-center`}
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
};

export default TopSellingProducts;
