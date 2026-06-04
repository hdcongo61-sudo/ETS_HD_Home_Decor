import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Clock3,
  Crown,
  Home,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import ErrorModal from './ErrorModal';
import AppLoader from './AppLoader';
import { PageHeader, Workspace, KPICard, Button, Surface, StatusBadge } from './business';
import api from '../services/api';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminStats, setAdminStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [salesStats, setSalesStats] = useState(null);
  const [salesError, setSalesError] = useState('');
  const [salesRange, setSalesRange] = useState('30days');
  const navigate = useNavigate();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/connexion');
        return;
      }
      const { data } = await api.get('/users/profile');
      const profile = data?.user || data;
      setUser(profile);
      if (profile?.isAdmin) {
        fetchAdminStats();
        fetchSalesStats(profile._id, salesRange);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || 'Échec du chargement du profil';
      setError(message);
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        navigate('/connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); /* eslint-disable-next-line */ }, [navigate]);

  const handleRetry = () => { setError(''); fetchProfile(); };

  const fetchAdminStats = async () => {
    try {
      const { data } = await api.get('/users/stats');
      setAdminStats(data);
      setStatsError('');
    } catch (err) {
      setStatsError(err.response?.data?.message || 'Impossible de charger les statistiques administrateur');
    }
  };

  const fetchSalesStats = async (userId, range = '30days') => {
    try {
      const { data } = await api.get(`/sales/user-stats?range=${encodeURIComponent(range)}`);
      const currentUserStats = Array.isArray(data)
        ? data.find((entry) => entry.userId === userId) || null
        : null;
      setSalesStats(currentUserStats);
      setSalesError('');
    } catch (err) {
      setSalesError(err.response?.data?.message || 'Impossible de charger les statistiques de ventes');
    }
  };

  useEffect(() => {
    if (user?.isAdmin) fetchSalesStats(user._id, salesRange);
  }, [user?._id, user?.isAdmin, salesRange]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <AppLoader fullScreen={false} text="Chargement du profil..." />
      </div>
    );
  }

  if (error) {
    return <ErrorModal message={error} onRetry={handleRetry} onClose={() => setError('')} />;
  }

  const membershipDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })
    : '—';
  const accountCreatedAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Non disponible';
  const lastLoginDisplay = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Non disponible';
  const formatMoney = (value) => `${new Intl.NumberFormat('fr-FR').format(Math.round(value || 0))} CFA`;
  const userInitials = (user?.name || user?.email || 'U')
    .split(' ').filter(Boolean).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join('');
  const accountType = user?.isAdmin ? 'Administrateur' : 'Utilisateur standard';
  const salesRangeOptions = [
    { value: 'today', label: "Aujourd'hui" },
    { value: '7days', label: '7 jours' },
    { value: '30days', label: '30 jours' },
    { value: '90days', label: '90 jours' },
    { value: 'all', label: 'Tout' },
  ];

  return (
    <Workspace>
      <PageHeader
        eyebrow="Profil"
        title={user?.name || 'Utilisateur'}
        description={user?.email || ''}
        meta={user?.isAdmin ? 'Admin' : null}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate(-1)} variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <Button onClick={handleRetry} variant="secondary" size="sm">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
        }
      />

      {/* Profile card */}
      <Surface>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-2xl font-semibold text-[var(--ms-text-muted)]">
                {user?.photo ? (
                  <img src={user.photo} alt={user.name || 'Profil'} className="h-full w-full object-cover" />
                ) : (
                  userInitials || <UserRound className="h-8 w-8" />
                )}
              </div>
              {user?.isAdmin && (
                <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 rounded-full bg-[var(--ms-blue)] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                  <Crown className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={user?.isAdmin ? 'info' : 'neutral'}>
                  {accountType}
                </StatusBadge>
                <StatusBadge tone="success">Actif</StatusBadge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[var(--ms-text)]">
                {user?.email && (
                  <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 hover:text-[var(--ms-blue)] transition-colors">
                    <Mail className="h-3.5 w-3.5 text-[var(--ms-text-muted)]" />
                    <span className="break-all">{user.email}</span>
                  </a>
                )}
                {user?.phone && (
                  <a href={`tel:${String(user.phone).replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-[var(--ms-blue)] transition-colors">
                    <Phone className="h-3.5 w-3.5 text-[var(--ms-text-muted)]" />
                    {user.phone}
                  </a>
                )}
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[var(--ms-text-muted)]">
                <CalendarDays className="h-3.5 w-3.5" />
                Membre depuis {membershipDate} &middot; Dernière connexion {lastLoginDisplay}
              </p>
            </div>
          </div>
        </div>
      </Surface>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Personal info */}
          <Surface>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold text-[var(--ms-text-strong)] flex items-center gap-2 mb-4">
                <UserRound className="h-4 w-4 text-[var(--ms-text-muted)]" />
                Informations personnelles
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nom complet" value={user?.name || 'Non renseigné'} />
                <Field label="Email" value={user?.email || 'Non renseigné'} isLink={`mailto:${user?.email}`} />
                <Field label="Téléphone" value={user?.phone || 'Non renseigné'} isLink={user?.phone ? `tel:${String(user.phone).replace(/[^+\d]/g, '')}` : null} />
                <Field label="Identifiant" value={user?._id || 'Non disponible'} mono />
              </div>
            </div>
          </Surface>

          {/* Admin stats */}
          {user?.isAdmin && (
            <Surface>
              <div className="p-5 sm:p-6">
                <h2 className="text-[15px] font-semibold text-[var(--ms-text-strong)] flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-[var(--ms-text-muted)]" />
                  Statistiques administrateur
                </h2>
                {adminStats ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KPICard title="Utilisateurs" value={adminStats.totalUsers} tone="blue" />
                    <KPICard title="Actifs 30j" value={adminStats.activeUsers} tone="success" />
                    <KPICard title="Admins" value={adminStats.admins} tone="info" />
                    <KPICard title="Nouveaux 30j" value={adminStats.recentUsers?.length || 0} tone="warning" />
                  </div>
                ) : (
                  <EmptyBlock icon={Activity} text="Chargement..." />
                )}
              </div>
            </Surface>
          )}

          {/* Sales stats */}
          {user?.isAdmin && (
            <Surface>
              <div className="p-5 sm:p-6">
                <h2 className="text-[15px] font-semibold text-[var(--ms-text-strong)] flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-[var(--ms-text-muted)]" />
                  Statistiques de ventes
                </h2>

                {/* Range selector */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {salesRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSalesRange(option.value)}
                      className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                        salesRange === option.value
                          ? 'bg-[var(--ms-blue)] text-white'
                          : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] border border-[var(--ms-border)] hover:bg-[var(--ms-surface-muted)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {salesStats ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <KPICard title="Chiffre d'affaires" value={formatMoney(salesStats.totalAmount)} tone="success" />
                    <KPICard title="Profit" value={formatMoney(salesStats.totalProfit)} tone="info" />
                    <KPICard title="Ventes" value={salesStats.salesCount || 0} tone="blue" />
                    <KPICard title="Clients" value={salesStats.clientsCount || 0} tone="info" />
                    <KPICard title="Payé" value={formatMoney(salesStats.totalPaid)} tone="success" />
                    <KPICard title="Restant" value={formatMoney(salesStats.balance)} tone="warning" />
                  </div>
                ) : (
                  <EmptyBlock icon={BarChart3} text="Aucune vente sur cette période." />
                )}
              </div>
            </Surface>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Account summary */}
          <Surface>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold text-[var(--ms-text-strong)] flex items-center gap-2 mb-4">
                <ShieldCheck className="h-4 w-4 text-[var(--ms-text-muted)]" />
                Résumé du compte
              </h2>
              <div className="space-y-2.5">
                <Fact icon={user?.isAdmin ? Crown : ShieldCheck} label="Type de compte" value={accountType} />
                <Fact icon={BadgeCheck} label="Statut" value="Actif" />
                <Fact icon={CalendarDays} label="Inscription" value={accountCreatedAt} />
                <Fact icon={Clock3} label="Dernière connexion" value={lastLoginDisplay} />
              </div>
            </div>
          </Surface>

          {/* Quick actions */}
          <Surface>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold text-[var(--ms-text-strong)] flex items-center gap-2 mb-4">
                <WalletCards className="h-4 w-4 text-[var(--ms-text-muted)]" />
                Actions rapides
              </h2>
              <div className="space-y-2">
                <Button onClick={() => navigate('/')} variant="primary" className="w-full justify-center">
                  <Home className="h-4 w-4" />
                  Retour à l'accueil
                </Button>
                {user?.isAdmin && (
                  <Button onClick={() => navigate('/users/stats')} variant="secondary" className="w-full justify-center">
                    <Users className="h-4 w-4" />
                    Dashboard utilisateurs
                  </Button>
                )}
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </Workspace>
  );
};

/* Sub-components */

const Field = ({ label, value, isLink, mono }) => (
  <div className="rounded-md border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3 py-2.5">
    <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ms-text-muted)]">{label}</dt>
    <dd className={`mt-1 text-[13px] font-medium text-[var(--ms-text)] ${mono ? 'font-mono text-[11px] break-all' : ''}`}>
      {isLink ? (
        <a href={isLink} className="text-[var(--ms-blue)] hover:underline break-all">{value}</a>
      ) : (
        value
      )}
    </dd>
  </div>
);

const Fact = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-md border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3 py-2.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ms-white)] border border-[var(--ms-border)] text-[var(--ms-text-muted)]">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ms-text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--ms-text)]">{value}</p>
    </div>
  </div>
);

const EmptyBlock = ({ icon: Icon, text }) => (
  <div className="flex min-h-[100px] items-center justify-center rounded-md border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-center">
    <div>
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-[var(--ms-white)] text-[var(--ms-text-muted)] border border-[var(--ms-border)]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-2 text-[13px] text-[var(--ms-text-muted)]">{text}</p>
    </div>
  </div>
);

export default UserProfile;
