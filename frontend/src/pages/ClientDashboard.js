import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import api from '../services/api';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const ClientDashboard = () => {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, clientsRes] = await Promise.all([
        api.get('/clients/stats'),
        api.get('/clients'),
      ]);
      setStats(statsRes.data);
      setClients(clientsRes.data.clients || []);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger le tableau de bord client');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

  // --- Derived analytics ---
  const enhancedMetrics = useMemo(() => {
    if (!clients.length) return {};

    const now = new Date();
    const inactiveClients = clients.filter((c) =>
      c.lastPurchaseDate ? (now - new Date(c.lastPurchaseDate)) / (1000 * 60 * 60 * 24) > 60 : true
    );

    const loyalClients = [...clients]
      .sort((a, b) => b.purchaseCount - a.purchaseCount)
      .slice(0, 5);

    const avgPurchaseFreq = (() => {
      const active = clients.filter((c) => c.purchaseCount > 1 && c.lastPurchaseDate);
      if (!active.length) return 0;
      const diffs = active.map(
        (c) =>
          (new Date(c.lastPurchaseDate) - new Date(c.createdAt)) /
          (c.purchaseCount - 1) /
          (1000 * 60 * 60 * 24)
      );
      return diffs.reduce((a, b) => a + b, 0) / diffs.length;
    })();

    const retentionRate = clients.length
      ? ((clients.length - inactiveClients.length) / clients.length) * 100
      : 0;

    // Monthly registrations trend
    const monthlySignups = Object.values(
      clients.reduce((acc, c) => {
        const month = new Date(c.createdAt).toLocaleString('fr-FR', { month: 'short', year: '2-digit' });
        if (!acc[month]) acc[month] = { month, count: 0 };
        acc[month].count++;
        return acc;
      }, {})
    );

    return { inactiveClients, loyalClients, avgPurchaseFreq, retentionRate, monthlySignups };
  }, [clients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement du tableau de bord client...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-red-600 font-semibold mb-4">{error}</p>
        <Link to="/clients" className="text-blue-600 hover:underline">← Retour à la liste des clients</Link>
      </div>
    );
  }

  const topClients = stats?.topClients || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-3xl text-white shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold">Tableau de Bord des Clients</h1>
            <p className="text-white/80 mt-1">Aperçu global de vos clients et de leurs comportements</p>
          </div>
          <Link
            to="/clients"
            className="px-5 py-2 bg-white text-blue-700 font-medium rounded-xl shadow hover:scale-105 transition-transform"
          >
            Voir la liste complète →
          </Link>
        </div>

        {/* Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Clients', value: stats.totalClients, icon: '👥' },
              { label: 'Achats Cumulés', value: formatCurrency(stats.totalSpent), icon: '💰' },
              { label: 'Dépense Moyenne', value: formatCurrency(stats.avgSpent), icon: '📊' },
              { label: 'Rétention Clients', value: `${enhancedMetrics.retentionRate.toFixed(1)}%`, icon: '🔁' },
              { label: 'Fréquence Moy. Achats', value: `${enhancedMetrics.avgPurchaseFreq.toFixed(1)} jrs`, icon: '⏱️' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-4 text-center shadow hover:shadow-lg transition-all"
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="text-sm text-gray-500">{item.label}</p>
                <h3 className="text-xl font-semibold text-gray-900 mt-1">{item.value}</h3>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          {topClients.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow border">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Clients (dépenses)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topClients}
                    dataKey="totalSpent"
                    nameKey="name"
                    outerRadius={100}
                    label
                  >
                    {topClients.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} CFA`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Line Chart - Monthly Signups */}
          <div className="bg-white p-6 rounded-3xl shadow border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouveaux Clients par Mois</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={enhancedMetrics.monthlySignups}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loyalty & Inactivity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Loyalty */}
          <div className="bg-white p-6 rounded-3xl shadow border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Clients Fidèles (nombre d’achats)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={enhancedMetrics.loyalClients}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="purchaseCount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Inactive */}
          <div className="bg-white p-6 rounded-3xl shadow border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Clients Inactifs (≥ 60 jours)</h2>
            {enhancedMetrics.inactiveClients.length > 0 ? (
              <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {enhancedMetrics.inactiveClients.map((c) => (
                  <li key={c._id} className="py-3 flex justify-between items-center">
                    <span className="text-gray-800 font-medium">{c.name}</span>
                    <span className="text-sm text-gray-500">
                      Dernier achat: {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-6">Aucun client inactif 🎉</p>
            )}
          </div>
        </div>

        {/* Top Clients Table */}
        <div className="bg-white p-6 rounded-3xl shadow border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🥇 Top Clients par Dépenses
          </h2>
          {topClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-y-2">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-700">
                    <th className="px-4 py-2 rounded-l-lg">#</th>
                    <th className="px-4 py-2">Nom</th>
                    <th className="px-4 py-2">Total Dépensé</th>
                    <th className="px-4 py-2 text-right rounded-r-lg">Profil</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((client, index) => (
                    <tr
                      key={client._id}
                      className="transition hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-semibold text-blue-600">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{client.name}</td>
                      <td className="px-4 py-3 text-gray-700 font-semibold">
                        {formatCurrency(client.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/clients/${client._id}`}
                          className="text-blue-600 hover:text-indigo-700 font-medium hover:underline"
                        >
                          Voir Profil →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Pas encore assez de données clients.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
