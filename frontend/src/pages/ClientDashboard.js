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
import {
  Button,
  ChartCard,
  DataTable,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  Workspace,
} from '../components/business';

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

  // Refresh when a sale is created from the global modal (affects client stats).
  useEffect(() => {
    window.addEventListener('saleCreated', fetchDashboardData);
    return () => window.removeEventListener('saleCreated', fetchDashboardData);
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
      <Workspace className="flex justify-center items-center" style={{ minHeight: '60vh' }}>
        <AppLoader fullScreen={false} text="Chargement..." />
      </Workspace>
    );
  }

  if (error) {
    return (
      <Workspace>
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
          {error}
        </div>
      </Workspace>
    );
  }

  const topClients = stats?.topClients || [];

  return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Tableau de bord clients"
        description="Apercu global des clients et de leurs comportements."
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.location.href = '/clients'}>
            Liste complete <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KPICard title="Total Clients" value={stats.totalClients} tone="neutral" icon={<Users className="h-4 w-4" />} />
          <KPICard title="Achats Cumules" value={formatCurrency(stats.totalSpent)} tone="success" icon={<Wallet className="h-4 w-4" />} />
          <KPICard title="Depense Moyenne" value={formatCurrency(stats.avgSpent)} tone="neutral" icon={<ShoppingBag className="h-4 w-4" />} />
          <KPICard title="Retention" value={`${enhancedMetrics.retentionRate.toFixed(1)}%`} tone="neutral" icon={<Repeat2 className="h-4 w-4" />} />
          <KPICard title="Freq. Achats" value={`${enhancedMetrics.avgPurchaseFreq.toFixed(1)} jrs`} tone="neutral" icon={<Clock3 className="h-4 w-4" />} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {topClients.length > 0 && (
          <ChartCard title="Top 5 Clients (depenses)">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={topClients} dataKey="totalSpent" nameKey="name" outerRadius={100} label>
                  {topClients.map((entry, index) => (<Cell key={index} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} CFA`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <ChartCard title="Nouveaux Clients par Mois">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={enhancedMetrics.monthlySignups}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0078D4" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

        {/* Loyalty & Inactivity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChartCard title="Top Clients Fideles (achats)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={enhancedMetrics.loyalClients}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip />
              <Bar dataKey="purchaseCount" fill="#107C10" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Clients Inactifs (>= 60 jours)">
          {enhancedMetrics.inactiveClients.length > 0 ? (
            <ul className="max-h-72 divide-y divide-[var(--ms-border)] overflow-y-auto">
              {enhancedMetrics.inactiveClients.map((c) => (
                <li key={c._id} className="flex items-center justify-between py-3 px-2">
                  <span className="font-medium text-[var(--ms-text)]">{c.name}</span>
                  <span className="text-sm text-[var(--ms-text-muted)]">Dernier achat: {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('fr-FR') : '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[var(--ms-text-muted)]">Aucun client inactif</p>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Top Clients par Depenses">
        {topClients.length > 0 ? (
          <DataTable>
            <table ref={tableRef} className="responsive-table w-full">
              <thead><tr><th>#</th><th>Nom</th><th>Total Depense</th><th className="text-right">Profil</th></tr></thead>
              <tbody>
                {topClients.map((client, index) => (
                  <tr key={client._id} className="cursor-pointer" onClick={() => window.location.href = clientPath(client)}>
                    <td className="font-semibold text-[var(--ms-text-muted)]">{index + 1}</td>
                    <td className="font-medium text-[var(--ms-text)]">{client.name}</td>
                    <td className="font-semibold text-[var(--ms-text)]">{formatCurrency(client.totalSpent)}</td>
                    <td className="text-right"><Link to={clientPath(client)} className="ms-button ms-button-secondary ms-button-sm"><ArrowRight className="h-4 w-4" /> Profil</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : (
          <EmptyState title="Pas assez de donnees clients." />
        )}
      </ChartCard>
    </Workspace>
  );
};

export default ClientDashboard;
