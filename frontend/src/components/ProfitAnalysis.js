import React, { useState, useEffect } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import api from '../services/api';

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
    return <div className="flex justify-center p-8">Chargement...</div>;
  }

  if (!profitData) {
    return <div className="text-red-500 p-4">Erreur de chargement des données</div>;
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

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Période</label>
            <select 
              value={filters.period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Date début</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Date fin</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ period: 'month', startDate: '', endDate: '' })}
              className="w-full p-2 bg-gray-100 hover:bg-gray-200 rounded"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques générales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-green-600">
            {generalStats.totalProfit?.toLocaleString('fr-FR')} CFA
          </h3>
          <p className="text-sm text-gray-600">Bénéfice total</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-blue-600">
            {generalStats.averageMargin?.toFixed(2)}%
          </h3>
          <p className="text-sm text-gray-600">Marge moyenne</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-purple-600">
            {generalStats.averageProfitPerSale?.toLocaleString('fr-FR')} CFA
          </h3>
          <p className="text-sm text-gray-600">Bénéfice moyen/vente</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-orange-600">
            {generalStats.totalSales}
          </h3>
          <p className="text-sm text-gray-600">Ventes analysées</p>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Évolution des bénéfices</h3>
          <Line data={profitTrendChart} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top produits rentables</h3>
          <Bar data={topProductsChart} />
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Produits les plus rentables</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left">Produit</th>
                <th className="p-3 text-right">Quantité</th>
                <th className="p-3 text-right">Chiffre d'affaires</th>
                <th className="p-3 text-right">Coût</th>
                <th className="p-3 text-right">Bénéfice</th>
                <th className="p-3 text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, index) => (
                <tr key={index} className="border-b">
                  <td className="p-3">{product.productName}</td>
                  <td className="p-3 text-right">{product.totalQuantity}</td>
                  <td className="p-3 text-right">{product.totalRevenue?.toLocaleString('fr-FR')} CFA</td>
                  <td className="p-3 text-right">{product.totalCost?.toLocaleString('fr-FR')} CFA</td>
                  <td className="p-3 text-right font-semibold text-green-600">
                    {product.totalProfit?.toLocaleString('fr-FR')} CFA
                  </td>
                  <td className="p-3 text-right">{product.profitMargin?.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProfitAnalysis;