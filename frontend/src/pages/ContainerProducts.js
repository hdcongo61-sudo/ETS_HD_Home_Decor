import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ProductHero, ProductPageShell } from '../components/ProductAnalyticsUI';
import { Workspace } from '../components/business';

const rangeOptions = [
  { value: 'day', label: '24 dernieres heures' },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: 'year', label: '12 derniers mois' },
  { value: 'all', label: 'Toutes les periodes' },
];

const defaultTotals = {
  containerCount: 0,
  productCount: 0,
  stockValue: 0,
  revenue: 0,
  profit: 0,
  unitsSold: 0,
};

const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');

const ContainerProducts = () => {
  const [range, setRange] = useState('month');
  const navigate = useNavigate();
  const [containers, setContainers] = useState([]);
  const [totals, setTotals] = useState(defaultTotals);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchContainerData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/products/by-container?range=${range}`);
        const { containers = [], totals = {}, generatedAt = '' } = res.data || {};

        setContainers(containers);
        setTotals({ ...defaultTotals, ...totals });
        setGeneratedAt(generatedAt);
      } catch (err) {
        console.error('Erreur lors du chargement des produits par conteneur:', err);
        setError("Impossible de charger les donnees conteneurs pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    fetchContainerData();
  }, [range]);

  const summaryCards = [
    {
      title: 'Conteneurs actifs',
      value: formatNumber(totals.containerCount),
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
      title: 'Revenus generes',
      value: formatCurrency(totals.revenue),
      accent: 'from-violet-500 to-fuchsia-500',
    },
    {
      title: 'Profit total',
      value: formatCurrency(totals.profit),
      accent: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Unites vendues',
      value: formatNumber(totals.unitsSold),
      accent: 'from-orange-500 to-amber-500',
    },
  ];

  const renderGeneratedAt = () => {
    if (!generatedAt) return null;
    try {
      const date = new Date(generatedAt);
      return `Actualise le ${date.toLocaleDateString('fr-FR')} a ${date
        .toLocaleTimeString('fr-FR')
        .slice(0, 5)}`;
    } catch (err) {
      return null;
    }
  };

  return (
  <Workspace>
    <ProductPageShell>
      <ProductHero
        eyebrow="Inventaire conteneur"
        title="Produits par conteneur"
        description="Analyse détaillée des performances produit par conteneur."
        meta={renderGeneratedAt()}
        onBack={() => navigate('/product-dashboard')}
        actions={
          <label htmlFor="range" className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
            Période
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="form-control min-w-[190px] text-sm"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          </label>
        }
      />

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
            {containers.map((container) => (
              <motion.div
                key={container.containerName}
                className="bg-white p-6 rounded-3xl shadow-md border border-gray-100"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {container.containerName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatNumber(container.totalProducts)} produits
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Produits</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{formatNumber(container.totalProducts)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Stock</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{formatCurrency(container.totalStockValue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Revenu</p>
                      <p className="text-base sm:text-lg font-semibold text-emerald-600 mt-0.5">{formatCurrency(container.totalRevenue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Profit</p>
                      <p className="text-base sm:text-lg font-semibold text-indigo-600 mt-0.5">{formatCurrency(container.totalProfit)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Unites vendues</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{formatNumber(container.totalUnitsSold)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 min-h-[44px] flex flex-col justify-center">
                      <p className="text-xs sm:text-sm text-gray-500">Marge moy.</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800 mt-0.5">{`${Number(container.averageMargin || 0).toFixed(1)} %`}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="responsive-table min-w-full text-sm">
                    <thead className="bg-indigo-50 text-indigo-700 uppercase text-xs">
                      <tr>
                        <th className="py-2 px-3 text-left">Produit</th>
                        <th className="py-2 px-3 text-left">Categorie</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                        <th className="py-2 px-3 text-right">Valeur Stock</th>
                        <th className="py-2 px-3 text-right">Ventes</th>
                        <th className="py-2 px-3 text-right">Revenu</th>
                        <th className="py-2 px-3 text-right">Profit</th>
                        <th className="py-2 px-3 text-right">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {container.products && container.products.length > 0 ? (
                        container.products.map((product) => (
                          <tr
                            key={`${container.containerName}-${product._id}`}
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
                            <td data-title="Categorie" className="py-2 px-3 text-gray-500">
                              {product.category || 'Non categorise'}
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
                            Aucun produit enregistre pour ce conteneur.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ))}

            {containers.length === 0 && !error && (
              <div className="bg-white border border-dashed border-gray-200 p-10 rounded-3xl text-center text-gray-500">
                Aucun conteneur a afficher pour la periode selectionnee.
              </div>
            )}
          </div>
        </>
      )}
    </ProductPageShell>
  </Workspace>
  );
};

export default ContainerProducts;
