import React, { useState, useEffect, useContext, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import AuthContext from '../context/AuthContext';
import useAutoClearMessage from '../hooks/useAutoClearMessage';
import useResponsiveTable from '../hooks/useResponsiveTable';

// Enregistrer les composants de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const SaleForm = lazy(() => import('../components/SaleForm'));
const ExportSales = lazy(() => import('../components/ExportSales'));
const ExportSalesPdf = lazy(() => import('../components/ExportSalesPdf'));
const PaymentModal = lazy(() => import('../components/PaymentModal'));

// Fonctions utilitaires définies avant le composant
const calculateSaleTotals = (sale) => {
  const totalPaid = sale.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  const balance = sale.totalAmount - totalPaid;
  return { totalPaid, balance };
};

const parseDateSafely = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (dateString) => {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  };
  const parsedDate = parseDateSafely(dateString);
  return parsedDate ? parsedDate.toLocaleDateString('fr-FR', options) : 'Date indisponible';
};

const getStatusClass = (status) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
    case 'pending': return 'bg-blue-100 text-blue-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'completed': return 'Payée';
    case 'partially_paid': return 'Partiellement payée';
    case 'pending': return 'En attente';
    case 'cancelled': return 'Annulée';
    default: return status;
  }
};

const getProfitCategoryClass = (category) => {
  switch (category) {
    case 'excellent': return 'bg-purple-100 text-purple-800';
    case 'élevé': return 'bg-green-100 text-green-800';
    case 'moyen': return 'bg-blue-100 text-blue-800';
    case 'faible': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getProfitCategoryText = (category) => {
  switch (category) {
    case 'excellent': return 'Excellent';
    case 'élevé': return 'Élevé';
    case 'moyen': return 'Moyen';
    case 'faible': return 'Faible';
    default: return category;
  }
};

const getTodayFilterValue = () => new Date().toLocaleDateString('fr-CA');

// Composants enfants définis avant le composant principal
const StatCard = ({ title, value, icon, color }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center">
    <div className={`p-3 rounded-xl ${color} mr-4`}>
      {icon}
    </div>
    <div>
      <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </div>
  </div>
);

const AdvancedMetricCard = ({ title, value, change, icon, color, description }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {change !== undefined && (
          <div className={`flex items-center mt-1 text-sm ${
            change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            <svg className={`w-4 h-4 mr-1 ${change > 0 ? 'rotate-0' : 'rotate-180'}`} 
                 fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {change > 0 ? '+' : ''}{change}%
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        {icon}
      </div>
    </div>
    {description && (
      <p className="text-xs text-gray-500 mt-2">{description}</p>
    )}
  </div>
);

const ClientSegmentationChart = ({ segmentation }) => {
  const segments = segmentation.reduce((acc, client) => {
    acc[client.segment] = (acc[client.segment] || 0) + 1;
    return acc;
  }, {});

  const data = {
    labels: Object.keys(segments),
    datasets: [{
      data: Object.values(segments),
      backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57']
    }]
  };

  return (
    <div className="h-64">
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }}
      />
    </div>
  );
};

const ProductPerformanceChart = ({ products }) => {
  const data = {
    labels: products.slice(0, 5).map(p => p.product?.name || 'Produit inconnu'),
    datasets: [{
      label: 'Revenus (CFA)',
      data: products.slice(0, 5).map(p => p.quantity * (p.product?.price || 0)),
      backgroundColor: 'rgba(54, 162, 235, 0.8)'
    }]
  };

  return (
    <div className="h-64">
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }}
      />
    </div>
  );
};

const ClientRFMAnalysis = ({ clients, onClientSelect }) => {
  const tableRef = useRef(null);
  useResponsiveTable(tableRef, [clients]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible md:overflow-hidden">
    <div className="p-6 border-b border-gray-200">
      <h3 className="text-lg font-semibold">Analyse RFM des Clients</h3>
    </div>
    <div className="overflow-visible md:overflow-x-auto">
      <table ref={tableRef} className="w-full responsive-table">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
            <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Segment</th>
            <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CA Total</th>
            <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commandes</th>
            <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière</th>
            <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernier Paiement</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {clients.slice(0, 10).map((client, index) => (
            <tr key={index} className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onClientSelect(client)}>
              <td className="px-6 py-4 whitespace-nowrap align-top">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {client.client.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{client.client.name}</div>
                    <div className="text-sm text-gray-500">{client.client.email}</div>
                    {client.client?._id && (
                      <Link
                        to={`/clients/${client.client._id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Voir le profil
                      </Link>
                    )}
                    <div className="mt-2 text-xs text-gray-500 space-y-1 md:hidden">
                      <p>Segment: {client.segment}</p>
                      <p>CA: {Math.round(client.totalSpent).toLocaleString('fr-FR')} CFA</p>
                      <p>Commandes: {client.purchaseCount}</p>
                      <p>Dernière: {client.recency} jours</p>
                      <p>
                        Dernier paiement: {client.lastPaymentDate
                          ? client.lastPaymentDate.toLocaleString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Aucun paiement'}
                        {client.lastPaymentRecency != null && (
                          <span className="text-gray-400"> ({client.lastPaymentRecency} jours)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </td>
              <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  client.segment === 'VIP' ? 'bg-purple-100 text-purple-800' :
                  client.segment === 'Fidèle' ? 'bg-green-100 text-green-800' :
                  client.segment === 'Inactif' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {client.segment}
                </span>
              </td>
              <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {Math.round(client.totalSpent).toLocaleString('fr-FR')} CFA
              </td>
              <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {client.purchaseCount}
              </td>
              <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {client.recency} jours
              </td>
              <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {client.lastPaymentDate
                  ? client.lastPaymentDate.toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Aucun paiement'}
                {client.lastPaymentRecency != null && (
                  <span className="block text-xs text-gray-400">
                    {client.lastPaymentRecency} jours
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
};

// Composant pour l'analyse des bénéfices
const ProfitAnalysis = () => {
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    period: 'month',
    startDate: '',
    endDate: '',
    category: ''
  });

  const fetchProfitData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/sales/profit-analytics?${params}`);
      setProfitData(response.data.data);
    } catch (error) {
      console.error('Erreur chargement bénéfices:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProfitData();
  }, [fetchProfitData]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const topProductsTableRef = useRef(null);
  const categoryTableRef = useRef(null);
  useResponsiveTable(topProductsTableRef, [profitData?.topProducts || []]);
  useResponsiveTable(categoryTableRef, [profitData?.profitByCategory || []]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!profitData) {
    return (
      <div className="text-center py-8 text-red-500 bg-red-50 rounded-xl">
        Erreur de chargement des données de bénéfices
      </div>
    );
  }

  const { periodAnalytics, topProducts, generalStats, profitByCategory } = profitData;

  // Configuration des graphiques pour les bénéfices
  const profitTrendChart = {
    labels: periodAnalytics.map((item, index) => 
      filters.period === 'day' ? `Jour ${item._id}` :
      filters.period === 'week' ? `Semaine ${item._id}` :
      filters.period === 'month' ? `Mois ${item._id}` : `Année ${item._id}`
    ),
    datasets: [
      {
        label: 'Bénéfice (CFA)',
        data: periodAnalytics.map(item => item.totalProfit || 0),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Chiffre d\'affaires (CFA)',
        data: periodAnalytics.map(item => item.totalSales || 0),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const topProductsChart = {
    labels: topProducts.slice(0, 8).map(product => 
      product.productName.length > 20 ? product.productName.substring(0, 20) + '...' : product.productName
    ),
    datasets: [
      {
        label: 'Bénéfice (CFA)',
        data: topProducts.slice(0, 8).map(product => product.totalProfit || 0),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1
      }
    ]
  };

  const profitByCategoryChart = {
    labels: profitByCategory.map(item => item._id || 'Non catégorisé'),
    datasets: [
      {
        label: 'Bénéfice par catégorie (CFA)',
        data: profitByCategory.map(item => item.totalProfit || 0),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)'
        ]
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Filtres pour l'analyse des bénéfices */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtres d'analyse</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
            <select 
              value={filters.period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ period: 'month', startDate: '', endDate: '', category: '' })}
              className="w-full p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques générales des bénéfices */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Bénéfice total"
          value={`${(generalStats.totalProfit || 0).toLocaleString('fr-FR')} CFA`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="bg-green-500"
        />

        <StatCard
          title="Marge moyenne"
          value={`${(generalStats.averageMargin || 0).toFixed(2)}%`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          color="bg-blue-500"
        />

        <StatCard
          title="Bénéfice moyen/vente"
          value={`${(generalStats.averageProfit || 0).toLocaleString('fr-FR')} CFA`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          color="bg-purple-500"
        />

        <StatCard
          title="Ventes rentables"
          value={`${generalStats.profitableSales || 0}/${generalStats.saleCount || 0}`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="bg-teal-500"
        />
      </div>

      {/* Graphiques des bénéfices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution des bénéfices</h3>
          <div className="h-64">
            <Line
              data={profitTrendChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top produits rentables</h3>
          <div className="h-64">
            <Bar
              data={topProductsChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: 'rgba(0, 0, 0, 0.05)'
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Tableau détaillé des produits rentables */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Détail des produits les plus rentables</h3>
        <div className="overflow-visible md:overflow-x-auto">
          <table ref={topProductsTableRef} className="w-full responsive-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Produit</th>
                <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Quantité</th>
                <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Chiffre d'affaires</th>
                <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Coût total</th>
                <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Bénéfice</th>
                <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Marge</th>
              </tr>
            </thead>
            <tbody className="md:divide-y md:divide-gray-100">
              {topProducts.slice(0, 10).map((product, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 text-sm font-medium text-gray-900">
                    {product.productName}
                    <div className="mt-2 text-xs text-gray-500 space-y-1 md:hidden">
                      <p>Quantité: {product.totalQuantity}</p>
                      <p>CA: {(product.totalRevenue || 0).toLocaleString('fr-FR')} CFA</p>
                      <p>Coût: {(product.totalCost || 0).toLocaleString('fr-FR')} CFA</p>
                      <p>Bénéfice: {(product.totalProfit || 0).toLocaleString('fr-FR')} CFA</p>
                      <p>Marge: {(product.profitMargin || 0).toFixed(2)}%</p>
                    </div>
                  </td>
                  <td className="hidden md:table-cell p-3 text-sm text-gray-700 md:text-right">{product.totalQuantity}</td>
                  <td className="hidden md:table-cell p-3 text-sm text-gray-700 md:text-right">
                    {(product.totalRevenue || 0).toLocaleString('fr-FR')} CFA
                  </td>
                  <td className="hidden md:table-cell p-3 text-sm text-gray-700 md:text-right">
                    {(product.totalCost || 0).toLocaleString('fr-FR')} CFA
                  </td>
                  <td className="hidden md:table-cell p-3 text-sm font-semibold text-green-600 md:text-right">
                    {(product.totalProfit || 0).toLocaleString('fr-FR')} CFA
                  </td>
                  <td className="hidden md:table-cell p-3 text-sm font-semibold text-blue-600 md:text-right">
                    {(product.profitMargin || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analyse par catégorie */}
      {profitByCategory.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bénéfices par catégorie</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <Bar
                data={profitByCategoryChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  }
                }}
              />
            </div>
            <div className="overflow-visible md:overflow-x-auto">
              <table ref={categoryTableRef} className="w-full responsive-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium text-gray-600">Catégorie</th>
                    <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Bénéfice</th>
                    <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Marge</th>
                    <th className="hidden md:table-cell p-3 text-right text-sm font-medium text-gray-600">Ventes</th>
                  </tr>
                </thead>
                <tbody className="md:divide-y md:divide-gray-100">
                  {profitByCategory.map((category, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="p-3 text-sm font-medium text-gray-900">
                        {category._id || 'Non catégorisé'}
                        <div className="mt-2 text-xs text-gray-500 space-y-1 md:hidden">
                          <p>Bénéfice: {(category.totalProfit || 0).toLocaleString('fr-FR')} CFA</p>
                          <p>Marge: {(category.profitMargin || 0).toFixed(2)}%</p>
                          <p>Ventes: {category.saleCount}</p>
                        </div>
                      </td>
                      <td className="hidden md:table-cell p-3 text-sm font-semibold text-green-600 md:text-right">
                        {(category.totalProfit || 0).toLocaleString('fr-FR')} CFA
                      </td>
                      <td className="hidden md:table-cell p-3 text-sm text-blue-600 md:text-right">
                        {(category.profitMargin || 0).toFixed(2)}%
                      </td>
                      <td className="hidden md:table-cell p-3 text-sm text-gray-700 md:text-right">{category.saleCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Préparation des données pour le graphique de livraison
const last7Days = [...Array(7)].map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - i);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}).reverse();

const deliveryTimelineData = {
  labels: last7Days,
  datasets: [
    {
      label: 'Livraisons par jour',
      data: last7Days.map(() => Math.floor(Math.random() * 10)),
      backgroundColor: 'rgba(0, 150, 0, 0.8)',
      borderColor: 'rgb(52, 199, 89)',
      borderWidth: 1,
      borderRadius: 6,
    }
  ]
};

const calculateGrowthRate = (salesData) => {
  if (salesData.length < 2) return 0;

  const referenceDate = new Date();
  const oneMonthAgo = new Date(referenceDate);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const twoMonthsAgo = new Date(referenceDate);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const lastMonth = salesData
    .filter(sale => {
      const saleDate = parseDateSafely(sale.saleDate);
      return saleDate && saleDate >= oneMonthAgo;
    })
    .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

  const previousMonth = salesData
    .filter(sale => {
      const saleDate = parseDateSafely(sale.saleDate);
      return saleDate && saleDate >= twoMonthsAgo && saleDate < oneMonthAgo;
    })
    .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

  return previousMonth > 0 ? (lastMonth - previousMonth) / previousMonth : 0;
};

const calculatePredictiveAnalytics = (salesData) => {
  if (salesData.length === 0) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = salesData.filter(sale => {
    const saleDate = parseDateSafely(sale.saleDate);
    return saleDate && saleDate >= thirtyDaysAgo;
  });

  const dailyAverages = last30Days.reduce((acc, sale) => {
    const saleDate = parseDateSafely(sale.saleDate);
    if (!saleDate) return acc;
    const dayKey = saleDate.toLocaleDateString();
    if (!acc[dayKey]) acc[dayKey] = { total: 0, count: 0 };
    acc[dayKey].total += sale.totalAmount;
    acc[dayKey].count += 1;
    return acc;
  }, {});

  const dailyEntries = Object.values(dailyAverages);
  const dayCount = dailyEntries.length;
  const avgDailyRevenue = dayCount > 0
    ? dailyEntries.reduce((sum, day) => sum + (day.total / Math.max(day.count, 1)), 0) / dayCount
    : 0;

  const growthRate = calculateGrowthRate(salesData);

  return {
    next30Days: avgDailyRevenue * 30 * (1 + growthRate),
    growthRate: growthRate * 100,
    confidence: Math.min(85 + (salesData.length / 100), 95)
  };
};

const analyzeClientSegmentation = (salesData, clientsData) => {
  const clientSales = salesData.reduce((acc, sale) => {
    if (!sale?.client) return acc;
    const saleDate = parseDateSafely(sale.saleDate);
    if (!saleDate) return acc;

    const clientId = sale.client._id;
    if (!acc[clientId]) {
      acc[clientId] = {
        totalSpent: 0,
        purchaseCount: 0,
        lastPurchase: saleDate,
        lastPayment: null,
        averagePurchase: 0,
        client: sale.client
      };
    }

    acc[clientId].totalSpent += sale.totalAmount || 0;
    acc[clientId].purchaseCount += 1;
    acc[clientId].lastPurchase = new Date(Math.max(
      acc[clientId].lastPurchase.getTime(),
      saleDate.getTime()
    ));

    if (Array.isArray(sale.payments)) {
      sale.payments.forEach((payment) => {
        const paymentDate = parseDateSafely(payment?.paymentDate || payment?.createdAt);
        if (!paymentDate) return;

        if (!acc[clientId].lastPayment || paymentDate > acc[clientId].lastPayment) {
          acc[clientId].lastPayment = paymentDate;
        }
      });
    }

    return acc;
  }, {});

  const segmentedClients = Object.entries(clientSales).map(([clientId, metrics]) => {
    const lastPurchaseTime = metrics.lastPurchase?.getTime?.() || Date.now();
    const recency = Math.floor((Date.now() - lastPurchaseTime) / (1000 * 60 * 60 * 24));
    metrics.averagePurchase = metrics.purchaseCount > 0
      ? metrics.totalSpent / metrics.purchaseCount
      : 0;

    const lastPaymentTime = metrics.lastPayment?.getTime?.();
    const lastPaymentRecency = lastPaymentTime != null
      ? Math.floor((Date.now() - lastPaymentTime) / (1000 * 60 * 60 * 24))
      : null;

    let segment = 'Nouveau';
    if (metrics.purchaseCount > 5 && metrics.totalSpent > 100000) segment = 'VIP';
    else if (metrics.purchaseCount > 2 && recency < 30) segment = 'Fidèle';
    else if (recency > 90) segment = 'Inactif';

    return {
      ...metrics,
      segment,
      recency,
      lastPaymentRecency,
      lastPaymentDate: metrics.lastPayment
    };
  });

  return segmentedClients.sort((a, b) => b.totalSpent - a.totalSpent);
};

const detectAnomalies = (salesData) => {
  if (salesData.length < 10) return [];
  
  const amounts = salesData.map(s => s.totalAmount).filter(amt => amt > 0);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / amounts.length);
  
  return salesData.filter(sale => {
    const zScore = Math.abs((sale.totalAmount - mean) / stdDev);
    return zScore > 3;
  }).map(anomaly => ({
    ...anomaly,
    deviation: Math.round(((anomaly.totalAmount - mean) / mean) * 100)
  }));
};

const calculateAdvancedKPIs = (salesData, clientsData) => {
  const completedSales = salesData.filter(s => s.status === 'completed');
  const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const uniqueClients = new Set(completedSales.map(s => s.client?._id).filter(Boolean));
  
  return {
    conversionRate: clientsData.length > 0 ? 
      (uniqueClients.size / clientsData.length) * 100 : 0,
    averageTransactionValue: completedSales.length > 0 ? 
      totalRevenue / completedSales.length : 0,
    customerLifetimeValue: uniqueClients.size > 0 ? 
      totalRevenue / uniqueClients.size : 0
  };
};

// COMPOSANT PRINCIPAL
const Sales = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(() => getTodayFilterValue());
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  useAutoClearMessage(message, setMessage);

  // Nouveaux états pour les fonctionnalités avancées
  const [viewMode, setViewMode] = useState('dashboard');
  const [timeRange, setTimeRange] = useState('30days');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [predictiveData, setPredictiveData] = useState(null);
  const [clientSegmentation, setClientSegmentation] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [quickFilters, setQuickFilters] = useState({
    highValue: false,
    latePayments: false,
    recurring: false,
    highProfit: false
  });

  // États dashboard améliorés
  const [dashboardData, setDashboardData] = useState({
    totalSales: 0,
    salesCount: 0,
    averageSale: 0,
    totalProducts: 0,
    topProducts: [],
    salesTrend: [],
    paymentMethods: {},
    statusStats: {
      pending: { count: 0, totalAmount: 0 },
      partially_paid: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 }
    },
    dailySummary: {
      salesCount: 0,
      totalAmount: 0,
      averageSale: 0,
      pendingSales: 0,
      completedSales: 0,
      paymentsCount: 0,
      paymentsTotal: 0
    },
    paymentsSummary: {
      paymentsCount: 0,
      paymentsTotal: 0
    },
    forecast: {
      next30Days: 0,
      growthRate: 0,
      confidence: 0
    },
    clientMetrics: {
      topClients: [],
      newClients: 0,
      clientRetention: 0
    },
    kpis: {
      conversionRate: 0,
      averageTransactionValue: 0,
      customerLifetimeValue: 0
    }
  });

  const [deliveryStats, setDeliveryStats] = useState({
    delivered: 0,
    pending: 0,
    not_delivered: 0,
    totalCompleted: 0,
    deliveryRate: 0
  });

  // Filtrage amélioré avec les nouveaux filtres rapides
  const filteredSales = useMemo(() => {
    let filtered = sales.filter(sale => {
      const statusMatch = !statusFilter || sale.status === statusFilter;
      const clientMatch = !clientFilter || (sale.client && sale.client._id === clientFilter);
      const saleDate = parseDateSafely(sale.saleDate);
      const dateMatch = !dateFilter ||
        (saleDate && saleDate.toLocaleDateString('fr-CA') === dateFilter);
      
      const deliveryMatch = !deliveryFilter || 
        (sale.status === 'completed' && 
         (deliveryFilter === 'all_completed' || sale.deliveryStatus === deliveryFilter));
      
      return statusMatch && clientMatch && dateMatch && deliveryMatch;
    });

    // Application des filtres rapides
    if (quickFilters.highValue) {
      filtered = filtered.filter(sale => sale.totalAmount > 50000);
    }
    if (quickFilters.latePayments) {
      filtered = filtered.filter(sale => {
        const { balance } = calculateSaleTotals(sale);
        return balance > 0 && sale.status !== 'cancelled';
      });
    }
    if (quickFilters.recurring) {
      const clientSalesCount = sales.reduce((acc, s) => {
        if (s.client) {
          acc[s.client._id] = (acc[s.client._id] || 0) + 1;
        }
        return acc;
      }, {});
      filtered = filtered.filter(sale => 
        sale.client && clientSalesCount[sale.client._id] > 1
      );
    }
    if (quickFilters.highProfit) {
      filtered = filtered.filter(sale => 
        sale.profitData && sale.profitData.totalProfit > 10000
      );
    }

    return filtered;
  }, [sales, statusFilter, clientFilter, dateFilter, deliveryFilter, quickFilters]);

  const fetchClients = useCallback(async () => {
    try {
      const response = await api.get('/clients');
      const clientsData = Array.isArray(response.data)
        ? response.data
        : response.data.clients || [];
      setClients(clientsData);
      return clientsData;
    } catch (error) {
      console.error('Erreur clients:', error);
      setError('Erreur de chargement des clients');
      setClients([]);
      return [];
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
      return response.data;
    } catch (error) {
      setError('Erreur de chargement des produits');
      return [];
    }
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const response = await api.get('/sales');
      setSales(response.data);
      return response.data;
    } catch (error) {
      setError('Erreur de chargement des ventes');
      return [];
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setDashboardLoading(true);
      const params = new URLSearchParams({ range: timeRange });
      if (dateFilter) {
        params.append('summaryDate', dateFilter);
      }
      const response = await api.get(`/sales/dashboard-sale?${params.toString()}`);
      setDashboardData(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Erreur dashboard:', error);
      setMessage('Erreur de chargement du tableau de bord');
    } finally {
      setDashboardLoading(false);
    }
  }, [timeRange, dateFilter]);

  // Effets et fonctions de chargement
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clientsData, , salesData] = await Promise.all([
          fetchClients(),
          fetchProducts(),
          fetchSales()
        ]);

        if (isAdmin) {
          await fetchDashboardData();
          
          const predictive = calculatePredictiveAnalytics(salesData);
          const segmentation = analyzeClientSegmentation(salesData, clientsData);
          const detectedAnomalies = detectAnomalies(salesData);
          const kpis = calculateAdvancedKPIs(salesData, clientsData);
          
          setPredictiveData(predictive);
          setClientSegmentation(segmentation);
          setAnomalies(detectedAnomalies);
          
          setDashboardData(prev => ({
            ...prev,
            forecast: predictive || prev.forecast,
            clientMetrics: {
              ...prev.clientMetrics,
              topClients: segmentation.slice(0, 5)
            },
            kpis: { ...prev.kpis, ...kpis }
          }));
        }
      } catch (err) {
        setError('Erreur de chargement des données');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange, isAdmin, fetchClients, fetchProducts, fetchSales, fetchDashboardData]);

  useEffect(() => {
    if (sales.length > 0) {
      const completedSales = sales.filter(sale => sale.status === 'completed');
      const delivered = completedSales.filter(sale => sale.deliveryStatus === 'delivered').length;
      const pending = completedSales.filter(sale => sale.deliveryStatus === 'pending' || !sale.deliveryStatus).length;
      const notDelivered = completedSales.filter(sale => sale.deliveryStatus === 'not_delivered').length;
      const totalCompleted = completedSales.length;
      const deliveryRate = totalCompleted > 0 ? Math.round((delivered / totalCompleted) * 100) : 0;

      setDeliveryStats({
        delivered,
        pending,
        not_delivered: notDelivered,
        totalCompleted,
        deliveryRate
      });
    }
  }, [sales]);

  const handleSubmitSale = async (saleData) => {
    try {
      setMessage('');
      await api.post('/sales', saleData);
      setMessage('Vente enregistrée avec succès!');
      await Promise.all([fetchSales(), fetchProducts()]);

      if (isAdmin) {
        await fetchDashboardData();
      }
    } catch (error) {
      setMessage('Erreur: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddPayment = async (paymentData) => {
    try {
      await api.post(`/sales/${selectedSale._id}/payments`, paymentData);
      await fetchSales();
      setMessage('Paiement ajouté avec succès!');
      setShowPaymentModal(false);

      if (isAdmin) {
        await fetchDashboardData();
      }
    } catch (error) {
      console.error('Payment error:', error.response?.data);
      setMessage('Erreur: ' + (error.response?.data?.message || error.message));
      throw error;
    }
  };

  const handleUpdateDelivery = async () => {
    try {
      setMessage('Mise à jour en cours...');

      const payload = {
        deliveryStatus,
        deliveryNote: deliveryNote || '',
        deliveryDate: deliveryStatus === 'delivered' ? new Date().toISOString() : null
      };

      await api.put(`/sales/${selectedSale._id}/delivery`, payload);
      await fetchSales();
      
      setMessage('✅ Statut de livraison mis à jour avec succès!');
      
      setTimeout(() => {
        setShowDeliveryModal(false);
      }, 2000);

    } catch (error) {
      console.error('Erreur:', error);
      setMessage('❌ Erreur: ' + (error.response?.data?.message || error.message));
    }
  };

  // Composant QuickFilterBar
  const QuickFilterBar = () => (
    <div className="flex flex-wrap gap-3 mb-6">
      <button
        onClick={() => setQuickFilters(prev => ({ ...prev, highValue: !prev.highValue }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.highValue 
            ? 'bg-purple-100 border-purple-500 text-purple-700' 
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        💎 Hautes Valeurs
      </button>
      
      <button
        onClick={() => setQuickFilters(prev => ({ ...prev, latePayments: !prev.latePayments }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.latePayments 
            ? 'bg-red-100 border-red-500 text-red-700' 
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        ⚠️ Retards Paiement
      </button>
      
      <button
        onClick={() => setQuickFilters(prev => ({ ...prev, recurring: !prev.recurring }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.recurring 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        🔄 Clients Récurrents
      </button>

      <button
        onClick={() => setQuickFilters(prev => ({ ...prev, highProfit: !prev.highProfit }))}
        className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
          quickFilters.highProfit 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        💰 Hauts Bénéfices
      </button>

      {(quickFilters.highValue || quickFilters.latePayments || quickFilters.recurring || quickFilters.highProfit) && (
        <button
          onClick={() => setQuickFilters({ highValue: false, latePayments: false, recurring: false, highProfit: false })}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
        >
          ✕ Effacer les filtres
        </button>
      )}
    </div>
  );

  // Configuration des graphiques
  const salesTrendChart = {
    labels: dashboardData.salesTrend.map(item => item.date),
    datasets: [
      {
        label: 'Chiffre d\'affaires (CFA)',
        data: dashboardData.salesTrend.map(item => item.total),
        borderColor: 'rgb(0, 122, 255)',
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const topProductsChart = {
    labels: dashboardData.topProducts.map(item => item.product?.name || 'Produit inconnu').slice(0, 5),
    datasets: [
      {
        label: 'Quantité vendue',
        data: dashboardData.topProducts.map(item => item.quantity).slice(0, 5),
        backgroundColor: [
          'rgba(255, 59, 48, 0.8)',
          'rgba(0, 122, 255, 0.8)',
          'rgba(52, 199, 89, 0.8)',
          'rgba(255, 149, 0, 0.8)',
          'rgba(88, 86, 214, 0.8)'
        ],
        borderColor: [
          'rgb(255, 59, 48)',
          'rgb(0, 122, 255)',
          'rgb(52, 199, 89)',
          'rgb(255, 149, 0)',
          'rgb(88, 86, 214)'
        ],
        borderWidth: 1
      }
    ]
  };

  const paymentMethodsChart = {
    labels: Object.keys(dashboardData.paymentMethods || {}).map(method => 
      method === 'MobileMoney' ? 'Mobile Money' : method
    ),
    datasets: [
      {
        label: 'Pourcentage',
        data: Object.values(dashboardData.paymentMethods || {}),
        backgroundColor: [
          'rgba(0, 122, 255, 0.8)',
          'rgba(52, 199, 89, 0.8)',
          'rgba(255, 149, 0, 0.8)',
          'rgba(255, 59, 48, 0.8)'
        ],
        borderWidth: 1
      }
    ]
  };

  const statusChart = {
    labels: ['Payée', 'Partiellement payée', 'En attente', 'Annulée'],
    datasets: [
      {
        label: 'Ventes par statut',
        data: [
          dashboardData.statusStats?.completed?.count || 0,
          dashboardData.statusStats?.partially_paid?.count || 0,
          dashboardData.statusStats?.pending?.count || 0,
          dashboardData.statusStats?.cancelled?.count || 0
        ],
        backgroundColor: [
          'rgba(52, 199, 89, 0.8)',
          'rgba(255, 204, 0, 0.8)',
          'rgba(0, 122, 255, 0.8)',
          'rgba(255, 59, 48, 0.8)'
        ],
        borderColor: [
          'rgb(52, 199, 89)',
          'rgb(255, 204, 0)',
          'rgb(0, 122, 255)',
          'rgb(255, 59, 48)'
        ],
        borderWidth: 1
      }
    ]
  };

  const paymentTableRef = useRef(null);
  const statusTableRef = useRef(null);
  useResponsiveTable(paymentTableRef, [dashboardData?.paymentMethods]);
  useResponsiveTable(statusTableRef, [dashboardData?.statusStats]);

  const deliveryChartData = {
    labels: ['Livrées', 'En attente', 'Non livrées'],
    datasets: [
      {
        data: [deliveryStats.delivered, deliveryStats.pending, deliveryStats.not_delivered],
        backgroundColor: [
          'rgba(52, 199, 89, 0.8)',
          'rgba(255, 204, 0, 0.8)',
          'rgba(255, 59, 48, 0.8)'
        ],
        borderColor: [
          'rgb(52, 199, 89)',
          'rgb(255, 204, 0)',
          'rgb(255, 59, 48)'
        ],
        borderWidth: 1
      }
    ]
  };

  // Vues améliorées
  const renderAnalyticsDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Avancées</h2>
          <p className="text-gray-600">Données prédictives et analyses détaillées</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
          >
            Vue Standard
          </button>
          <button
            onClick={() => setViewMode('profits')}
            className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
          >
            Analyse Bénéfices
          </button>
          <button
            onClick={() => setViewMode('clients')}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Analyse Clients
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AdvancedMetricCard
          title="Prévision 30 jours"
          value={`${Math.round(predictiveData?.next30Days || 0).toLocaleString('fr-FR')} CFA`}
          change={predictiveData?.growthRate}
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>}
          color="bg-gradient-to-r from-blue-500 to-purple-600"
          description={`Confiance: ${predictiveData?.confidence || 0}%`}
        />

        <AdvancedMetricCard
          title="CLV (Valeur Client)"
          value={`${Math.round(dashboardData.kpis.customerLifetimeValue).toLocaleString('fr-FR')} CFA`}
          change={12.5}
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>}
          color="bg-gradient-to-r from-green-500 to-teal-600"
          description="Valeur moyenne par client"
        />

        <AdvancedMetricCard
          title="Taux de Conversion"
          value={`${dashboardData.kpis.conversionRate.toFixed(1)}%`}
          change={8.2}
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>}
          color="bg-gradient-to-r from-orange-500 to-red-600"
          description="Clients actifs sur prospects"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Segmentation Client (RFM)</h3>
          <ClientSegmentationChart segmentation={clientSegmentation} />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance des Produits</h3>
          <ProductPerformanceChart products={dashboardData.topProducts} />
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Alertes d'Anomalies ({anomalies.length})
          </h3>
          <div className="space-y-2">
            {anomalies.slice(0, 3).map((anomaly, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg">
                <div>
                  <span className="font-medium">Vente #{anomaly._id?.slice(-6) || 'N/A'}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    {anomaly.client?.name} - {formatDate(anomaly.saleDate)}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  anomaly.deviation > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderClientAnalytics = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Analyse Client Détailée</h2>
        <button
          onClick={() => setViewMode('analytics')}
          className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
        >
          Retour aux Analytics
        </button>
      </div>

      <ClientRFMAnalysis 
        clients={clientSegmentation} 
        onClientSelect={(client) => {
          setClientFilter(client.client._id);
          setViewMode('dashboard');
        }}
      />
    </div>
  );

  const renderProfitAnalysis = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">💰 Analyse des Bénéfices</h2>
        <button
          onClick={() => setViewMode('analytics')}
          className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
        >
          Retour aux Analytics
        </button>
      </div>

      <ProfitAnalysis />
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 mx-4 border border-red-100">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              📊 Tableau de Bord Commercial
            </h1>
            <p className="text-gray-600 mt-1">Analyses avancées et prédictives</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-300 transition-colors"
              >
                📤 Exporter Données
              </button>
            )}
            
            {isAdmin && (
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="dashboard">📋 Vue Standard</option>
                <option value="analytics">📈 Analytics Avancées</option>
                <option value="profits">💰 Analyse des Bénéfices</option>
                <option value="clients">👥 Analyse Clients</option>
              </select>
            )}
          </div>
        </div>

        {/* Message de notification */}
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${message.includes('succès') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {message.includes('succès') ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
            {message}
          </div>
        )}

        {/* Navigation par vue */}
        {viewMode === 'analytics' && renderAnalyticsDashboard()}
        {viewMode === 'profits' && renderProfitAnalysis()}
        {viewMode === 'clients' && renderClientAnalytics()}

        {/* Vue dashboard standard */}
        {viewMode === 'dashboard' && (
          <>
            {/* Section Tableau de bord (Admin seulement) */}
            {isAdmin && (
              <div className="space-y-6">
                <QuickFilterBar />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <div className="bg-indigo-500 p-1.5 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    Tableau de bord des ventes
                  </h2>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTimeRange('7days')}
                      className={`px-3 py-1.5 rounded-lg text-sm ${timeRange === '7days' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
                    >
                      7 jours
                    </button>
                    <button
                      onClick={() => setTimeRange('30days')}
                      className={`px-3 py-1.5 rounded-lg text-sm ${timeRange === '30days' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
                    >
                      30 jours
                    </button>
                    <button
                      onClick={() => setTimeRange('90days')}
                      className={`px-3 py-1.5 rounded-lg text-sm ${timeRange === '90days' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
                    >
                      90 jours
                    </button>
                    <button
                      onClick={() => setTimeRange('all')}
                      className={`px-3 py-1.5 rounded-lg text-sm ${timeRange === 'all' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
                    >
                      Tous
                    </button>
                  </div>
                </div>

                {dashboardLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                      <StatCard
                        title="Chiffre d'affaires"
                        value={`${dashboardData.totalSales.toLocaleString('fr-FR')} CFA`}
                        icon={
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        color="bg-blue-500"
                      />

                      <StatCard
                        title="Nombre de ventes"
                        value={dashboardData.salesCount}
                        icon={
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        }
                        color="bg-green-500"
                      />

                      <StatCard
                        title="Vente moyenne"
                        value={`${dashboardData.averageSale.toLocaleString('fr-FR')} CFA`}
                        icon={
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        }
                        color="bg-purple-500"
                      />

                      <StatCard
                        title="Produits vendus"
                        value={dashboardData.totalProducts}
                        icon={
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        }
                        color="bg-yellow-500"
                      />

                      <StatCard
                        title="Paiements"
                        value={dashboardData.paymentsSummary.paymentsCount}
                        icon={
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        }
                        color="bg-indigo-500"
                      />

                      <StatCard
                        title="Total payé"
                        value={`${dashboardData.paymentsSummary.paymentsTotal.toLocaleString('fr-FR')} CFA`}
                        icon={
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        }
                        color="bg-pink-500"
                      />
                    </div>

                    {/* Section: Statistiques de livraison */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                        <div className="bg-green-500 p-1.5 rounded-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        Statistiques de Livraison
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                        <StatCard
                          title="Livrées"
                          value={deliveryStats.delivered}
                          icon={
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          }
                          color="bg-green-500"
                        />

                        <StatCard
                          title="En attente"
                          value={deliveryStats.pending}
                          icon={
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          color="bg-yellow-500"
                        />

                        <StatCard
                          title="Non livrées"
                          value={deliveryStats.not_delivered}
                          icon={
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          }
                          color="bg-red-500"
                        />

                        <StatCard
                          title="Total complétées"
                          value={deliveryStats.totalCompleted}
                          icon={
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          color="bg-blue-500"
                        />

                        <StatCard
                          title="Taux de livraison"
                          value={`${deliveryStats.deliveryRate}%`}
                          icon={
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          }
                          color="bg-purple-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition des livraisons</h3>
                          <div className="h-64">
                            <Doughnut
                              data={deliveryChartData}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'bottom',
                                  },
                                },
                              }}
                            />
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Livraisons des 7 derniers jours</h3>
                          <div className="h-64">
                            <Bar
                              data={deliveryTimelineData}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'top',
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    grid: {
                                      color: 'rgba(0, 0, 0, 0.05)'
                                    },
                                    ticks: {
                                      stepSize: 1
                                    }
                                  },
                                  x: {
                                    grid: {
                                      display: false
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section: Résumé du jour avec métriques avancées */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <div className="bg-green-500 p-1.5 rounded-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </div>
                        Résumé du Jour & Métriques Avancées
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                        <StatCard
                          title="Ventes aujourd'hui"
                          value={dashboardData.dailySummary.salesCount}
                          icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          }
                          color="bg-blue-500"
                        />

                        <StatCard
                          title="CA aujourd'hui"
                          value={`${dashboardData.dailySummary.totalAmount.toLocaleString('fr-FR')} CFA`}
                          icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          color="bg-green-500"
                        />

                        <StatCard
                          title="Moyenne/vente"
                          value={`${dashboardData.dailySummary.averageSale.toLocaleString('fr-FR')} CFA`}
                          icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          }
                          color="bg-purple-500"
                        />

                        <StatCard
                          title="En attente"
                          value={dashboardData.dailySummary.pendingSales}
                          icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          color="bg-yellow-500"
                        />

                        <StatCard
                          title="Complétées"
                          value={dashboardData.dailySummary.completedSales}
                          icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          color="bg-teal-500"
                        />

                        <StatCard
                          title="Paiements (jour)"
                          value={dashboardData.dailySummary.paymentsCount}
                          icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          }
                          color="bg-indigo-500"
                        />

                        <StatCard
                          title="Montant payé (jour)"
                          value={`${dashboardData.dailySummary.paymentsTotal.toLocaleString('fr-FR')} CFA`}
                          icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          color="bg-pink-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendance des ventes</h3>
                        <Line
                          data={salesTrendChart}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: {
                                position: 'top',
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                grid: {
                                  color: 'rgba(0, 0, 0, 0.05)'
                                }
                              },
                              x: {
                                grid: {
                                  display: false
                                }
                              }
                            }
                          }}
                        />
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top produits</h3>
                        <Bar
                          data={topProductsChart}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: {
                                position: 'top',
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                grid: {
                                  color: 'rgba(0, 0, 0, 0.05)'
                                }
                              },
                              x: {
                                grid: {
                                  display: false
                                }
                              }
                            }
                          }}
                        />
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Méthodes de paiement</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <Bar
                              data={paymentMethodsChart}
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'top',
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    grid: {
                                      color: 'rgba(0, 0, 0, 0.05)'
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                          <div className="overflow-visible md:overflow-x-auto">
                            <table ref={paymentTableRef} className="w-full text-left responsive-table">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-sm font-medium text-gray-600">Méthode</th>
                                  <th className="px-4 py-2 text-sm font-medium text-gray-600">Pourcentage</th>
                                  <th className="px-4 py-2 text-sm font-medium text-gray-600">Montant total</th>
                                </tr>
                              </thead>
                              <tbody className="md:divide-y md:divide-gray-100">
                                {Object.entries(dashboardData.paymentMethods || {}).map(([method, percentage]) => (
                                  <tr key={method} className="md:border-b md:border-gray-100">
                                    <td className="px-4 py-3 text-sm capitalize">{method === 'MobileMoney' ? 'Mobile Money' : method}</td>
                                    <td className="px-4 py-3 text-sm md:text-right">{percentage.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-sm font-medium md:text-right">
                                      {Math.round(dashboardData.totalSales * percentage / 100).toLocaleString('fr-FR')} CFA
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statut des ventes</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <Pie
                              data={statusChart}
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'top',
                                  },
                                },
                              }}
                            />
                          </div>
                          <div className="overflow-visible md:overflow-x-auto">
                            <table ref={statusTableRef} className="w-full text-left responsive-table">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-sm font-medium text-gray-600">Statut</th>
                                  <th className="hidden md:table-cell px-4 py-2 text-sm font-medium text-gray-600">Nombre</th>
                                  <th className="hidden md:table-cell px-4 py-2 text-sm font-medium text-gray-600">Montant total</th>
                                </tr>
                              </thead>
                              <tbody className="md:divide-y md:divide-gray-100">
                                <tr className="md:border-b md:border-gray-100">
                                  <td className="px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:gap-2">
                                    <span className="flex items-center">
                                      <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                                      Payée
                                    </span>
                                    <div className="mt-2 space-y-1 text-xs text-gray-500 md:hidden">
                                      <p>Nombre: {dashboardData.statusStats?.completed?.count || 0}</p>
                                      <p>Montant: {(dashboardData.statusStats?.completed?.totalAmount || 0).toLocaleString('fr-FR')} CFA</p>
                                    </div>
                                  </td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm md:text-right">{dashboardData.statusStats?.completed?.count || 0}</td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm font-medium md:text-right">
                                    {(dashboardData.statusStats?.completed?.totalAmount || 0).toLocaleString('fr-FR')} CFA
                                  </td>
                                </tr>
                                <tr className="md:border-b md:border-gray-100">
                                  <td className="px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:gap-2">
                                    <span className="flex items-center">
                                      <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                                      Partiellement payée
                                    </span>
                                    <div className="mt-2 space-y-1 text-xs text-gray-500 md:hidden">
                                      <p>Nombre: {dashboardData.statusStats?.partially_paid?.count || 0}</p>
                                      <p>Montant: {(dashboardData.statusStats?.partially_paid?.totalAmount || 0).toLocaleString('fr-FR')} CFA</p>
                                    </div>
                                  </td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm md:text-right">{dashboardData.statusStats?.partially_paid?.count || 0}</td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm font-medium md:text-right">
                                    {(dashboardData.statusStats?.partially_paid?.totalAmount || 0).toLocaleString('fr-FR')} CFA
                                  </td>
                                </tr>
                                <tr className="md:border-b md:border-gray-100">
                                  <td className="px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:gap-2">
                                    <span className="flex items-center">
                                      <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                                      En attente
                                    </span>
                                    <div className="mt-2 space-y-1 text-xs text-gray-500 md:hidden">
                                      <p>Nombre: {dashboardData.statusStats?.pending?.count || 0}</p>
                                      <p>Montant: {(dashboardData.statusStats?.pending?.totalAmount || 0).toLocaleString('fr-FR')} CFA</p>
                                    </div>
                                  </td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm md:text-right">{dashboardData.statusStats?.pending?.count || 0}</td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm font-medium md:text-right">
                                    {(dashboardData.statusStats?.pending?.totalAmount || 0).toLocaleString('fr-FR')} CFA
                                  </td>
                                </tr>
                                <tr className="border-b border-gray-100">
                                  <td className="px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:gap-2">
                                    <span className="flex items-center">
                                      <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                                      Annulée
                                    </span>
                                    <div className="mt-2 space-y-1 text-xs text-gray-500 md:hidden">
                                      <p>Nombre: {dashboardData.statusStats?.cancelled?.count || 0}</p>
                                      <p>Montant: {(dashboardData.statusStats?.cancelled?.totalAmount || 0).toLocaleString('fr-FR')} CFA</p>
                                    </div>
                                  </td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm md:text-right">{dashboardData.statusStats?.cancelled?.count || 0}</td>
                                  <td className="hidden md:table-cell px-4 py-3 text-sm font-medium md:text-right">
                                    {(dashboardData.statusStats?.cancelled?.totalAmount || 0).toLocaleString('fr-FR')} CFA
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Modal d'export */}
            {isAdmin && showExportModal && (
              <div
                className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                onClick={() => setShowExportModal(false)}
              >
                <div
                  className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Exporter les ventes</h2>
                      <button
                        onClick={() => setShowExportModal(false)}
                        className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <Suspense fallback={<div className="text-sm text-gray-500">Préparation de l'export...</div>}>
                      <ExportSales />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de statut de livraison */}
            {showDeliveryModal && selectedSale && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <div className="bg-blue-100 p-1.5 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016" />
                        </svg>
                      </div>
                      Statut de livraison
                    </h3>
                    <button
                      onClick={() => setShowDeliveryModal(false)}
                      className="text-gray-500 hover:text-gray-700 p-1 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Statut de livraison
                      </label>
                      <select
                        value={deliveryStatus || selectedSale.deliveryStatus || 'pending'}
                        onChange={(e) => setDeliveryStatus(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value="pending">En attente</option>
                        <option value="delivered">Livré</option>
                        <option value="not_delivered">Non livré</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Note de livraison (optionnelle)
                      </label>
                      <textarea
                        value={deliveryNote || selectedSale.deliveryNote || ''}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Notes sur la livraison..."
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        rows="3"
                        maxLength="500"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {deliveryNote.length}/500 caractères
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={() => setShowDeliveryModal(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleUpdateDelivery}
                        className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section Formulaire et Historique */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <Suspense fallback={<div className="text-sm text-gray-500">Chargement du formulaire...</div>}>
                  <SaleForm
                    clients={clients}
                    products={products}
                    onSubmit={handleSubmitSale}
                  />
                </Suspense>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="bg-purple-500 p-1.5 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  Historique des Ventes
                </h2>

                {/* Filtres */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Statut</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Tous</option>
                      <option value="completed">Payée</option>
                      <option value="partially_paid">Partiellement payée</option>
                      <option value="pending">En attente</option>
                      <option value="cancelled">Annulée</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Client</label>
                    <select
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Tous les clients</option>
                      {clients.map(client => (
                        <option key={client._id} value={client._id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Livraison</label>
                    <select
                      value={deliveryFilter}
                      onChange={(e) => setDeliveryFilter(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Tous</option>
                      <option value="all_completed">Toutes complétées</option>
                      <option value="delivered">Livrées</option>
                      <option value="pending">En attente</option>
                      <option value="not_delivered">Non livrées</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setStatusFilter('');
                        setClientFilter('');
                        setDateFilter('');
                        setDeliveryFilter('');
                        setQuickFilters({ highValue: false, latePayments: false, recurring: false, highProfit: false });
                      }}
                      className="w-full p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>

                {/* Liste des ventes */}
                <div className="space-y-4">
                  {filteredSales.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                      <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                      <p>Aucune vente trouvée</p>
                    </div>
                  ) : (
                    filteredSales.map(sale => {
                      const { totalPaid, balance } = calculateSaleTotals(sale);

                      return (
                        <div
                          key={sale._id}
                          className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow space-y-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <Link
                              to={`/sales/${sale._id}`}
                              className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Vente #{sale._id.slice(-6)}
                            </Link>

                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">
                              <span className="text-sm text-gray-500 inline-flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formatDate(sale.saleDate)}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs ${getStatusClass(sale.status)}`}>
                                {getStatusText(sale.status)}
                              </span>
                              {sale.status === 'completed' && (
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  sale.deliveryStatus === 'delivered' 
                                    ? 'bg-green-100 text-green-800' 
                                    : sale.deliveryStatus === 'not_delivered'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {sale.deliveryStatus === 'delivered' 
                                    ? 'Livré' 
                                    : sale.deliveryStatus === 'not_delivered'
                                    ? 'Non livré'
                                    : 'En attente'}
                                </span>
                              )}
                              {isAdmin && sale.profitData && (
                                <span className={`px-2 py-1 rounded-full text-xs ${getProfitCategoryClass(sale.profitCategory)}`}>
                                  {getProfitCategoryText(sale.profitCategory)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium text-gray-900">
                              {sale.client?.name || "Client non spécifié"}
                            </span>
                          </div>

                          {/* Affichage des bénéfices si disponibles */}
                          {isAdmin && sale.profitData && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-sm text-green-600 font-medium">
                                💰 Bénéfice: {sale.profitData.totalProfit?.toLocaleString('fr-FR')} CFA
                              </span>
                              <span className="text-sm text-blue-600">
                                📊 Marge: {sale.profitData.profitMargin?.toFixed(2)}%
                              </span>
                            </div>
                          )}

                          <div className="space-y-3">
                            {sale.products.map((item, index) => (
                              <div
                                key={index}
                                className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-start sm:justify-between"
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900 inline-flex items-center gap-1">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    {item.product?.name || "Produit supprimé"}
                                  </div>
                                  <div className="text-sm text-gray-600 pl-5">
                                    {item.quantity} x {item.priceAtSale?.toFixed()} CFA
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-gray-900">
                                    {(item.quantity * item.priceAtSale)?.toFixed()} CFA
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="pt-4 border-t border-gray-100">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Paiements:</h4>
                                <div className="space-y-2">
                                  {sale.payments?.map((payment, idx) => {
                                    const paymentDate = parseDateSafely(payment?.paymentDate);

                                    return (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">
                                            {payment.method === 'MobileMoney' ? 'Mobile Money' : payment.method}
                                          </span>
                                          <span className="text-gray-500 ml-2">
                                            {paymentDate
                                              ? paymentDate.toLocaleDateString('fr-FR')
                                              : 'Date indisponible'}
                                          </span>
                                        </div>
                                        <div className="font-medium text-gray-900">
                                          {payment.amount?.toFixed()} CFA
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="font-semibold text-gray-700">Total:</span>
                                  <span className="font-bold text-gray-900">
                                    {sale.totalAmount?.toFixed()} CFA
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Payé:</span>
                                  <span className="text-gray-700">
                                    {totalPaid?.toFixed()} CFA
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-semibold text-gray-700">Solde:</span>
                                  <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {balance?.toFixed()} CFA
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            {sale.status === 'completed' && (
                              <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
                                <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
                                  <Suspense fallback={<span className="text-xs text-gray-400">Chargement PDF...</span>}>
                                    <ExportSalesPdf sale={sale} />
                                  </Suspense>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedSale(sale);
                                    setDeliveryStatus(sale.deliveryStatus || 'pending');
                                    setDeliveryNote(sale.deliveryNote || '');
                                    setShowDeliveryModal(true);
                                  }}
                                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm transition-colors"
                                  title="Gérer le statut de livraison"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  Statut Livraison
                                </button>
                                <span className={`text-sm text-center sm:text-left ${
                                  sale.deliveryStatus === 'delivered' 
                                    ? 'text-green-600' 
                                    : sale.deliveryStatus === 'not_delivered'
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                                }`}>
                                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  {sale.deliveryStatus === 'delivered' 
                                    ? 'Livré' 
                                    : sale.deliveryStatus === 'not_delivered'
                                    ? 'Non livré'
                                    : 'En attente de livraison'}
                                </span>
                              </div>
                            )}

                            {sale.status !== 'completed' && sale.status !== 'cancelled' && (
                              <button
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setShowPaymentModal(true);
                                }}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-1 transition-colors w-full sm:w-auto"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Ajouter Paiement
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de paiement */}
      <Suspense fallback={null}>
        <PaymentModal
          show={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          sale={selectedSale}
          onAddPayment={handleAddPayment}
        />
      </Suspense>
    </div>
  );
};

export default Sales;
