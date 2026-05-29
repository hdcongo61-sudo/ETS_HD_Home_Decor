import React, { useContext } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { resolveAppLogo } from '../utils/appBranding';
import AuthContext from '../context/AuthContext';

const currentYear = new Date().getFullYear();

const SiteFooter = () => {
  const { appSettings } = useAppSettings();
  const { auth } = useContext(AuthContext);
  const { appName, shortName, tagline, footerText, supportPhone, supportEmail, logoUrl } = appSettings.branding;
  const resolvedLogoUrl = resolveAppLogo(logoUrl);
  const hasMobileTabBar = Boolean(auth?.isAuthenticated);

  return (
    <footer className="border-t border-white/70 bg-white/82 backdrop-blur-2xl">
      <div className={`mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 text-[13px] text-gray-500 sm:px-6 md:flex-row md:items-center md:justify-between md:py-5 ${hasMobileTabBar ? 'footer-mobile-tab-clearance' : ''}`}>
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={resolvedLogoUrl}
            alt={shortName || appName}
            className="h-11 w-11 shrink-0 rounded-2xl border border-gray-200/80 bg-white object-contain shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{appName}</p>
            {tagline && <p className="truncate text-xs text-gray-500">{tagline}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          {(supportPhone || supportEmail) && (
            <div className="flex flex-wrap items-center gap-2">
              {supportPhone && (
                <a
                  href={`tel:${supportPhone}`}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 active:translate-y-0"
                >
                  <Phone className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  <span>{supportPhone}</span>
                </a>
              )}
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 active:translate-y-0"
                >
                  <Mail className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  <span>{supportEmail}</span>
                </a>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 md:justify-end">
            <span>© {currentYear} {footerText}</span>
            <span className="hidden text-gray-300 sm:inline">/</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              Interface sécurisée
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
