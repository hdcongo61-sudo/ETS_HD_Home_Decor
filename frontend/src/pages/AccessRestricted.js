import React, { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, PageHeader, Workspace } from '../components/business';
import { AlertTriangle } from 'lucide-react';

const formatDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const AccessRestricted = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const restrictionInfo = useMemo(() => {
    if (location.state) {
      return location.state;
    }

    const stored = sessionStorage.getItem('accessRestrictionInfo');
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to parse access restriction info', error);
      return null;
    }
  }, [location.state]);

  useEffect(() => {
    return () => {
      sessionStorage.removeItem('accessRestrictionInfo');
    };
  }, []);

  const message = restrictionInfo?.message || 'Accès temporairement restreint.';
  const accessStart = formatDateTime(restrictionInfo?.accessStart);
  const accessEnd = formatDateTime(restrictionInfo?.accessEnd);

  return (
    <Workspace className="flex items-center justify-center" style={{ minHeight: '80vh' }}>
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ms-warning)]/10">
          <AlertTriangle className="h-8 w-8 text-[var(--ms-warning)]" />
        </div>

        <PageHeader title="Acces restreint" description={message} />

        {(accessStart || accessEnd) && (
          <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 text-left text-sm space-y-2">
            {accessStart && <div><span className="font-medium text-[var(--ms-text)]">Acces autorise a partir de :</span><br /><span className="text-[var(--ms-text-muted)]">{accessStart}</span></div>}
            {accessEnd && <div><span className="font-medium text-[var(--ms-text)]">Acces disponible jusqu'au :</span><br /><span className="text-[var(--ms-text-muted)]">{accessEnd}</span></div>}
          </div>
        )}

        <p className="text-sm text-[var(--ms-text-muted)]">Pour toute question, veuillez contacter un administrateur.</p>

        <Button variant="primary" onClick={() => navigate('/login', { replace: true })}>
          Retour a la connexion
        </Button>
      </div>
    </Workspace>
  );
};

export default AccessRestricted;
