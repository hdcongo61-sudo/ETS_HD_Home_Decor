import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line
  }, [navigate]);

  const handleRetry = () => {
    setError('');
    fetchProfile();
  };

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
    if (user?.isAdmin) {
      fetchSalesStats(user._id, salesRange);
    }
  }, [user?._id, user?.isAdmin, salesRange]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-transparent">
        <AppLoader fullScreen={false} text="Chargement du profil..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorModal
        message={error}
        onRetry={handleRetry}
        onClose={() => setError('')}
      />
    );
  }

  const membershipDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
      })
    : '—';

  const accountCreatedAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Non disponible';

  const lastLoginDisplay = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Non disponible';

  const formatMoney = (value) =>
    `${new Intl.NumberFormat('fr-FR').format(Math.round(value || 0))} CFA`;
  const userInitials = (user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const accountType = user?.isAdmin ? 'Administrateur' : 'Utilisateur standard';
  const salesRangeOptions = [
    { value: 'today', label: "Aujourd'hui" },
    { value: '7days', label: '7 jours' },
    { value: '30days', label: '30 jours' },
    { value: '90days', label: '90 jours' },
    { value: 'all', label: 'Tout' },
  ];
  const profileFacts = [
    {
      label: 'Type de compte',
      value: accountType,
      icon: user?.isAdmin ? Crown : ShieldCheck,
      tone: user?.isAdmin ? 'violet' : 'blue',
    },
    {
      label: 'Statut',
      value: 'Actif',
      icon: BadgeCheck,
      tone: 'green',
    },
    {
      label: 'Inscription',
      value: accountCreatedAt,
      icon: CalendarDays,
      tone: 'slate',
    },
    {
      label: 'Dernière connexion',
      value: lastLoginDisplay,
      icon: Clock3,
      tone: 'amber',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-3 py-4 text-gray-950 dark:from-gray-900 dark:to-gray-800 dark:text-gray-100 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
          >
            <ArrowLeft size={18} />
            Retour
          </button>
          <button
            onClick={handleRetry}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
          >
            <RefreshCw size={17} />
            Actualiser
          </button>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-gray-800 dark:bg-gray-900/90">
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-gray-200 bg-gray-100 text-3xl font-bold text-gray-500 shadow-inner dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {user?.photo ? (
                    <img src={user.photo} alt={user.name || 'Profil'} className="h-full w-full object-cover" />
                  ) : (
                    userInitials || <UserRound size={40} />
                  )}
                </div>
                {user?.isAdmin && (
                  <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-gray-950 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg dark:bg-white dark:text-gray-950">
                    <Crown size={12} />
                    Admin
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                  Mon profil
                </p>
                <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">
                  {user?.name || 'Utilisateur'}
                </h1>
                <div className="mt-3 flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:flex-wrap sm:items-center">
                  {user?.email && (
                    <a href={`mailto:${user.email}`} className="inline-flex items-center gap-2 hover:text-gray-900 dark:hover:text-white">
                      <Mail size={16} />
                      <span className="break-all">{user.email}</span>
                    </a>
                  )}
                  {user?.phone && (
                    <a href={`tel:${String(user.phone).replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-2 hover:text-gray-900 dark:hover:text-white">
                      <Phone size={16} />
                      {user.phone}
                    </a>
                  )}
                </div>
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <CalendarDays size={14} />
                  Membre depuis {membershipDate}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
              <ProfileMiniStat label="Compte" value={accountType} icon={user?.isAdmin ? Crown : ShieldCheck} />
              <ProfileMiniStat label="Statut" value="Actif" icon={UserCheck} />
              <ProfileMiniStat label="Créé le" value={accountCreatedAt} icon={CalendarDays} wide />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <Panel
              title="Informations personnelles"
              description="Coordonnées et identité du compte."
              icon={UserRound}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem label="Nom complet" value={user?.name || 'Non renseigné'} />
                <DetailItem label="Email" value={user?.email || 'Non renseigné'} isEmail={Boolean(user?.email)} />
                <DetailItem label="Téléphone" value={user?.phone || 'Non renseigné'} isPhone={Boolean(user?.phone)} />
                <DetailItem label="Identifiant" value={user?._id || 'Non disponible'} compact />
              </div>
            </Panel>

            {user?.isAdmin && (
              <Panel
                title="Statistiques administrateur"
                description="Vue rapide de la base utilisateurs."
                icon={Users}
                action={statsError ? <ErrorPill message={statsError} /> : null}
              >
                {adminStats ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatBadge label="Utilisateurs" value={adminStats.totalUsers} tone="blue" />
                    <StatBadge label="Actifs 30j" value={adminStats.activeUsers} tone="green" />
                    <StatBadge label="Admins" value={adminStats.admins} tone="violet" />
                    <StatBadge label="Nouveaux 30j" value={adminStats.recentUsers?.length || 0} tone="amber" />
                  </div>
                ) : (
                  <SectionState icon={Activity} text="Chargement des statistiques administrateur..." />
                )}
              </Panel>
            )}

            {user?.isAdmin && (
              <Panel
                title="Statistiques de ventes"
                description="Performance commerciale liée à votre compte."
                icon={TrendingUp}
                action={salesError ? <ErrorPill message={salesError} /> : null}
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Période analysée
                  </p>
                  <div className="rounded-[18px] border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
                    <div className="grid grid-cols-5 gap-1">
                      {salesRangeOptions.map((option) => {
                        const active = salesRange === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSalesRange(option.value)}
                            className={`min-h-[38px] rounded-2xl px-2 text-xs font-semibold transition-all ${
                              active
                                ? 'bg-gray-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] dark:bg-white dark:text-gray-950'
                                : 'text-gray-500 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {salesStats ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <StatBadge label="Chiffre d'affaires" value={formatMoney(salesStats.totalAmount)} tone="green" />
                    <StatBadge label="Profit" value={formatMoney(salesStats.totalProfit)} tone="emerald" />
                    <StatBadge label="Ventes" value={salesStats.salesCount || 0} tone="blue" />
                    <StatBadge label="Clients" value={salesStats.clientsCount || 0} tone="violet" />
                    <StatBadge label="Payé" value={formatMoney(salesStats.totalPaid)} tone="teal" />
                    <StatBadge label="Restant" value={formatMoney(salesStats.balance)} tone="amber" />
                  </div>
                ) : (
                  <SectionState icon={BarChart3} text="Aucune vente sur la période sélectionnée." />
                )}
              </Panel>
            )}
          </section>

          <aside className="space-y-4">
            <Panel title="Résumé du compte" description="Statut, accès et activité." icon={ShieldCheck}>
              <div className="space-y-3">
                {profileFacts.map((fact) => (
                  <FactRow key={fact.label} {...fact} />
                ))}
              </div>
            </Panel>

            <Panel title="Actions rapides" description="Navigation liée au compte." icon={WalletCards}>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                >
                  <Home size={18} />
                  Retour à l'accueil
                </button>
                {user?.isAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate('/users/stats')}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
                  >
                    <Users size={18} />
                    Dashboard utilisateurs
                  </button>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </motion.div>
  );
};

const toneClasses = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  green: 'bg-green-50 text-green-700 ring-green-100 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/20',
  slate: 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
};

const Panel = ({ title, description, icon: Icon, action, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5"
  >
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] dark:bg-white dark:text-gray-950">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-950 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
    {children}
  </motion.section>
);

const ProfileMiniStat = ({ label, value, icon: Icon, wide = false }) => (
  <div className={`rounded-[20px] border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 ${wide ? 'col-span-2' : ''}`}>
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
      <Icon size={14} />
      {label}
    </div>
    <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-950 dark:text-white">{value}</p>
  </div>
);

const FactRow = ({ label, value, icon: Icon, tone = 'slate' }) => (
  <div className="flex items-center gap-3 rounded-[20px] border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneClasses[tone] || toneClasses.slate}`}>
      <Icon size={18} />
    </span>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-950 dark:text-white">{value}</p>
    </div>
  </div>
);

const StatBadge = ({ label, value, tone = 'slate' }) => (
  <div className="rounded-[20px] border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/70">
    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</div>
    <div className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-base font-bold ring-1 sm:text-lg ${toneClasses[tone] || toneClasses.slate}`}>
      {value}
    </div>
  </div>
);

const SectionState = ({ icon: Icon, text }) => (
  <div className="flex min-h-[120px] items-center justify-center rounded-[20px] border border-dashed border-gray-200 bg-gray-50/80 p-5 text-center dark:border-gray-700 dark:bg-gray-800/70">
    <div>
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-300">
        <Icon size={20} />
      </span>
      <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  </div>
);

const ErrorPill = ({ message }) => (
  <span className="max-w-[180px] truncate rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20">
    {message}
  </span>
);

const DetailItem = ({ label, value, isEmail = false, isPhone = false, compact = false }) => {
  const renderValue = () => {
    if (isEmail && value) {
      return (
        <a href={`mailto:${value}`} className="break-all text-gray-950 underline-offset-4 hover:underline dark:text-white">
          {value}
        </a>
      );
    }

    if (isPhone && value) {
      const telValue = typeof value === 'string' ? value.replace(/[^+\d]/g, '') : value;
      return (
        <a href={`tel:${telValue}`} className="text-gray-950 underline-offset-4 hover:underline dark:text-white">
          {value}
        </a>
      );
    }

    return <span className="text-gray-950 dark:text-white">{value}</span>;
  };

  return (
    <div className="rounded-[20px] border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</dt>
      <dd className={`mt-2 text-sm font-semibold ${compact ? 'break-all text-xs leading-5' : isEmail ? 'break-all' : ''}`}>
        {renderValue()}
      </dd>
    </div>
  );
};

export default UserProfile;
