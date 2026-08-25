import React, { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, PageHeader, Workspace } from '../components/business';
import { AlertTriangle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import PawaPaySubscriptionForm from '../components/PawaPaySubscriptionForm';

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
    if (location.state) return location.state;

    // Tenant suspension / expiry is stored under its own key (kept so the user
    // can still call the billing endpoints with their token).
    try {
      const tenantInfo = sessionStorage.getItem('tenantRestrictionInfo');
      if (tenantInfo) return JSON.parse(tenantInfo);
    } catch (error) {
      console.error('Failed to parse tenant restriction info', error);
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

  const isTenantRestriction =
    restrictionInfo?.code === 'TENANT_SUSPENDED' ||
    restrictionInfo?.code === 'TENANT_EXPIRED' ||
    restrictionInfo?.code === 'PAYMENT_OVERDUE';

  const isPaymentOverdue = restrictionInfo?.code === 'PAYMENT_OVERDUE';
  const daysPastDue = restrictionInfo?.daysPastDue || 0;

  return (
    <Workspace className="flex items-center justify-center" style={{ minHeight: '80vh' }}>
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-6">
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
        </div>

        {isTenantRestriction && (
          <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-5 text-left space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ms-blue)]/10">
                <CreditCard className="h-5 w-5 text-[var(--ms-blue)]" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-[var(--ms-text)]">Reactiver votre boutique</h2>
                {isPaymentOverdue && (
                  <div className="mt-2 rounded-md bg-[var(--ms-warning)]/10 border border-[var(--ms-warning)]/20 p-3">
                    <p className="text-sm font-medium text-[var(--ms-warning)]">
                      Paiement en retard de {daysPastDue} jour{daysPastDue > 1 ? 's' : ''}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                      Votre echeance de paiement est depassee. Payez maintenant pour continuer a utiliser votre boutique.
                    </p>
                  </div>
                )}
                <p className="mt-2 text-sm text-[var(--ms-text-muted)]">
                  Payez votre abonnement par mobile money pour reactiver immediatement votre boutique,
                  ou reglez en especes directement aupres du support.
                </p>
              </div>
            </div>

            <PawaPaySubscriptionForm
              onPaid={() => {
                toast.success('Abonnement activé. Redirection…');
                // Full reload: AuthContext re-checks /users/me and lands on the app.
                window.setTimeout(() => window.location.replace('/'), 1200);
              }}
            />
          </div>
        )}

        <div className="text-center">
          <Button variant="primary" onClick={() => navigate('/login', { replace: true })}>
            Retour a la connexion
          </Button>
        </div>
      </div>
    </Workspace>
  );
};

export default AccessRestricted;
