import React, { useState, useEffect, useRef, useContext } from 'react';
import { formatCfa } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Camera,
  Clock3,
  Crown,
  ExternalLink,
  Home,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import ErrorModal from './ErrorModal';
import AppLoader from './AppLoader';
import { PageHeader, Workspace, KPICard, Button, Surface, StatusBadge } from './business';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { clearSessionStorage } from '../features/auth/hooks';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminStats, setAdminStats] = useState(null);
  const [, setStatsError] = useState('');
  const [salesStats, setSalesStats] = useState(null);
  const [, setSalesError] = useState('');
  const [salesRange, setSalesRange] = useState('30days');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirmation: '',
    mfaCode: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const fileRef = useRef(null);
  const { auth, setAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choisissez un fichier image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo).'); return; }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photoFile', file);
      const { data } = await api.put('/users/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser((u) => ({ ...(u || {}), photo: data.photo }));
      if (setAuth && auth?.user) setAuth({ ...auth, user: { ...auth.user, photo: data.photo } });
      toast.success('Photo de profil mise à jour.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour de la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    const { currentPassword, newPassword, newPasswordConfirmation, mfaCode } = passwordForm;
    if (newPassword.length < 10 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error('Utilisez au moins 10 caractères, avec une minuscule, une majuscule et un chiffre.');
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      toast.error('La confirmation du nouveau mot de passe ne correspond pas.');
      return;
    }
    if (user?.mfaEnabled && !/^\d{6}$/.test(mfaCode)) {
      toast.error('Saisissez le code à 6 chiffres de votre application d’authentification.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/users/password', {
        currentPassword,
        newPassword,
        newPasswordConfirmation,
        ...(user?.mfaEnabled ? { mfaCode } : {}),
      });
      toast.success('Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.');
      clearSessionStorage();
      window.location.replace('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setChangingPassword(false);
    }
  };

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
      if (profile?.isAdmin && !profile?.isSuperAdmin) {
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProfile(); }, [navigate]);

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
    if (user?.isAdmin && !user?.isSuperAdmin) fetchSalesStats(user._id, salesRange);
  }, [user?._id, user?.isAdmin, user?.isSuperAdmin, salesRange]);

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
  const formatMoney = (value) => formatCfa(value);
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

  if (auth?.isSuperAdmin || user?.isSuperAdmin) {
    return (
      <Workspace>
        <PageHeader
          eyebrow="Compte plateforme"
          title="Mon profil"
          description="Gérez votre compte opérateur et consultez rapidement son état de sécurité."
          actions={
            <div className="flex items-center gap-2">
              <Button onClick={handleRetry} variant="secondary" size="sm">
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </Button>
            </div>
          }
        />

        <Surface>
          <div className="relative overflow-hidden p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-sky-50/80 to-transparent sm:block" aria-hidden="true" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Changer la photo de profil"
                  aria-label="Changer la photo de profil"
                  className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-sky-200 bg-sky-50 text-2xl font-semibold text-sky-800 transition-colors hover:border-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-wait"
                >
                  {user?.photo ? (
                    <img src={user.photo} alt={user.name || 'Profil'} className="h-full w-full object-cover" />
                  ) : (
                    userInitials || <UserRound className="h-8 w-8" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {uploadingPhoto
                      ? <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
                      : <Camera className="h-5 w-5" aria-hidden="true" />}
                  </span>
                </button>
                <span className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-sky-700 text-white" aria-hidden="true">
                  <Crown className="h-4 w-4" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="info">Super Admin</StatusBadge>
                  <StatusBadge tone={user?.isActive === false ? 'warning' : 'success'}>
                    {user?.isActive === false ? 'Compte désactivé' : 'Compte actif'}
                  </StatusBadge>
                </div>
                <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight text-slate-900">
                  {user?.name || 'Opérateur plateforme'}
                </h2>
                <p className="mt-1 break-all text-sm text-slate-600">{user?.email || 'Adresse e-mail non renseignée'}</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Compte d’administration global. Ses paramètres de profil sont distincts des comptes et des identités des boutiques.
                </p>
              </div>
              <Button onClick={() => navigate('/security')} variant="primary" className="shrink-0">
                <LockKeyhole className="h-4 w-4" />
                Paramètres de sécurité
              </Button>
            </div>
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <Surface>
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700" aria-hidden="true">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Informations du compte</h2>
                  <p className="mt-0.5 text-xs text-slate-600">Coordonnées et dates associées à votre accès plateforme.</p>
                </div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom complet" value={user?.name || 'Non renseigné'} />
                <Field label="Adresse e-mail" value={user?.email || 'Non renseignée'} isLink={user?.email ? `mailto:${user.email}` : null} />
                <Field
                  label="Téléphone"
                  value={user?.phone || 'Non renseigné'}
                  isLink={user?.phone ? `tel:${String(user.phone).replace(/[^+\d]/g, '')}` : null}
                />
                <Field label="Identifiant opérateur" value={user?._id || 'Non disponible'} mono />
              </dl>
            </div>
          </Surface>

          <div className="space-y-4">
            <Surface>
              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800" aria-hidden="true">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Sécurité du compte</h2>
                    <p className="mt-0.5 text-xs text-slate-600">Vérifiez votre authentification et vos sessions.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Double authentification</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {user?.mfaEnabled ? 'Activée : un code supplémentaire protège votre compte.' : 'Non activée : ajoutez une vérification par application d’authentification.'}
                    </p>
                  </div>
                  <StatusBadge tone={user?.mfaEnabled ? 'success' : 'warning'}>
                    {user?.mfaEnabled ? 'Activée' : 'À activer'}
                  </StatusBadge>
                </div>
                <div className="mt-3 space-y-2.5">
                  <Fact icon={CalendarDays} label="Compte créé" value={accountCreatedAt} />
                  <Fact icon={Clock3} label="Dernière connexion" value={lastLoginDisplay} />
                </div>
                <Button onClick={() => navigate('/security')} variant="secondary" className="mt-4 w-full justify-center">
                  Gérer les sessions et la MFA
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </Surface>

            <Surface>
              <form onSubmit={handlePasswordChange} className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-800" aria-hidden="true">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Changer le mot de passe</h2>
                    <p className="mt-0.5 text-xs text-slate-600">Confirmez votre identité avant toute modification.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <PasswordField
                    id="operator-current-password"
                    label="Mot de passe actuel"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(value) => setPasswordForm((form) => ({ ...form, currentPassword: value }))}
                  />
                  <PasswordField
                    id="operator-new-password"
                    label="Nouveau mot de passe"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(value) => setPasswordForm((form) => ({ ...form, newPassword: value }))}
                    maxLength={72}
                    hint="10 caractères minimum, avec une minuscule, une majuscule et un chiffre (72 octets maximum)."
                  />
                  <PasswordField
                    id="operator-confirm-password"
                    label="Confirmer le nouveau mot de passe"
                    autoComplete="new-password"
                    value={passwordForm.newPasswordConfirmation}
                    onChange={(value) => setPasswordForm((form) => ({ ...form, newPasswordConfirmation: value }))}
                    maxLength={72}
                  />
                  {user?.mfaEnabled && (
                    <div>
                      <label htmlFor="operator-mfa-code" className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Code de double authentification
                      </label>
                      <input
                        id="operator-mfa-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={passwordForm.mfaCode}
                        onChange={(event) => setPasswordForm((form) => ({
                          ...form,
                          mfaCode: event.target.value.replace(/\D/g, '').slice(0, 6),
                        }))}
                        required
                        className="form-control w-full"
                        placeholder="000000"
                      />
                    </div>
                  )}
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
                    Après le changement, toutes les sessions seront déconnectées. Vous devrez vous reconnecter avec le nouveau mot de passe.
                  </p>
                  <Button type="submit" disabled={changingPassword} variant="primary" className="w-full justify-center">
                    {changingPassword ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    {changingPassword ? 'Modification…' : 'Vérifier et changer le mot de passe'}
                  </Button>
                </div>
              </form>
            </Surface>

            <Surface>
              <div className="p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-slate-900">Raccourcis plateforme</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Ouvrez les paramètres globaux ou revenez à la console d’administration.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button onClick={() => navigate('/settings')} variant="secondary" className="w-full justify-center">
                    <Shield className="h-4 w-4" />
                    Paramètres plateforme
                  </Button>
                  <Button onClick={() => navigate('/super-admin')} variant="secondary" className="w-full justify-center">
                    <Home className="h-4 w-4" />
                    Console Super Admin
                  </Button>
                </div>
              </div>
            </Surface>
          </div>
        </div>
      </Workspace>
    );
  }

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
            {/* Avatar (cliquable pour changer la photo) */}
            <div className="relative shrink-0">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                title="Changer la photo de profil"
                className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-2xl font-semibold text-[var(--ms-text-muted)]"
              >
                {user?.photo ? (
                  <img src={user.photo} alt={user.name || 'Profil'} className="h-full w-full object-cover" />
                ) : (
                  userInitials || <UserRound className="h-8 w-8" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {uploadingPhoto
                    ? <RefreshCw className="h-5 w-5 animate-spin" />
                    : <Camera className="h-5 w-5" />}
                </span>
              </button>
              {/* Badge appareil photo (indique que c'est modifiable) */}
              <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ms-blue)] text-white shadow-sm">
                <Camera className="h-3 w-3" />
              </span>
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
                <Button onClick={() => navigate('/security')} variant="primary" className="w-full justify-center">
                  <Shield className="h-4 w-4" />
                  Sécurité
                </Button>
                <Button onClick={() => navigate('/')} variant="secondary" className="w-full justify-center">
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

const PasswordField = ({ id, label, value, onChange, autoComplete, hint, maxLength }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
    <input
      id={id}
      type="password"
      autoComplete={autoComplete}
      value={value}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      required
      className="form-control w-full"
    />
    {hint && <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{hint}</p>}
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
