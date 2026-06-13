import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';

/**
 * Persistent banner shown while a super-admin is impersonating a shop.
 * Lets them exit impersonation and restore their platform session from
 * anywhere in the app.
 */
const ImpersonationBanner = () => {
  const impersonating = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('impersonating');
  if (!impersonating) return null;

  const tenantName = sessionStorage.getItem('impersonatingTenantName') || 'cette boutique';

  const handleExit = () => {
    const tok = sessionStorage.getItem('superAdminToken');
    const tid = sessionStorage.getItem('superAdminTenantId');
    sessionStorage.removeItem('superAdminToken');
    sessionStorage.removeItem('superAdminTenantId');
    sessionStorage.removeItem('impersonating');
    sessionStorage.removeItem('impersonatingTenantName');
    if (tok) localStorage.setItem('token', tok);
    if (tid) localStorage.setItem('tenantId', tid); else localStorage.removeItem('tenantId');
    window.location.href = '/super-admin';
  };

  return (
    <div
      className="sticky top-0 z-[90] flex items-center justify-center gap-3 px-4 py-2 text-center"
      style={{ background: 'var(--colorStatusWarningForeground1)', color: '#fff' }}
    >
      <ShieldAlert size={16} className="shrink-0" />
      <span className="fui-caption1-strong">
        Mode supervision — vous consultez <strong>{tenantName}</strong> en tant qu'administrateur.
      </span>
      <button
        onClick={handleExit}
        className="ml-1 inline-flex items-center gap-1.5 rounded-[var(--radiusMedium)] px-2.5 py-1 text-[12px] font-semibold transition-colors"
        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
      >
        <LogOut size={13} />
        Quitter
      </button>
    </div>
  );
};

export default ImpersonationBanner;
