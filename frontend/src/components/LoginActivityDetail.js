import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Button,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Surface,
  Workspace,
} from './business';
import { ArrowLeft, MapPin, ShieldAlert, UserRound } from 'lucide-react';

const LoginActivityDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loginActivity, setLoginActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [location, setLocation] = useState(null);
    const [isLocationLoading, setIsLocationLoading] = useState(false);

    useEffect(() => {
        const fetchLoginActivity = async () => {
            try {
                setLoading(true);
                const { data } = await api.get(`/users/login-activity/${id}`);
                setLoginActivity(data);
                setLoading(false);
            } catch (err) {
                setError('Échec du chargement des détails de connexion');
                setLoading(false);
            }
        };

        fetchLoginActivity();
    }, [id]);

    const fetchLocation = async () => {
        if (!loginActivity?.ipAddress) return;

        try {
            setIsLocationLoading(true);
            const response = await fetch(`https://ipapi.co/${loginActivity.ipAddress}/json/`);
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('Réponse non-JSON (géolocalisation indisponible)');
            }
            const data = await response.json();
            setLocation(data);
        } catch (err) {
            console.error('Erreur de géolocalisation:', err);
        } finally {
            setIsLocationLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';

        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: fr });
        } catch (e) {
            return 'Date invalide';
        }
    };

    const getStatusBadge = (success) => (
        <span
            className={`px-3 py-1 inline-flex text-sm font-medium rounded-full ${success
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
                }`}
        >
            {success ? 'Réussi' : 'Échoué'}
        </span>
    );

    const getRiskLevel = () => {
        if (!loginActivity) return 'faible';

        if (loginActivity.success) {
            return location?.country_code === 'FR' ? 'faible' : 'moyen';
        }

        return 'élevé';
    };

    const getRiskColor = () => {
        const level = getRiskLevel();
        return level === 'faible' ? 'bg-green-100 text-green-800'
            : level === 'moyen' ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800';
    };

  if (loading) {
    return (
      <Workspace className="flex justify-center items-center" style={{ minHeight: '60vh' }}>
        <LoadingSkeleton rows={6} />
      </Workspace>
    );
  }

  if (error) {
    return (
      <Workspace>
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
          <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>Retour</Button>
      </Workspace>
    );
  }

  if (!loginActivity) {
    return (
      <Workspace>
        <PageHeader title="Activite introuvable" />
        <Button variant="secondary" onClick={() => navigate(-1)}>Retour</Button>
      </Workspace>
    );
  }

  const riskLevel = getRiskLevel();

  return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Details de connexion"
        description={`ID: ${loginActivity._id}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge tone={loginActivity.success ? 'success' : 'danger'}>{loginActivity.success ? 'Reussi' : 'Echoue'}</StatusBadge>
            <StatusBadge tone={riskLevel === 'faible' ? 'success' : riskLevel === 'moyen' ? 'warning' : 'danger'}>Risque: {riskLevel}</StatusBadge>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Surface className="p-5">
          <h2 className="ms-section-title mb-4 flex items-center gap-2"><UserRound className="h-4 w-4" /> Informations utilisateur</h2>
          <div className="space-y-3">
            <div><p className="text-xs text-[var(--ms-text-muted)]">Nom</p><p className="font-medium text-[var(--ms-text)]">{loginActivity.user?.name || 'N/A'}</p></div>
            <div><p className="text-xs text-[var(--ms-text-muted)]">Email</p><p className="font-medium text-[var(--ms-text)]">{loginActivity.user?.email || loginActivity.attemptedEmail || 'N/A'}</p></div>
            <div><p className="text-xs text-[var(--ms-text-muted)]">Role</p><p className="font-medium text-[var(--ms-text)]">{loginActivity.user?.isAdmin ? 'Administrateur' : 'Utilisateur'}</p></div>
          </div>
        </Surface>

        <Surface className="p-5">
          <h2 className="ms-section-title mb-4 flex items-center gap-2"><MapPin className="h-4 w-4" /> Informations techniques</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[var(--ms-text-muted)]">Adresse IP</p>
              <div className="flex items-center gap-2">
                <p className="font-medium text-[var(--ms-text)]">{loginActivity.ipAddress || 'N/A'}</p>
                <Button variant="secondary" size="sm" onClick={fetchLocation} disabled={!loginActivity.ipAddress || isLocationLoading}>{isLocationLoading ? '...' : 'Localiser'}</Button>
              </div>
            </div>
            {location && (
              <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3">
                <p className="font-medium text-[var(--ms-text)]">{location.city ? `${location.city}, ${location.region}` : 'Inconnue'}</p>
                <p className="text-sm text-[var(--ms-text-muted)]">{location.country_name} ({location.country_code})</p>
              </div>
            )}
            <div><p className="text-xs text-[var(--ms-text-muted)]">Appareil</p><p className="font-medium text-[var(--ms-text)]">{loginActivity.device || 'Inconnu'}</p></div>
            <div><p className="text-xs text-[var(--ms-text-muted)]">Date</p><p className="font-medium text-[var(--ms-text)]">{formatDate(loginActivity.createdAt)}</p></div>
          </div>
        </Surface>
      </div>

      {!loginActivity.success && (
        <Surface className="p-5 border-l-4 border-[var(--ms-danger)]">
          <h2 className="ms-section-title text-[var(--ms-danger)] mb-2">Details de l'echec</h2>
          <p className="text-sm text-[var(--ms-text)]">{loginActivity.error || 'Email ou mot de passe incorrect'}</p>
          <p className="text-xs text-[var(--ms-text-muted)] mt-1">Email utilise: {loginActivity.attemptedEmail}</p>
        </Surface>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/users/login-stats')}><ArrowLeft className="h-4 w-4" /> Retour</Button>
        {loginActivity.user && (
          <Button variant="primary" onClick={() => navigate(`/sales/user/${loginActivity.user._id}`)}>Voir profil utilisateur</Button>
        )}
      </div>
    </Workspace>
  );
};

export default LoginActivityDetail;
