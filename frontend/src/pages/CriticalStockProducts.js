import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { productEditPath, productPath } from '../utils/paths';

const CriticalStockProducts = () => {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
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
      className="bg-gradient-to-br from-yellow-50 via-white to-orange-50 rounded-3xl p-6 shadow-lg"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Produits à Stock Critique</h1>
          <p className="text-gray-500 mt-1">
            Liste des articles dont le stock est inférieur à 5 unités.
          </p>
        </div>
        <button
          onClick={() => navigate('/product-dashboard')}
          className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl shadow-sm transition"
        >
          ⬅ Retour au Tableau de Bord
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard title="Produits Critiques" value={products.length} color="yellow" icon="⚠️" />
        <StatCard
          title="Valeur Totale du Stock"
          value={`${totalValue.toLocaleString()} CFA`}
          color="orange"
          icon="💰"
        />
        <StatCard
          title="Stock Moyen"
          value={
            products.length
              ? (products.reduce((sum, p) => sum + (p.stock || 0), 0) / products.length).toFixed(1)
              : '0'
          }
          color="amber"
          icon="📊"
        />
      </div>

      {/* Graphique */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6 mb-10 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
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
      <div className="hidden md:block overflow-x-auto bg-white rounded-2xl shadow border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Produit', 'Catégorie', 'Fournisseur', 'Prix (CFA)', 'Stock', 'Valeur Totale', 'Actions'].map((h) => (
                <th key={h} className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((p) => (
              <tr
                key={p._id}
                className="hover:bg-yellow-50 transition cursor-pointer"
                onClick={() => navigate(productPath(p))}
              >
                <td className="px-6 py-4 font-semibold text-gray-800">{p.name}</td>
                <td className="px-6 py-4 text-gray-600">{p.category || '—'}</td>
                <td className="px-6 py-4 text-gray-600">{p.supplierName || '—'}</td>
                <td className="px-6 py-4 text-gray-700">{p.price?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 text-red-600 font-semibold">{p.stock}</td>
                <td className="px-6 py-4 text-gray-800 font-semibold">
                  {((p.stock || 0) * (p.price || 0)).toLocaleString()} CFA
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(productEditPath(p));
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
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
            className="bg-white rounded-2xl shadow border border-gray-100 p-4"
            onClick={() => navigate(productPath(p))}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-base font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.category || '—'}</p>
              </div>
              <span className="text-xs text-gray-500">Stock: {p.stock}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Fournisseur : <span className="text-gray-800">{p.supplierName || '—'}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-xs text-gray-500 uppercase">Prix</p>
                <p className="font-semibold text-gray-900">{p.price?.toLocaleString() || '—'} CFA</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Valeur</p>
                <p className="font-semibold text-red-600">
                  {((p.stock || 0) * (p.price || 0)).toLocaleString()} CFA
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(productEditPath(p));
              }}
              className="mt-3 w-full px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition"
            >
              Réapprovisionner
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ---- Carte statistique ----
const StatCard = ({ title, value, color, icon }) => {
  const colorMap = {
    yellow: 'from-yellow-400 to-orange-400',
    orange: 'from-orange-500 to-red-400',
    amber: 'from-amber-500 to-yellow-400',
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

export default CriticalStockProducts;
