import React, { Suspense, lazy, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  BellRing,
  ChevronLeft,
  Clock3,
  Download,
  Lock,
  LogIn,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import AppLoader from '../components/AppLoader';

const UserManagement = lazy(() => import('../components/UserDashboard'));
const LoginSummary = lazy(() => import('../components/ResumeConnexions'));

const SALES_RANGE_OPTIONS = [
  { value: '7days', label: '7 jours' },
  { value: '30days', label: '30 jours' },
  { value: '90days', label: '90 jours' },
  { value: 'all', label: 'Tout' },
];

const TAB_OPTIONS = [
  { id: 'overview', label: 'Vue d’ensemble', icon: Sparkles },
  { id: 'sales', label: 'Équipe commerciale', icon: BarChart3 },
  { id: 'connections', label: 'Connexions', icon: LogIn },
  { id: 'users', label: 'Utilisateurs', icon: Users },
];

const formatCFA = (amount) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: 'code',
  })
    .format(Number(amount) || 0)
    .replace(/\s?XOF/g, ' CFA');

const formatPercent = (value) => `${(Number(value) || 0).toFixed(1)}%`;

const formatDate = (value, withTime = false) => {
  if (!value) return 'Non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponible';
  return withTime
    ? date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

const buildSalesSummary = (salesStats, totalUsers = 0) => {
  const normalized = (Array.isArray(salesStats) ? salesStats : []).map((entry) => {
    const totalAmount = Number(entry?.totalAmount) || 0;
    const totalProfit = Number(entry?.totalProfit) || 0;
    const totalPaid = Number(entry?.totalPaid) || 0;
    const balance = Number(entry?.balance) || 0;
    const salesCount = Number(entry?.salesCount) || 0;
    const averageSale = Number(entry?.averageSale) || 0;
    const collectionRate = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

    return {
      ...entry,
      totalAmount,
      totalProfit,
      totalPaid,
      balance,
      salesCount,
      averageSale,
      collectionRate,
    };
  });

  const totals = normalized.reduce(
    (acc, current) => {
      acc.revenue += current.totalAmount;
      acc.profit += current.totalProfit;
      acc.paid += current.totalPaid;
      acc.balance += current.balance;
      acc.sales += current.salesCount;
      return acc;
    },
    { revenue: 0, profit: 0, paid: 0, balance: 0, sales: 0 }
  );

  const rankedByRevenue = [...normalized].sort((a, b) => b.totalAmount - a.totalAmount);
  const rankedByCollection = [...normalized]
    .filter((entry) => entry.totalAmount > 0)
    .sort((a, b) => b.collectionRate - a.collectionRate || b.totalPaid - a.totalPaid);
  const rankedByTicket = [...normalized].sort((a, b) => b.averageSale - a.averageSale);
  const rankedByBalance = [...normalized].sort((a, b) => b.balance - a.balance);

  return {
    sellersCount: normalized.length,
    usersWithoutSales: Math.max(totalUsers - normalized.length, 0),
    totalRevenue: totals.revenue,
    totalProfit: totals.profit,
    totalPaid: totals.paid,
    totalBalance: totals.balance,
    totalSales: totals.sales,
    averageRevenuePerSeller: normalized.length ? totals.revenue / normalized.length : 0,
    collectionRate: totals.revenue ? (totals.paid / totals.revenue) * 100 : 0,
    topSeller: rankedByRevenue[0] || null,
    topCollector: rankedByCollection[0] || null,
    strongestTicket: rankedByTicket[0] || null,
    highestBalance: rankedByBalance[0] || null,
    ranking: rankedByRevenue,
    chartData: rankedByRevenue.slice(0, 6).map((entry) => ({
      name: entry.userName,
      revenue: entry.totalAmount,
      profit: entry.totalProfit,
    })),
  };
};

const DashboardAdmin = () => {
  const { auth } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [salesRange, setSalesRange] = useState('30days');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    admins: 0,
    standardUsers: 0,
    connectedNow: 0,
    dormantUsers: 0,
    lockedUsers: 0,
    accessControlledUsers: 0,
    newUsersThisWeek: 0,
    recentUsers: [],
    latestLoginUser: null,
  });
  const [salesStats, setSalesStats] = useState([]);
  const [usersCatalog, setUsersCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [usersCatalogLoading, setUsersCatalogLoading] = useState(false);
  const [error, setError] = useState('');
  const [salesError, setSalesError] = useState('');
  const [usersCatalogError, setUsersCatalogError] = useState('');
  const [goalDrafts, setGoalDrafts] = useState({});
  const [reportPreferences, setReportPreferences] = useState({
    weeklyReportEnabled: false,
    weeklyReportFormat: 'excel',
    inactivityAlertsEnabled: true,
    collectionAlertsEnabled: true,
    weeklyReportLastSentAt: null,
  });
  const [savingGoalId, setSavingGoalId] = useState('');
  const [savingReportPreferences, setSavingReportPreferences] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState('');
  const [adminMessage, setAdminMessage] = useState('');

  useEffect(() => {
    if (!auth?.isLoading && auth?.isAdmin) {
      loadOverview();
      loadUsersCatalog();
    }
  }, [auth?.isAdmin, auth?.isLoading]);

  useEffect(() => {
    if (!auth?.isLoading && auth?.isAdmin && (activeTab === 'overview' || activeTab === 'sales')) {
      loadSalesStats(salesRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range and visible tabs should trigger load
  }, [activeTab, auth?.isAdmin, auth?.isLoading, salesRange]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/users/stats');
      setStats({
        totalUsers: data?.totalUsers || 0,
        activeUsers: data?.activeUsers || 0,
        admins: data?.admins || 0,
        standardUsers: data?.standardUsers || 0,
        connectedNow: data?.connectedNow || 0,
        dormantUsers: data?.dormantUsers || 0,
        lockedUsers: data?.lockedUsers || 0,
        accessControlledUsers: data?.accessControlledUsers || 0,
        newUsersThisWeek: data?.newUsersThisWeek || 0,
        recentUsers: Array.isArray(data?.recentUsers) ? data.recentUsers : [],
        latestLoginUser: data?.latestLoginUser || null,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Échec du chargement du tableau de bord administrateur');
    } finally {
      setLoading(false);
    }
  };

  const loadSalesStats = async (range) => {
    try {
      setSalesLoading(true);
      setSalesError('');
      const { data } = await api.get(`/sales/user-stats?range=${encodeURIComponent(range)}`);
      setSalesStats(Array.isArray(data) ? data : []);
    } catch (err) {
      setSalesError(err.response?.data?.message || 'Échec du chargement des statistiques commerciales');
    } finally {
      setSalesLoading(false);
    }
  };

  const loadUsersCatalog = async () => {
    try {
      setUsersCatalogLoading(true);
      setUsersCatalogError('');
      const { data } = await api.get('/users');
      setUsersCatalog(Array.isArray(data) ? data : []);
    } catch (err) {
      setUsersCatalogError(err.response?.data?.message || 'Échec du chargement des objectifs et alertes.');
    } finally {
      setUsersCatalogLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'sales') {
      loadSalesStats(salesRange);
      loadUsersCatalog();
      return;
    }

    if (activeTab === 'overview') {
      loadOverview();
      loadSalesStats(salesRange);
      loadUsersCatalog();
    }
  };

  const salesSummary = useMemo(
    () => buildSalesSummary(salesStats, stats.totalUsers),
    [salesStats, stats.totalUsers]
  );

  const sellerUsers = useMemo(
    () => usersCatalog.filter((user) => !user.isAdmin),
    [usersCatalog]
  );

  const goalsProgress = useMemo(() => {
    const rankingByUserId = new Map(salesSummary.ranking.map((entry) => [entry.userId, entry]));

    return sellerUsers
      .map((user) => {
        const current = rankingByUserId.get(user._id) || null;
        const goals = goalDrafts[user._id] || {
          monthlyRevenueTarget: user.salesGoals?.monthlyRevenueTarget || 0,
          monthlyProfitTarget: user.salesGoals?.monthlyProfitTarget || 0,
          monthlyCollectionTarget: user.salesGoals?.monthlyCollectionTarget || 0,
        };

        const revenueProgress =
          goals.monthlyRevenueTarget > 0 && current
            ? (current.totalAmount / goals.monthlyRevenueTarget) * 100
            : 0;
        const profitProgress =
          goals.monthlyProfitTarget > 0 && current
            ? (current.totalProfit / goals.monthlyProfitTarget) * 100
            : 0;
        const collectionGap =
          goals.monthlyCollectionTarget > 0 && current
            ? goals.monthlyCollectionTarget - current.totalPaid
            : 0;

        return {
          user,
          current,
          goals,
          revenueProgress,
          profitProgress,
          collectionGap,
        };
      })
      .sort((left, right) => {
        const leftValue = left.current?.totalAmount || 0;
        const rightValue = right.current?.totalAmount || 0;
        return rightValue - leftValue;
      });
  }, [goalDrafts, salesSummary.ranking, sellerUsers]);

  const alertItems = useMemo(() => {
    const now = Date.now();
    const threshold30d = now - 30 * 24 * 60 * 60 * 1000;

    return usersCatalog
      .flatMap((user) => {
        const alerts = [];
        const lastLoginMs = user.lastLogin ? new Date(user.lastLogin).getTime() : null;
        const createdAtMs = user.createdAt ? new Date(user.createdAt).getTime() : null;
        const accessEndMs = user.accessEnd ? new Date(user.accessEnd).getTime() : null;
        const lockUntilMs = user.lockUntil ? new Date(user.lockUntil).getTime() : null;

        if (
          reportPreferences.inactivityAlertsEnabled &&
          ((lastLoginMs && lastLoginMs < threshold30d) || (!lastLoginMs && createdAtMs && createdAtMs < threshold30d))
        ) {
          alerts.push({
            id: `${user._id}-dormant`,
            tone: 'amber',
            title: 'Utilisateur dormant',
            name: user.name,
            helper: lastLoginMs
              ? `Dernière connexion ${formatDate(user.lastLogin, true)}`
              : 'Aucune connexion enregistrée depuis plus de 30 jours',
            action: 'Prévoir une relance ou une vérification d’accès.',
          });
        }

        if (lockUntilMs && lockUntilMs > now) {
          alerts.push({
            id: `${user._id}-locked`,
            tone: 'rose',
            title: 'Compte verrouillé',
            name: user.name,
            helper: `Déverrouillage prévu ${formatDate(user.lockUntil, true)}`,
            action: 'Vérifier les tentatives de connexion ou réinitialiser l’accès.',
          });
        }

        if (user.accessControlEnabled && accessEndMs && accessEndMs < now) {
          alerts.push({
            id: `${user._id}-access-end`,
            tone: 'sky',
            title: 'Fenêtre d’accès expirée',
            name: user.name,
            helper: `Fin d’accès le ${formatDate(user.accessEnd, true)}`,
            action: 'Décider si la fenêtre doit être prolongée.',
          });
        }

        return alerts;
      })
      .slice(0, 8);
  }, [reportPreferences.inactivityAlertsEnabled, usersCatalog]);

  const collectionFollowUps = useMemo(() => {
    if (!salesSummary.ranking.length) {
      return [];
    }

    return salesSummary.ranking
      .map((entry) => {
        let recommendation = 'Encaissement sain';
        let recommendationTone = 'bg-emerald-100 text-emerald-700';

        if (entry.balance >= 500000 || entry.collectionRate < 50) {
          recommendation = 'Relance prioritaire';
          recommendationTone = 'bg-rose-100 text-rose-700';
        } else if (entry.balance >= 150000 || entry.collectionRate < 75) {
          recommendation = 'Suivi cette semaine';
          recommendationTone = 'bg-amber-100 text-amber-700';
        } else if (entry.balance > 0 || entry.collectionRate < 90) {
          recommendation = 'Relance légère';
          recommendationTone = 'bg-sky-100 text-sky-700';
        }

        return {
          ...entry,
          recommendation,
          recommendationTone,
        };
      })
      .sort((left, right) => right.balance - left.balance || left.collectionRate - right.collectionRate)
      .slice(0, 12);
  }, [salesSummary.ranking]);

  const handleGoalDraftChange = (userId, field, value) => {
    setGoalDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: Math.max(0, Number(value) || 0),
      },
    }));
  };

  const saveSellerGoals = async (userId) => {
    const draft = goalDrafts[userId];
    if (!draft) {
      return;
    }

    try {
      setSavingGoalId(userId);
      const { data } = await api.put(`/users/${userId}`, {
        salesGoals: draft,
      });
      setUsersCatalog((current) => current.map((user) => (user._id === userId ? data : user)));
      setAdminMessage('Objectifs vendeur enregistrés.');
    } catch (err) {
      setAdminMessage(err.response?.data?.message || "Impossible d'enregistrer les objectifs.");
    } finally {
      setSavingGoalId('');
    }
  };

  const saveWeeklyPreferences = async () => {
    if (!auth?.user?._id) {
      return;
    }

    try {
      setSavingReportPreferences(true);
      const { data } = await api.put(`/users/${auth.user._id}`, {
        adminPreferences: reportPreferences,
      });
      setUsersCatalog((current) => current.map((user) => (user._id === data._id ? data : user)));
      setAdminMessage('Préférences du rapport hebdomadaire enregistrées.');
    } catch (err) {
      setAdminMessage(err.response?.data?.message || "Impossible d'enregistrer les préférences.");
    } finally {
      setSavingReportPreferences(false);
    }
  };

  const fetchWeeklySummary = async () => {
    const { data } = await api.get('/sales/user-stats?range=7days');
    return buildSalesSummary(Array.isArray(data) ? data : [], stats.totalUsers);
  };

  const exportWeeklyExcel = async () => {
    try {
      setReportActionLoading('excel');
      const response = await api.get('/exports/sales-export', {
        params: {
          period: 'weekly',
          status: 'all',
        },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport-admin-hebdo-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setAdminMessage(err.response?.data?.message || "Impossible de générer l'export Excel.");
    } finally {
      setReportActionLoading('');
    }
  };

  const exportWeeklyPdf = async () => {
    try {
      setReportActionLoading('pdf');
      const weeklySummary = await fetchWeeklySummary();
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default?.jsPDF || jsPDFModule.default;
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(18);
      doc.text('Rapport hebdomadaire administrateur', 40, 40);
      doc.setFontSize(11);
      doc.text(`Généré le ${formatDate(new Date(), true)}`, 40, 60);

      autoTable(doc, {
        startY: 80,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Vendeurs actifs', `${weeklySummary.sellersCount}`],
          ['Chiffre d’affaires', formatCFA(weeklySummary.totalRevenue)],
          ['Bénéfice', formatCFA(weeklySummary.totalProfit)],
          ['Encaissements', formatCFA(weeklySummary.totalPaid)],
          ['Reste à encaisser', formatCFA(weeklySummary.totalBalance)],
          ['Taux de recouvrement', formatPercent(weeklySummary.collectionRate)],
        ],
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Vendeur', 'CA', 'Bénéfice', 'Encaissement', 'Solde']],
        body: weeklySummary.ranking.slice(0, 8).map((entry) => [
          entry.userName,
          formatCFA(entry.totalAmount),
          formatCFA(entry.totalProfit),
          formatPercent(entry.collectionRate),
          formatCFA(entry.balance),
        ]),
      });

      doc.save(`rapport-admin-hebdo-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      setAdminMessage(err.response?.data?.message || "Impossible de générer l'export PDF.");
    } finally {
      setReportActionLoading('');
    }
  };

  const sendWeeklyReminder = async () => {
    try {
      setReportActionLoading('notify');
      const weeklySummary = await fetchWeeklySummary();
      await api.post('/notifications/admin-weekly-report', {
        rangeLabel: '7 derniers jours',
        totalRevenue: weeklySummary.totalRevenue,
        totalBalance: weeklySummary.totalBalance,
        sellersCount: weeklySummary.sellersCount,
      });
      setReportPreferences((current) => ({
        ...current,
        weeklyReportLastSentAt: new Date().toISOString(),
      }));
      setAdminMessage('Rappel hebdomadaire envoyé aux administrateurs abonnés.');
    } catch (err) {
      setAdminMessage(
        err.response?.data?.message || "Impossible d'envoyer le rappel hebdomadaire."
      );
    } finally {
      setReportActionLoading('');
    }
  };

  useEffect(() => {
    if (!usersCatalog.length) {
      return;
    }

    setGoalDrafts((current) => {
      const next = { ...current };
      usersCatalog
        .filter((user) => !user.isAdmin)
        .forEach((user) => {
          if (!next[user._id]) {
            next[user._id] = {
              monthlyRevenueTarget: user.salesGoals?.monthlyRevenueTarget || 0,
              monthlyProfitTarget: user.salesGoals?.monthlyProfitTarget || 0,
              monthlyCollectionTarget: user.salesGoals?.monthlyCollectionTarget || 0,
            };
          }
        });
      return next;
    });

    const currentAdmin = usersCatalog.find((user) => user._id === auth?.user?._id);
    if (currentAdmin) {
      setReportPreferences({
        weeklyReportEnabled: Boolean(currentAdmin.adminPreferences?.weeklyReportEnabled),
        weeklyReportFormat:
          currentAdmin.adminPreferences?.weeklyReportFormat === 'pdf' ? 'pdf' : 'excel',
        inactivityAlertsEnabled:
          typeof currentAdmin.adminPreferences?.inactivityAlertsEnabled === 'boolean'
            ? currentAdmin.adminPreferences.inactivityAlertsEnabled
            : true,
        collectionAlertsEnabled:
          typeof currentAdmin.adminPreferences?.collectionAlertsEnabled === 'boolean'
            ? currentAdmin.adminPreferences.collectionAlertsEnabled
            : true,
        weeklyReportLastSentAt: currentAdmin.adminPreferences?.weeklyReportLastSentAt || null,
      });
    }
  }, [auth?.user?._id, usersCatalog]);

  if (!auth?.isLoading && !auth?.isAdmin) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <Shield className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-900">Accès administrateur requis</h2>
          <p className="mt-2 text-sm text-slate-500">
            Cette page centralise les indicateurs de pilotage et n’est accessible qu’aux administrateurs.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" /> Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  if (loading && activeTab === 'overview') {
    return (
      <div className="flex min-h-full items-center justify-center py-16">
        <AppLoader fullScreen={false} text="Chargement du dashboard admin..." />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.10),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.3fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Accueil
                </Link>
                <span className="inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                  Admin cockpit
                </span>
              </div>

              <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Vue d’ensemble administrateur</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Page repensée pour charger vite, remonter d’abord les signaux utilisateurs, puis enrichir la lecture
                avec la performance commerciale de l’équipe sans bloquer l’ouverture.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <HeroMetric
                  title="Utilisateurs"
                  value={stats.totalUsers}
                  helper={`${stats.activeUsers} actifs sur 30 jours`}
                />
                <HeroMetric
                  title="Connectés maintenant"
                  value={stats.connectedNow}
                  helper={`${stats.lockedUsers} compte(s) verrouillé(s)`}
                />
                <HeroMetric
                  title="Nouveaux cette semaine"
                  value={stats.newUsersThisWeek}
                  helper={stats.latestLoginUser ? `Dernier login: ${stats.latestLoginUser.name}` : 'Aucun login récent'}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <PulseCard
                icon={Users}
                title="Taux d’activité"
                value={formatPercent(stats.totalUsers ? (stats.activeUsers / stats.totalUsers) * 100 : 0)}
                helper={`${stats.dormantUsers} utilisateur(s) dormants à relancer`}
                tone="teal"
              />
              <PulseCard
                icon={Wallet}
                title="Recouvrement équipe"
                value={salesLoading ? '...' : formatPercent(salesSummary.collectionRate)}
                helper={salesLoading ? 'Chargement commercial...' : `${formatCFA(salesSummary.totalBalance)} à encaisser`}
                tone="amber"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-[2rem] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {TAB_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === 'overview' || activeTab === 'sales') && (
              <select
                value={salesRange}
                onChange={(event) => setSalesRange(event.target.value)}
                className="min-h-[44px] rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
              >
                {SALES_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-[2rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}
        {adminMessage ? (
          <div className="rounded-[2rem] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
            {adminMessage}
          </div>
        ) : null}

        {activeTab === 'overview' && (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                icon={Users}
                title="Utilisateurs standards"
                value={stats.standardUsers}
                helper={`${stats.admins} administrateur(s)`}
                accent="text-sky-700"
              />
              <OverviewCard
                icon={LogIn}
                title="Connectés maintenant"
                value={stats.connectedNow}
                helper="Fenêtre glissante de 15 minutes"
                accent="text-emerald-700"
              />
              <OverviewCard
                icon={Clock3}
                title="Utilisateurs dormants"
                value={stats.dormantUsers}
                helper="Pas de connexion sur 30 jours"
                accent="text-amber-700"
              />
              <OverviewCard
                icon={Lock}
                title="Accès surveillés"
                value={stats.accessControlledUsers}
                helper={`${stats.lockedUsers} compte(s) actuellement verrouillé(s)`}
                accent="text-rose-700"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-xl font-semibold text-slate-900">Synthèse admin</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Signaux à surveiller pour piloter l’équipe et anticiper les actions administratives.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <SignalCard
                    title="Point d’attention principal"
                    value={stats.lockedUsers > 0 ? 'Comptes verrouillés' : 'Activité stable'}
                    helper={
                      stats.lockedUsers > 0
                        ? `${stats.lockedUsers} utilisateur(s) nécessitent une vérification d’accès.`
                        : 'Aucun verrouillage actif côté utilisateurs.'
                    }
                    tone="rose"
                  />
                  <SignalCard
                    title="Dernière connexion observée"
                    value={stats.latestLoginUser?.name || 'Aucune'}
                    helper={
                      stats.latestLoginUser
                        ? `${stats.latestLoginUser.email} • ${formatDate(stats.latestLoginUser.lastLogin, true)}`
                        : 'Aucune activité de connexion trouvée.'
                    }
                    tone="sky"
                  />
                  <SignalCard
                    title="Capacité commerciale couverte"
                    value={`${salesSummary.sellersCount} vendeur(s) actifs`}
                    helper={`${salesSummary.usersWithoutSales} utilisateur(s) sans vente sur la période`}
                    tone="emerald"
                  />
                  <SignalCard
                    title="Nouveaux comptes cette semaine"
                    value={stats.newUsersThisWeek}
                    helper={`${stats.recentUsers.length} compte(s) listés dans les arrivées récentes`}
                    tone="amber"
                  />
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-xl font-semibold text-slate-900">Pouls commercial</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chargement séparé pour garder l’ouverture de page rapide.
                </p>

                {salesError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {salesError}
                  </div>
                ) : salesLoading ? (
                  <div className="mt-6 flex justify-center py-12">
                    <AppLoader fullScreen={false} text="Chargement commercial..." />
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <SignalCard
                      title="Chiffre d’affaires équipe"
                      value={formatCFA(salesSummary.totalRevenue)}
                      helper={`${salesSummary.totalSales} transaction(s) sur ${SALES_RANGE_OPTIONS.find((item) => item.value === salesRange)?.label || salesRange}`}
                      tone="emerald"
                    />
                    <SignalCard
                      title="Bénéfice cumulé"
                      value={formatCFA(salesSummary.totalProfit)}
                      helper={`Panier moyen équipe ${formatCFA(salesSummary.totalSales ? salesSummary.totalRevenue / salesSummary.totalSales : 0)}`}
                      tone="sky"
                    />
                    <SignalCard
                      title="Meilleur vendeur"
                      value={salesSummary.topSeller?.userName || 'Aucun'}
                      helper={salesSummary.topSeller ? formatCFA(salesSummary.topSeller.totalAmount) : 'Aucune vente'}
                      tone="slate"
                    />
                    <SignalCard
                      title="Meilleur recouvrement"
                      value={salesSummary.topCollector?.userName || 'Aucun'}
                      helper={
                        salesSummary.topCollector
                          ? `${formatPercent(salesSummary.topCollector.collectionRate)} encaissé`
                          : 'Aucune donnée'
                      }
                      tone="amber"
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Top vendeurs</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Classement rapide pour savoir qui tire la performance actuelle.
                    </p>
                  </div>
                </div>

                {salesLoading ? (
                  <div className="mt-6 flex justify-center py-12">
                    <AppLoader fullScreen={false} text="Chargement..." />
                  </div>
                ) : salesSummary.chartData.length ? (
                  <div className="mt-4 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesSummary.chartData} layout="vertical" margin={{ top: 4, right: 20, left: 20, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tickFormatter={(value) => `${Math.round((Number(value) || 0) / 1000)}k`} />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                        <RechartsTooltip formatter={(value) => formatCFA(value)} />
                        <Bar dataKey="revenue" radius={[0, 12, 12, 0]} fill="#0f766e">
                          {salesSummary.chartData.map((entry, index) => (
                            <Cell key={`${entry.name}-${index}`} fill={index === 0 ? '#0f172a' : '#0f766e'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyPanel text="Aucune donnée commerciale sur cette période." />
                )}
              </div>

              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-xl font-semibold text-slate-900">Nouveaux utilisateurs</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Liste courte pour voir rapidement les comptes créés récemment.
                </p>

                <div className="mt-4 space-y-3">
                  {stats.recentUsers.length ? (
                    stats.recentUsers.map((user) => (
                      <div key={user._id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="truncate text-sm text-slate-500">{user.email}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Créé le {formatDate(user.createdAt)} • Dernier accès {formatDate(user.lastLogin, true)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${user.isAdmin ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {user.isAdmin ? 'Admin' : 'Utilisateur'}
                          </span>
                          {user.accessControlEnabled ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              Accès contrôlé
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyPanel text="Aucun utilisateur récent." />
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Objectifs par vendeur</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Définissez les objectifs mensuels de chiffre, marge et encaissement par utilisateur.
                    </p>
                  </div>
                </div>

                {usersCatalogError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {usersCatalogError}
                  </div>
                ) : usersCatalogLoading ? (
                  <div className="mt-6 flex justify-center py-10">
                    <AppLoader fullScreen={false} text="Chargement des objectifs..." />
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {goalsProgress.length ? (
                      goalsProgress.map(({ user, current, goals, revenueProgress, profitProgress, collectionGap }) => (
                        <div key={user._id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{user.name}</p>
                              <p className="text-sm text-slate-500">{current ? `${formatCFA(current.totalAmount)} réalisés` : 'Aucune vente sur la période'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => saveSellerGoals(user._id)}
                              disabled={savingGoalId === user._id}
                              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                              {savingGoalId === user._id ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <label className="space-y-2 text-sm text-slate-600">
                              <span>Objectif CA</span>
                              <input
                                type="number"
                                min="0"
                                value={goals.monthlyRevenueTarget}
                                onChange={(event) =>
                                  handleGoalDraftChange(user._id, 'monthlyRevenueTarget', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                              />
                              <span className="block text-xs text-slate-400">
                                Progression: {goals.monthlyRevenueTarget > 0 ? formatPercent(revenueProgress) : 'Non défini'}
                              </span>
                            </label>

                            <label className="space-y-2 text-sm text-slate-600">
                              <span>Objectif bénéfice</span>
                              <input
                                type="number"
                                min="0"
                                value={goals.monthlyProfitTarget}
                                onChange={(event) =>
                                  handleGoalDraftChange(user._id, 'monthlyProfitTarget', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                              />
                              <span className="block text-xs text-slate-400">
                                Progression: {goals.monthlyProfitTarget > 0 ? formatPercent(profitProgress) : 'Non défini'}
                              </span>
                            </label>

                            <label className="space-y-2 text-sm text-slate-600">
                              <span>Objectif encaissement</span>
                              <input
                                type="number"
                                min="0"
                                value={goals.monthlyCollectionTarget}
                                onChange={(event) =>
                                  handleGoalDraftChange(user._id, 'monthlyCollectionTarget', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                              />
                              <span className="block text-xs text-slate-400">
                                Écart: {goals.monthlyCollectionTarget > 0 ? formatCFA(collectionGap) : 'Non défini'}
                              </span>
                            </label>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyPanel text="Aucun vendeur disponible pour les objectifs." />
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Alertes d’inactivité</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Utilisateurs dormants, comptes verrouillés et accès expirés à traiter.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {alertItems.length ? (
                    alertItems.map((alert) => (
                      <SignalCard
                        key={alert.id}
                        title={`${alert.title} • ${alert.name}`}
                        value={alert.helper}
                        helper={alert.action}
                        tone={alert.tone}
                      />
                    ))
                  ) : (
                    <EmptyPanel text="Aucune alerte active pour le moment." />
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Suivi des encaissements</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Tous les utilisateurs actifs sur la période, avec score de recouvrement et niveau de suivi.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {collectionFollowUps.length ? (
                    collectionFollowUps.map((entry) => (
                      <div key={entry.userId} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{entry.userName}</p>
                            <p className="text-sm text-slate-500">
                              {formatPercent(entry.collectionRate)} de recouvrement • {formatCFA(entry.balance)} à encaisser
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium shadow-sm ${entry.recommendationTone}`}>
                            {entry.recommendation}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                          <MiniMetric label="CA" value={formatCFA(entry.totalAmount)} />
                          <MiniMetric label="Payé" value={formatCFA(entry.totalPaid)} />
                          <MiniMetric label="Panier moyen" value={formatCFA(entry.averageSale)} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyPanel text="Aucun utilisateur actif sur la période sélectionnée." />
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Rapport hebdomadaire auto</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Préférences enregistrées, export immédiat et rappel push aux administrateurs abonnés.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-600">
                    <span>Format par défaut</span>
                    <select
                      value={reportPreferences.weeklyReportFormat}
                      onChange={(event) =>
                        setReportPreferences((current) => ({
                          ...current,
                          weeklyReportFormat: event.target.value === 'pdf' ? 'pdf' : 'excel',
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
                    >
                      <option value="excel">Excel</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </label>

                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">Dernier rappel envoyé</p>
                    <p className="mt-1">{formatDate(reportPreferences.weeklyReportLastSentAt, true)}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span>Activer le rappel hebdomadaire</span>
                    <input
                      type="checkbox"
                      checked={reportPreferences.weeklyReportEnabled}
                      onChange={(event) =>
                        setReportPreferences((current) => ({
                          ...current,
                          weeklyReportEnabled: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span>Afficher les alertes d’inactivité</span>
                    <input
                      type="checkbox"
                      checked={reportPreferences.inactivityAlertsEnabled}
                      onChange={(event) =>
                        setReportPreferences((current) => ({
                          ...current,
                          inactivityAlertsEnabled: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span>Afficher les alertes d’encaissement</span>
                    <input
                      type="checkbox"
                      checked={reportPreferences.collectionAlertsEnabled}
                      onChange={(event) =>
                        setReportPreferences((current) => ({
                          ...current,
                          collectionAlertsEnabled: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveWeeklyPreferences}
                    disabled={savingReportPreferences}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingReportPreferences ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    onClick={exportWeeklyExcel}
                    disabled={reportActionLoading.length > 0}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {reportActionLoading === 'excel' ? 'Export...' : 'Excel hebdo'}
                  </button>
                  <button
                    type="button"
                    onClick={exportWeeklyPdf}
                    disabled={reportActionLoading.length > 0}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {reportActionLoading === 'pdf' ? 'Export...' : 'PDF hebdo'}
                  </button>
                  <button
                    type="button"
                    onClick={sendWeeklyReminder}
                    disabled={reportActionLoading.length > 0 || !reportPreferences.weeklyReportEnabled}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                  >
                    <BellRing className="h-4 w-4" />
                    {reportActionLoading === 'notify' ? 'Envoi...' : 'Envoyer le rappel'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'sales' && (
          <section className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                icon={TrendingUp}
                title="CA équipe"
                value={formatCFA(salesSummary.totalRevenue)}
                helper={`${salesSummary.sellersCount} vendeur(s) sur la période`}
                accent="text-emerald-700"
              />
              <OverviewCard
                icon={Wallet}
                title="À encaisser"
                value={formatCFA(salesSummary.totalBalance)}
                helper={formatPercent(salesSummary.collectionRate)}
                accent="text-amber-700"
              />
              <OverviewCard
                icon={BarChart3}
                title="Vente moyenne"
                value={formatCFA(salesSummary.totalSales ? salesSummary.totalRevenue / salesSummary.totalSales : 0)}
                helper={`${salesSummary.totalSales} transaction(s)`}
                accent="text-sky-700"
              />
              <OverviewCard
                icon={Users}
                title="Utilisateurs sans vente"
                value={salesSummary.usersWithoutSales}
                helper="À accompagner ou réactiver"
                accent="text-rose-700"
              />
            </div>

            {salesError ? (
              <div className="rounded-[2rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{salesError}</div>
            ) : salesLoading ? (
              <div className="flex justify-center py-16">
                <AppLoader fullScreen={false} text="Chargement commercial..." />
              </div>
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                    <h2 className="text-xl font-semibold text-slate-900">Classement vendeurs</h2>
                    <div className="mt-4 h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesSummary.chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={(value) => `${Math.round((Number(value) || 0) / 1000)}k`} />
                          <RechartsTooltip formatter={(value) => formatCFA(value)} />
                          <Bar dataKey="revenue" fill="#0f766e" radius={[10, 10, 0, 0]} name="Chiffre d'affaires" />
                          <Bar dataKey="profit" fill="#0f172a" radius={[10, 10, 0, 0]} name="Bénéfice" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <SignalCard
                      title="Top vendeur"
                      value={salesSummary.topSeller?.userName || 'Aucun'}
                      helper={salesSummary.topSeller ? formatCFA(salesSummary.topSeller.totalAmount) : 'Aucune donnée'}
                      tone="emerald"
                    />
                    <SignalCard
                      title="Meilleur panier moyen"
                      value={salesSummary.strongestTicket?.userName || 'Aucun'}
                      helper={
                        salesSummary.strongestTicket
                          ? formatCFA(salesSummary.strongestTicket.averageSale)
                          : 'Aucune donnée'
                      }
                      tone="sky"
                    />
                    <SignalCard
                      title="Solde ouvert le plus haut"
                      value={salesSummary.highestBalance?.userName || 'Aucun'}
                      helper={
                        salesSummary.highestBalance
                          ? formatCFA(salesSummary.highestBalance.balance)
                          : 'Aucune donnée'
                      }
                      tone="rose"
                    />
                  </div>
                </div>

                <div className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
                  <h2 className="text-xl font-semibold text-slate-900">Détail équipe</h2>
                  <div className="mt-4 space-y-3 lg:hidden">
                    {salesSummary.ranking.map((entry) => (
                      <Link
                        key={entry.userId}
                        to={`/sales/user/${entry.userId}`}
                        className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{entry.userName}</p>
                            <p className="text-sm text-slate-500">{entry.userEmail}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            {entry.salesCount} vente(s)
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <MiniMetric label="CA" value={formatCFA(entry.totalAmount)} />
                          <MiniMetric label="Bénéfice" value={formatCFA(entry.totalProfit)} />
                          <MiniMetric label="Encaissement" value={formatPercent(entry.collectionRate)} />
                          <MiniMetric label="Solde" value={formatCFA(entry.balance)} />
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-4 hidden overflow-x-auto lg:block">
                    <table className="min-w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vendeur</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Ventes</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">CA</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bénéfice</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Encaissement</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Solde</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Panier moyen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {salesSummary.ranking.map((entry) => (
                          <tr key={entry.userId} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <Link to={`/sales/user/${entry.userId}`} className="font-medium text-slate-900 hover:text-sky-700">
                                {entry.userName}
                              </Link>
                              <p className="text-sm text-slate-500">{entry.userEmail}</p>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">{entry.salesCount}</td>
                            <td className="px-4 py-4 text-sm font-medium text-slate-900">{formatCFA(entry.totalAmount)}</td>
                            <td className="px-4 py-4 text-sm text-emerald-700">{formatCFA(entry.totalProfit)}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{formatPercent(entry.collectionRate)}</td>
                            <td className="px-4 py-4 text-sm text-amber-700">{formatCFA(entry.balance)}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{formatCFA(entry.averageSale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'connections' && (
          <Suspense fallback={<div className="flex justify-center py-16"><AppLoader fullScreen={false} text="Chargement des connexions..." /></div>}>
            <LoginSummary />
          </Suspense>
        )}

        {activeTab === 'users' && (
          <Suspense fallback={<div className="flex justify-center py-16"><AppLoader fullScreen={false} text="Chargement des utilisateurs..." /></div>}>
            <UserManagement />
          </Suspense>
        )}
      </div>
    </div>
  );
};

const HeroMetric = ({ title, value, helper }) => (
  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
    <p className="text-sm text-slate-300">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    <p className="mt-1 text-sm text-slate-300">{helper}</p>
  </div>
);

const PulseCard = ({ icon: Icon, title, value, helper, tone = 'teal' }) => {
  const toneClass = {
    teal: 'from-teal-500/30 to-emerald-500/10',
    amber: 'from-amber-400/30 to-orange-500/10',
  }[tone];

  return (
    <div className={`rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${toneClass} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-300">{helper}</p>
    </div>
  );
};

const OverviewCard = ({ icon: Icon, title, value, helper, accent }) => (
  <article className="rounded-[1.75rem] bg-white p-4 shadow-sm">
    <div className="flex items-start gap-4">
      <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
        <p className="mt-1 text-sm text-slate-500">{helper}</p>
      </div>
    </div>
  </article>
);

const SignalCard = ({ title, value, helper, tone = 'slate' }) => {
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-900',
    emerald: 'bg-emerald-50 text-emerald-900',
    amber: 'bg-amber-50 text-amber-900',
    rose: 'bg-rose-50 text-rose-900',
    sky: 'bg-sky-50 text-sky-900',
  }[tone];

  return (
    <div className={`rounded-[1.5rem] p-4 ${toneClasses}`}>
      <p className="text-sm opacity-75">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-sm opacity-80">{helper}</p>
    </div>
  );
};

const MiniMetric = ({ label, value }) => (
  <div className="rounded-2xl bg-white p-3">
    <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
  </div>
);

const EmptyPanel = ({ text }) => (
  <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
    {text}
  </div>
);

export default DashboardAdmin;
