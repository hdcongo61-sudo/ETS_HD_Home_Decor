import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Clock, ArrowRight, Sparkles } from 'lucide-react';

/**
 * Trial countdown bar. Shown at the very top for shops on the free trial:
 * displays the days left and nudges the owner to upgrade to a paid plan.
 * Hidden for paid shops and for the platform super-admin.
 */
const TrialBanner = () => {
  const { auth } = useContext(AuthContext);

  if (!auth?.isAuthenticated || auth.isSuperAdmin) return null;
  const t = auth.tenant;
  if (!t || t.status !== 'trial') return null;

  const days = Number.isFinite(t.trialDaysLeft) ? Math.max(0, t.trialDaysLeft) : null;
  const urgent = days != null && days <= 3;

  const label =
    days == null ? "Version d'essai active"
      : days <= 0 ? "Votre période d'essai se termine aujourd'hui"
        : `Essai gratuit — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2"
      style={{
        background: urgent ? 'var(--colorStatusDangerBackground1)' : 'var(--ms-blue-soft)',
        color: urgent ? 'var(--colorStatusDangerForeground1)' : 'var(--colorBrandForeground1)',
        borderBottom: '1px solid var(--colorNeutralStroke2)',
      }}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <Clock size={15} /> {label}
      </span>
      <span className="hidden text-sm sm:inline" style={{ opacity: 0.85 }}>
        — Passez à la version complète pour conserver l'accès à toutes vos données et fonctions.
      </span>
      {auth.isAdmin && (
        <Link
          to="/settings#abonnement"
          className="ms-button ms-button-primary ms-button-sm shrink-0"
        >
          <Sparkles size={13} /> Choisir mon plan <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
};

export default TrialBanner;
