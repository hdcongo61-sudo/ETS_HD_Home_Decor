import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import AppLoader from './AppLoader';
import {
  Button,
  DataTable,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Workspace,
} from './business';
import { Activity, CheckCircle2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

const ResumeConnexions = () => {
    const tableRef = useRef(null);
    const [loginStats, setLoginStats] = useState({
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        recentLogins: []
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchLoginStats();
    }, []);

    const fetchLoginStats = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/users/login-stats');
            setLoginStats(data);
            setLoading(false);
        } catch (err) {
            const errorMessage = err.response?.data?.message ||
                err.message ||
                'Échec du chargement des statistiques de connexion';
            setError(errorMessage);
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Format invalide';

            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error('Erreur de formatage de date:', e);
            return 'Date invalide';
        }
    };

    useResponsiveTable(tableRef, [loginStats.recentLogins]);

    return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Resume des connexions"
        description="Les 10 dernieres tentatives de connexion"
        actions={
          <Button variant="primary" size="sm" onClick={fetchLoginStats}>
            <RefreshCw className="h-4 w-4" /> Actualiser
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard title="Connexions totales" value={loginStats.totalLogins} tone="neutral" icon={<Activity className="h-4 w-4" />} />
            <KPICard title="Reussies (30j)" value={loginStats.successfulLogins} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
            <KPICard title="Echecs (30j)" value={loginStats.failedLogins} tone="danger" icon={<XCircle className="h-4 w-4" />} />
          </div>

          {loginStats.recentLogins.length === 0 ? (
            <EmptyState title="Aucune activite recente" description="Les connexions apparaitront ici." />
          ) : (
            <DataTable>
              <table ref={tableRef} className="responsive-table w-full">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Statut</th>
                    <th>Adresse IP</th>
                    <th>Appareil</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loginStats.recentLogins.map((login) => (
                    <tr key={login._id} onClick={() => navigate(`/users/login-activity/${login._id}`)} className="cursor-pointer">
                      <td className="font-medium text-[var(--ms-text)]">{login.user?.name || 'N/A'}</td>
                      <td className="text-[var(--ms-text-muted)] text-sm">{login.attemptedEmail || login.user?.email || 'N/A'}</td>
                      <td><StatusBadge tone={login.success ? 'success' : 'danger'}>{login.success ? 'Reussi' : 'Echoue'}</StatusBadge></td>
                      <td className="text-[var(--ms-text-muted)] text-sm">{login.ipAddress}</td>
                      <td className="text-[var(--ms-text-muted)] text-sm max-w-[200px] truncate">{login.device || 'Inconnu'}</td>
                      <td className="text-[var(--ms-text-muted)] text-sm">{formatDate(login.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </>
      )}
    </Workspace>
  );
};

export default ResumeConnexions;
