import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import api from '../services/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { clientPath } from '../utils/paths';
import AppLoader from '../components/AppLoader';
import {
  ArrowRight,
  Clock3,
  Repeat2,
  ShoppingBag,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const ClientDashboard = () => {
  const tableRef = useRef(null);
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

  useResponsiveTable(tableRef, [stats?.topClients]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f7f9]">
        <AppLoader fullScreen={false} text="Chargement du tableau de bord client…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="mb-4 font-semibold text-rose-700">{error}</p>
        <Link to="/clients" className="text-slate-700 hover:text-slate-950">Retour à la liste des clients</Link>
      </div>
    );
  }

  const topClients = stats?.topClients || [];

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Clients</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Tableau de bord clients</h1>
            <p className="mt-1 text-sm text-slate-600">Aperçu global des clients et de leurs comportements.</p>
          </div>
          <Link
            to="/clients"
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Liste complète
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Clients', value: stats.totalClients, icon: '👥' },
              { label: 'Achats Cumulés', value: formatCurrency(stats.totalSpent), icon: Wallet },
              { label: 'Dépense Moyenne', value: formatCurrency(stats.avgSpent), icon: ShoppingBag },
              { label: 'Rétention Clients', value: `${enhancedMetrics.retentionRate.toFixed(1)}%`, icon: Repeat2 },
              { label: 'Fréquence Moy. Achats', value: `${enhancedMetrics.avgPurchaseFreq.toFixed(1)} jrs`, icon: Clock3 },
            ].map((item, idx) => {
              const Icon = typeof item.icon === 'string' ? Users : item.icon;
              return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-500">{item.label}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">{item.value}</h3>
              </div>
              );
            })}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          {topClients.length > 0 && (
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-950">Top 5 Clients (dépenses)</h2>
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
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-950">Nouveaux Clients par Mois</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={enhancedMetrics.monthlySignups}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0f172a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loyalty & Inactivity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Loyalty */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-950">Top Clients Fidèles (nombre d’achats)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={enhancedMetrics.loyalClients}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="purchaseCount" fill="#047857" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Inactive */}
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-950">Clients Inactifs (≥ 60 jours)</h2>
            {enhancedMetrics.inactiveClients.length > 0 ? (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {enhancedMetrics.inactiveClients.map((c) => (
                  <li key={c._id} className="flex items-center justify-between py-3">
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span className="text-sm text-slate-500">
                      Dernier achat: {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-slate-500">Aucun client inactif</p>
            )}
          </div>
        </div>

        {/* Top Clients Table */}
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Trophy className="h-5 w-5 text-amber-600" />
            Top Clients par Dépenses
          </h2>
          {topClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table ref={tableRef} className="responsive-table w-full text-sm border-separate border-spacing-y-2 min-w-[640px]">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-700">
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
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-600">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-950">{client.name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatCurrency(client.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={clientPath(client)}
                          className="inline-flex items-center justify-end gap-1 font-medium text-slate-700 hover:text-slate-950"
                        >
                          Voir profil <ArrowRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-slate-500">Pas encore assez de données clients.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
