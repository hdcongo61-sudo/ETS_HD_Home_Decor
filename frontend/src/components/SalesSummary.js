import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SaleSummary = ({ sales = [], dateRange = {} }) => {
  // Calculer les totaux avec prise en compte des paiements échelonnés
  const calculateTotals = () => {
    let totalSales = 0;
    let totalPaid = 0;
    let totalTransactions = 0;
    let totalProductsSold = 0;
    let outstandingBalance = 0;

    sales.forEach(sale => {
      totalSales += sale.totalAmount || 0;
      totalTransactions += 1;
      totalProductsSold += sale.products?.length || 0;

      // Calculer le total payé pour cette vente
      const salePaid = sale.payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
      totalPaid += salePaid;

      // Ajouter au solde restant
      outstandingBalance += (sale.totalAmount || 0) - salePaid;
    });

    const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    return {
      totalSales,
      totalPaid,
      outstandingBalance,
      totalTransactions,
      totalProductsSold,
      averageSale
    };
  };

  const {
    totalSales,
    totalPaid,
    outstandingBalance,
    totalTransactions,
    totalProductsSold,
    averageSale
  } = calculateTotals();

  // Préparer les données pour le graphique (groupé par jour)
  const prepareChartData = () => {
    const dailyData = {};

    sales.forEach(sale => {
      const date = new Date(sale.createdAt).toLocaleDateString('fr-FR');

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          totalAmount: 0,
          totalPaid: 0
        };
      }

      dailyData[date].totalAmount += sale.totalAmount || 0;

      const salePaid = sale.payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
      dailyData[date].totalPaid += salePaid;
    });

    return Object.values(dailyData);
  };

  const chartData = prepareChartData();

  // Formateur de date
  const formatDate = (date) =>
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Formateur de montant pour le tooltip
  const formatCurrency = (value) => `${value.toLocaleString('fr-FR')} CFA`;

  if (sales.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Résumé des ventes</h2>
        <div className="text-center py-8 text-gray-500">
          Aucune donnée de vente disponible
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">
        Résumé des ventes {dateRange.startDate && dateRange.endDate &&
          `(du ${formatDate(dateRange.startDate)} au ${formatDate(dateRange.endDate)})`
        }
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-600">Chiffre d'affaires total</h3>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalSales)}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-600">Montant payé</h3>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalPaid)}
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-600">Solde restant</h3>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(outstandingBalance)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-purple-50 p-4 rounded-lg flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-600">Transactions</h3>
              <p className="text-2xl font-bold text-purple-600">
                {totalTransactions.toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-600">Produits vendus</h3>
              <p className="text-2xl font-bold text-red-600">
                {totalProductsSold.toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-600">Panier moyen</h3>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(averageSale)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-bold mb-4">Évolution des paiements</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis
                dataKey="date"
              />
              <YAxis
                tickFormatter={formatCurrency}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value), 'Montant']}
              />
              <Legend />
              <Bar
                dataKey="totalAmount"
                name="Montant total"
                fill="#4CAF50"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="totalPaid"
                name="Montant payé"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SaleSummary;