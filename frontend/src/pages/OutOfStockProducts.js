import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { motion } from 'framer-motion';
import { productEditPath, productPath } from '../utils/paths';

const OutOfStockProducts = () => {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOutOfStock = async () => {
      try {
        const res = await api.get('/products/dashboard');
        setProducts(res.data.outOfStockProducts || []);
      } catch (err) {
        console.error(err);
        setError('Erreur lors du chargement des produits en rupture de stock.');
      } finally {
        setLoading(false);
      }
    };
    fetchOutOfStock();
  }, []);

  const totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <motion.div
      className="bg-gradient-to-br from-red-50 via-white to-rose-50 rounded-3xl p-6 shadow-lg"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Produits en Rupture de Stock</h1>
          <p className="text-gray-500 mt-1">
            Liste des produits actuellement épuisés en boutique.
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-sm transition"
        >
          ⬅ Retour au Tableau de Bord
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <StatCard title="Produits en Rupture" value={products.length} color="red" icon="❌" />
        <StatCard
          title="Valeur Totale Potentielle"
          value={`${totalValue.toLocaleString()} CFA`}
          color="rose"
          icon="💰"
        />
      </div>

      <div className="hidden md:block overflow-x-auto bg-white rounded-2xl shadow border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Produit', 'Catégorie', 'Fournisseur', 'Prix (CFA)', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((p) => (
              <tr key={p._id} className="hover:bg-red-50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{p.name}</td>
                <td className="px-6 py-4 text-gray-600">{p.category || '—'}</td>
                <td className="px-6 py-4 text-gray-600">{p.supplierName || '—'}</td>
                <td className="px-6 py-4 text-gray-700">{p.price?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate(productEditPath(p))}
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
              <span className="text-xs text-gray-500">📦 {p.price?.toLocaleString() || '—'} CFA</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Fournisseur : <span className="text-gray-800">{p.supplierName || '—'}</span>
            </p>
            <div className="flex justify-end mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(productEditPath(p));
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition text-sm font-medium"
              >
                Réapprovisionner
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const StatCard = ({ title, value, color, icon }) => {
  const colorMap = {
    red: 'from-red-500 to-rose-400',
    rose: 'from-rose-500 to-pink-400',
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

export default OutOfStockProducts;
