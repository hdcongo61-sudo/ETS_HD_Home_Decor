import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const rangeOptions = [
  { value: 'day', label: '24 dernières heures' },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: 'year', label: '12 derniers mois' },
  { value: 'all', label: 'Toutes les périodes' },
];

const defaultTotals = {
  supplierCount: 0,
  productCount: 0,
  stockValue: 0,
  revenue: 0,
  profit: 0,
  unitsSold: 0,
};

const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');

const SupplierProducts = () => {
  const [range, setRange] = useState('month');
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [totals, setTotals] = useState(defaultTotals);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSupplierData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/products/by-supplier?range=${range}`);
        const { suppliers = [], totals = {}, generatedAt = '' } = res.data || {};

        setSuppliers(suppliers);
        setTotals({ ...defaultTotals, ...totals });
        setGeneratedAt(generatedAt);
      } catch (err) {
        console.error('Erreur lors du chargement des produits par fournisseur:', err);
        setError("Impossible de charger les données fournisseurs pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    fetchSupplierData();
  }, [range]);

  const summaryCards = [
    {
      title: 'Fournisseurs actifs',
      value: formatNumber(totals.supplierCount),
      accent: 'from-indigo-500 to-purple-500',
    },
    {
      title: 'Produits suivis',
      value: formatNumber(totals.productCount),
      accent: 'from-blue-500 to-indigo-500',
    },
    {
      title: 'Valeur du stock',
      value: formatCurrency(totals.stockValue),
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Revenus générés',
      value: formatCurrency(totals.revenue),
      accent: 'from-violet-500 to-fuchsia-500',
    },
    {
      title: 'Profit total',
      value: formatCurrency(totals.profit),
      accent: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Unités vendues',
      value: formatNumber(totals.unitsSold),
      accent: 'from-orange-500 to-amber-500',
    },
  ];

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Produits par Fournisseur
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyse détaillée des performances produit par fournisseur.
          </p>
          {renderGeneratedAt() && (
            <p className="text-xs text-gray-400 mt-2">{renderGeneratedAt()}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/product-dashboard')}
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
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

          <div className="space-y-6">
            {suppliers.map((supplier) => (
              <motion.div
                key={supplier.supplierName}
                className="bg-white p-6 rounded-3xl shadow-md border border-gray-100"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      <Link
                        to={`/suppliers/${encodeURIComponent(
                          supplier.supplierName || 'Inconnu'
                        )}`}
                        className="hover:underline text-indigo-700 hover:text-indigo-900"
                      >
                        {supplier.supplierName}
                      </Link>
                    </h2>
                    {supplier.supplierPhone && (
                      <p className="text-sm text-gray-500 mt-1">
                        📞 {supplier.supplierPhone}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Produits</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{formatNumber(supplier.totalProducts)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Stock</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{formatCurrency(supplier.totalStockValue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Revenu</p>
                      <p className="text-base sm:text-lg font-semibold text-emerald-600 mt-0.5">{formatCurrency(supplier.totalRevenue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Profit</p>
                      <p className="text-base sm:text-lg font-semibold text-indigo-600 mt-0.5">{formatCurrency(supplier.totalProfit)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Unités vendues</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{formatNumber(supplier.totalUnitsSold)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Marge moy.</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{`${Number(supplier.averageMargin || 0).toFixed(1)} %`}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="responsive-table min-w-full text-sm">
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
                      {supplier.products && supplier.products.length > 0 ? (
                        supplier.products.map((product) => (
                          <tr
                            key={`${supplier.supplierName}-${product._id}`}
                            className="border-b last:border-0 hover:bg-indigo-50/40 transition-colors"
                          >
                            <td data-title="Produit" className="py-2 px-3 font-medium text-gray-800 responsive-table__product-cell">
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
                            <td data-title="Catégorie" className="py-2 px-3 text-gray-500">
                              {product.category || 'Non catégorisé'}
                            </td>
                            <td data-title="Stock" className="py-2 px-3 text-right">
                              {formatNumber(product.stock)}
                            </td>
                            <td data-title="Valeur Stock" className="py-2 px-3 text-right">
                              {formatCurrency(product.stockValue)}
                            </td>
                            <td data-title="Ventes" className="py-2 px-3 text-right">
                              {formatNumber(product.sold)}
                            </td>
                            <td data-title="Revenu" className="py-2 px-3 text-right text-emerald-600 font-semibold">
                              {formatCurrency(product.revenue)}
                            </td>
                            <td data-title="Profit" className="py-2 px-3 text-right text-indigo-600 font-semibold">
                              {formatCurrency(product.profit)}
                            </td>
                            <td data-title="Marge" className="py-2 px-3 text-right">
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
              </motion.div>
            ))}

            {suppliers.length === 0 && !error && (
              <div className="bg-white border border-dashed border-gray-200 p-10 rounded-3xl text-center text-gray-500">
                Aucun fournisseur à afficher pour la période sélectionnée.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierProducts;
