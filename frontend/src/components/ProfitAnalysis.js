import React, { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import api from '../services/api';
import AppLoader from './AppLoader';

const ProfitAnalysis = () => {
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    period: 'month',
    startDate: '',
    endDate: ''
  });

  const fetchProfitData = async () => {
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
  };

  useEffect(() => {
    fetchProfitData();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm p-12 flex flex-col items-center justify-center gap-3">
        <AppLoader fullScreen={false} text="Chargement des données…" />
      </div>
    );
  }

  if (!profitData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-sm">
        Erreur de chargement des données. Vérifiez votre connexion et réessayez.
      </div>
    );
  }

  const { periodAnalytics, topProducts, generalStats, profitByCategory } = profitData;

  // Configuration des graphiques
  const profitTrendChart = {
    labels: periodAnalytics.map(item => `Période ${item._id}`),
    datasets: [
      {
        label: 'Bénéfice (CFA)',
        data: periodAnalytics.map(item => item.totalProfit),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true
      },
      {
        label: 'Chiffre d\'affaires (CFA)',
        data: periodAnalytics.map(item => item.totalSales),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      }
    ]
  };

  const topProductsChart = {
    labels: topProducts.map(product => product.productName),
    datasets: [
      {
        label: 'Bénéfice (CFA)',
        data: topProducts.map(product => product.totalProfit),
        backgroundColor: 'rgba(34, 197, 94, 0.8)'
      }
    ]
  };

  const cardClass = 'rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filtres */}
      <div className={cardClass}>
        <div className="p-4 sm:p-5">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Filtres d'analyse</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Période</label>
              <select
                value={filters.period}
                onChange={(e) => handleFilterChange('period', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date début</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date fin</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setFilters({ period: 'month', startDate: '', endDate: '' })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm font-medium transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques générales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={`${cardClass} p-4 sm:p-5`}>
          <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Bénéfice total</p>
          <p className="text-base sm:text-lg font-semibold text-green-600 tabular-nums break-words">
            {generalStats.totalProfit?.toLocaleString('fr-FR')} CFA
          </p>
        </div>
        <div className={`${cardClass} p-4 sm:p-5`}>
          <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Marge moyenne</p>
          <p className="text-base sm:text-lg font-semibold text-blue-600 tabular-nums">
            {generalStats.averageMargin?.toFixed(2)}%
          </p>
        </div>
        <div className={`${cardClass} p-4 sm:p-5`}>
          <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Bénéfice moyen/vente</p>
          <p className="text-base sm:text-lg font-semibold text-purple-600 tabular-nums break-words">
            {generalStats.averageProfitPerSale?.toLocaleString('fr-FR')} CFA
          </p>
        </div>
        <div className={`${cardClass} p-4 sm:p-5`}>
          <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Ventes analysées</p>
          <p className="text-base sm:text-lg font-semibold text-orange-600 tabular-nums">
            {generalStats.totalSales}
          </p>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className={cardClass}>
          <div className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Évolution des bénéfices</h3>
            <div className="min-h-[240px]">
              <Line data={profitTrendChart} />
            </div>
          </div>
        </div>
        <div className={cardClass}>
          <div className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Top produits rentables</h3>
            <div className="min-h-[240px]">
              <Bar data={topProductsChart} />
            </div>
          </div>
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className={cardClass}>
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Produits les plus rentables</h3>
          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 pr-4 text-left font-medium text-gray-500">Produit</th>
                  <th className="py-3 px-2 text-right font-medium text-gray-500">Qté</th>
                  <th className="py-3 px-2 text-right font-medium text-gray-500">CA</th>
                  <th className="py-3 px-2 text-right font-medium text-gray-500">Coût</th>
                  <th className="py-3 px-2 text-right font-medium text-gray-500">Bénéfice</th>
                  <th className="py-3 pl-2 text-right font-medium text-gray-500">Marge</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{product.productName}</td>
                    <td className="py-3 px-2 text-right tabular-nums">{product.totalQuantity}</td>
                    <td className="py-3 px-2 text-right tabular-nums">{product.totalRevenue?.toLocaleString('fr-FR')} CFA</td>
                    <td className="py-3 px-2 text-right tabular-nums">{product.totalCost?.toLocaleString('fr-FR')} CFA</td>
                    <td className="py-3 px-2 text-right tabular-nums font-semibold text-green-600">
                      {product.totalProfit?.toLocaleString('fr-FR')} CFA
                    </td>
                    <td className="py-3 pl-2 text-right tabular-nums">{product.profitMargin?.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitAnalysis;