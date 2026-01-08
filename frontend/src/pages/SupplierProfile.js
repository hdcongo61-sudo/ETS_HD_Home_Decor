import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const rangeOptions = [
  { value: 'day', label: '24 dernières heures' },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: 'year', label: '12 derniers mois' },
  { value: 'all', label: 'Toutes les périodes' },
];

const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');

const SupplierProfile = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState('all');
  const [supplier, setSupplier] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const supplierName = useMemo(() => {
    if (!name) return '';
    try {
      return decodeURIComponent(name);
    } catch (err) {
      return name;
    }
  }, [name]);

  useEffect(() => {
    const fetchSupplier = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/products/by-supplier?range=${range}`);
        const suppliers = res.data?.suppliers || [];
        const match = suppliers.find(
          (s) =>
            (s.supplierName || '').trim().toLowerCase() ===
            supplierName.trim().toLowerCase()
        );
        setSupplier(match || null);
        setGeneratedAt(res.data?.generatedAt || '');
        if (!match) {
          setError('Aucun fournisseur correspondant pour cette période.');
        }
      } catch (err) {
        console.error('Erreur chargement profil fournisseur:', err);
        setError("Impossible de charger le profil fournisseur pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    if (supplierName) {
      fetchSupplier();
    } else {
      setLoading(false);
      setError('Fournisseur introuvable.');
    }
  }, [range, supplierName]);

  const summaryCards = supplier
    ? [
        {
          title: 'Produits',
          value: formatNumber(supplier.totalProducts),
          accent: 'from-indigo-500 to-purple-500',
        },
        {
          title: 'Stock total',
          value: formatCurrency(supplier.totalStockValue),
          accent: 'from-blue-500 to-indigo-500',
        },
        {
          title: 'Revenu total',
          value: formatCurrency(supplier.totalRevenue),
          accent: 'from-emerald-500 to-teal-500',
        },
        {
          title: 'Profit total',
          value: formatCurrency(supplier.totalProfit),
          accent: 'from-green-500 to-emerald-500',
        },
        {
          title: 'Unités vendues',
          value: formatNumber(supplier.totalUnitsSold),
          accent: 'from-orange-500 to-amber-500',
        },
        {
          title: 'Marge moyenne',
          value: `${Number(supplier.averageMargin || 0).toFixed(1)} %`,
          accent: 'from-fuchsia-500 to-pink-500',
        },
        {
          title: 'Stock critique',
          value: formatNumber(supplier.lowStockCount),
          accent: 'from-yellow-500 to-amber-500',
        },
        {
          title: 'Ruptures',
          value: formatNumber(supplier.outOfStockCount),
          accent: 'from-red-500 to-rose-500',
        },
      ]
    : [];

  const renderGeneratedAt = () => {
    if (!generatedAt) return null;
    try {
      const date = new Date(generatedAt);
      return `Actualisé le ${date.toLocaleDateString('fr-FR')} à ${date
        .toLocaleTimeString('fr-FR')
        .slice(0, 5)}`;
    } catch (err) {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error && !supplier) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-6 text-center space-y-3">
        <p className="text-gray-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/products/by-supplier')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
        >
          Retour aux fournisseurs
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Profil Fournisseur
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {supplier?.supplierName || supplierName}
            {supplier?.supplierPhone ? ` • ${supplier.supplierPhone}` : ''}
          </p>
          {renderGeneratedAt() && (
            <p className="text-xs text-gray-400 mt-2">{renderGeneratedAt()}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/products/by-supplier')}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition shadow-sm"
          >
            ← Retour
          </button>
          <label htmlFor="range" className="text-sm font-medium text-gray-600">
            Période
          </label>
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {summaryCards.map((card) => (
          <motion.div
            key={card.title}
            whileHover={{ scale: 1.03 }}
            className={`bg-gradient-to-br ${card.accent} text-white p-5 rounded-2xl shadow-md`}
          >
            <h3 className="text-sm uppercase tracking-wide opacity-80">
              {card.title}
            </h3>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Produits du fournisseur
          </h2>
          <span className="text-xs text-gray-500">
            {formatNumber(supplier?.products?.length || 0)} produits
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-indigo-50 text-indigo-700 uppercase text-xs">
              <tr>
                <th className="py-2 px-3 text-left">Produit</th>
                <th className="py-2 px-3 text-left">Catégorie</th>
                <th className="py-2 px-3 text-right">Stock</th>
                <th className="py-2 px-3 text-right">Valeur Stock</th>
                <th className="py-2 px-3 text-right">Ventes</th>
                <th className="py-2 px-3 text-right">Revenu</th>
                <th className="py-2 px-3 text-right">Profit</th>
                <th className="py-2 px-3 text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {supplier?.products && supplier.products.length > 0 ? (
                supplier.products.map((product) => (
                  <tr
                    key={`${supplier.supplierName}-${product._id}`}
                    className="border-b last:border-0 hover:bg-indigo-50/40 transition-colors"
                  >
                    <td className="py-2 px-3 font-medium text-gray-800">
                      <Link
                        to={`/products/${product._id}`}
                        className="text-indigo-700 hover:text-indigo-900 hover:underline"
                      >
                        {product.name}
                      </Link>
                      {product.sku && (
                        <span className="ml-2 text-xs text-gray-400">
                          {product.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {product.category || 'Non catégorisé'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {formatNumber(product.stock)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {formatCurrency(product.stockValue)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {formatNumber(product.sold)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-600 font-semibold">
                      {formatCurrency(product.revenue)}
                    </td>
                    <td className="py-2 px-3 text-right text-indigo-600 font-semibold">
                      {formatCurrency(product.profit)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {`${Number(product.margin || 0).toFixed(1)} %`}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-4 px-3 text-center text-gray-500"
                  >
                    Aucun produit enregistré pour ce fournisseur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplierProfile;
