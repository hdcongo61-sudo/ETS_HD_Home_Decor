import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { customersApi } from '../features/customers/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { clientPath } from '../utils/paths';
import AppLoader from '../components/AppLoader';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock3,
  ShoppingBag,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Button,
  ChartCard,
  DataTable,
  EmptyState,
  KPICard,
  PageHeader,
  StatusBadge,
  Workspace,
} from '../components/business';
import { SERIE_PROFIT, SERIE_REVENUE } from '../utils/chartColors';

const RECENCY_LABELS = {
  '0-30': '0–30 j',
  '31-60': '31–60 j',
  '61-90': '61–90 j',
  '90+': '90 j +',
  never: 'Jamais acheté',
};

const RECENCY_COLORS = {
  '0-30': '#16A34A',
  '31-60': '#2563EB',
  '61-90': '#F59E0B',
  '90+': '#EF4444',
  never: '#9CA3AF',
};

const INACTIVITY_DAYS = 60;

const monthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

const ClientDashboard = () => {
  const navigate = useNavigate();
  const tableRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    try {
      if (!silent) setLoading(true);
      const res = await customersApi.stats();
      setStats(res.data);
      setError('');
    } catch (err) {
      console.error(err);
      if (!silent) {
        setError('Impossible de charger le tableau de bord clients');
        toast.error('Impossible de charger le tableau de bord clients');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refresh when a sale is created from the global modal (affects client stats).
  useEffect(() => {
    const refresh = () => fetchDashboardData({ silent: true });
    window.addEventListener('saleCreated', refresh);
    return () => window.removeEventListener('saleCreated', refresh);
  }, [fetchDashboardData]);

  const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} CFA`;
  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

  // --- Données dérivées pour les graphiques ---
  const monthlySignups = useMemo(
    () => (stats?.monthlySignups || []).map((m) => ({ ...m, label: monthLabel(m.year, m.month) })),
    [stats]
  );
  const recencyBuckets = useMemo(
    () =>
      (stats?.recencyBuckets || []).map((b) => ({
        ...b,
        label: RECENCY_LABELS[b.key] || b.key,
      })),
    [stats]
  );
  const topClients = stats?.topClients || [];
  const topLoyalClients = stats?.topLoyalClients || [];
  const atRiskClients = stats?.atRiskClients || [];

  useResponsiveTable(tableRef, [topClients]);

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

  if (!stats) return null;

  return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Clients"
        description="Santé de votre base : acquisition, fidélité et clients à relancer."
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/clients')}>
            Voir tous les clients <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      {stats.totalClients === 0 ? (
        <EmptyState
          title="Aucun client pour le moment"
          description="Ajoutez vos premiers clients pour suivre leurs achats, leur fidélité et vos revenus."
          action={
            <Button onClick={() => navigate('/clients')}>
              Ajouter des clients <ArrowRight className="h-4 w-4" />
            </Button>
          }
        />
      ) : (
        <>
          {/* KPI Cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <KPICard title="Total clients" value={stats.totalClients} context={`+${stats.newThisMonth} ce mois-ci`} icon={<Users className="h-4 w-4" />} />
            <KPICard title="Clients actifs" value={stats.activeClients} context={`${stats.retentionRate} % de rétention (${INACTIVITY_DAYS} j)`} tone="success" icon={<UserCheck className="h-4 w-4" />} />
            <KPICard title="Achats cumulés" value={formatCurrency(stats.totalSpent)} icon={<Wallet className="h-4 w-4" />} />
            <KPICard title="Panier moyen" value={formatCurrency(stats.avgSpent)} context="Par client acheteur" icon={<ShoppingBag className="h-4 w-4" />} />
            <KPICard title="Clients à risque" value={stats.atRiskCount} context={`Sans achat depuis ${INACTIVITY_DAYS} j`} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
            <KPICard title="Fréquence d'achat" value={stats.avgPurchaseFreq > 0 ? `${stats.avgPurchaseFreq.toFixed(0)} j` : '—'} context="Entre deux achats" icon={<Clock3 className="h-4 w-4" />} />
          </section>

          {/* Acquisition & récence */}
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard
              title="Nouveaux clients"
              description="Acquisitions sur les 12 derniers mois"
              className="xl:col-span-2"
            >
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySignups} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SERIE_REVENUE} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={SERIE_REVENUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`${v} clients`, 'Inscriptions']} />
                    <Area type="monotone" dataKey="count" stroke={SERIE_REVENUE} strokeWidth={2} fill="url(#signupsFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Récence du dernier achat" description="Répartition de la base clients">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recencyBuckets} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`${v} clients`, 'Clients']} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {recencyBuckets.map((entry) => (
                        <Cell key={entry.key} fill={RECENCY_COLORS[entry.key] || '#9CA3AF'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* Fidélité & risque */}
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Top clients fidèles" description="Classement par nombre d'achats">
              {topLoyalClients.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topLoyalClients} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [`${v} achats`, 'Achats']} />
                      <Bar dataKey="totalSales" fill={SERIE_PROFIT} radius={[0, 6, 6, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Pas encore d'achats" description="Les achats liés à des clients apparaîtront ici." />
              )}
            </ChartCard>

            <ChartCard
              title="Clients à risque"
              description={`${INACTIVITY_DAYS} jours ou plus sans achat — à relancer`}
            >
              {atRiskClients.length > 0 ? (
                <ul className="max-h-72 divide-y divide-[var(--ms-border)] overflow-y-auto">
                  {atRiskClients.map((client) => (
                    <li key={client.id}>
                      <Link
                        to={clientPath({ _id: client.id, slug: client.slug })}
                        className="flex min-h-[48px] items-center gap-3 px-2 py-2.5 transition hover:bg-[var(--ms-bg)]"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-[var(--ms-text)]">{client.name}</span>
                        <StatusBadge tone={client.neverPurchased ? 'neutral' : 'warning'}>
                          {client.neverPurchased ? 'Jamais acheté' : `Il y a ${client.daysSince} j`}
                        </StatusBadge>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ms-text-muted)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Aucun client à risque" description="Tous vos clients ont acheté récemment." />
              )}
            </ChartCard>
          </div>

          {/* Classement par dépenses */}
          <ChartCard title="Top clients par dépenses" description="Les clients qui génèrent le plus de chiffre d'affaires">
            {topClients.length > 0 ? (
              <DataTable>
                <table ref={tableRef} className="responsive-table w-full">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Client</th>
                      <th>Achats</th>
                      <th>Total dépensé</th>
                      <th>Panier moyen</th>
                      <th>Dernier achat</th>
                      <th className="text-right">Profil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClients.map((client, index) => {
                      const href = clientPath({ _id: client.clientId, slug: client.slug });
                      const avgBasket = client.totalSales > 0 ? client.totalSpent / client.totalSales : 0;
                      return (
                        <tr key={client.clientId || index} className="cursor-pointer" onClick={() => navigate(href)}>
                          <td className="font-semibold text-[var(--ms-text-muted)]">{index + 1}</td>
                          <td className="font-medium text-[var(--ms-text)]">{client.name}</td>
                          <td>{client.totalSales}</td>
                          <td className="font-semibold text-[var(--ms-text)]">{formatCurrency(client.totalSpent)}</td>
                          <td>{formatCurrency(avgBasket)}</td>
                          <td>{formatDate(client.lastSaleDate)}</td>
                          <td className="text-right">
                            <Link to={href} className="ms-button ms-button-secondary ms-button-sm" onClick={(e) => e.stopPropagation()}>
                              <ArrowRight className="h-4 w-4" /> Profil
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTable>
            ) : (
              <EmptyState
                title="Pas encore de ventes clients"
                description="Créez une vente en associant un client pour voir apparaître le classement."
              />
            )}
          </ChartCard>
        </>
      )}
    </Workspace>
  );
};

export default ClientDashboard;
