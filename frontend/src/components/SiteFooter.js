import React, { useContext } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { Globe2, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { resolveAppLogo } from '../utils/appBranding';
import AuthContext from '../context/AuthContext';

const currentYear = new Date().getFullYear();

const SiteFooter = () => {
  const { appSettings, platformBranding } = useAppSettings();
  const { auth } = useContext(AuthContext);
  const { tagline, footerText } = appSettings.branding;
  const appName = platformBranding?.appName || appSettings.branding.appName;
  const { supportPhone, supportEmail, whatsappUrl, websiteUrl, address } = platformBranding || {};
  const resolvedLogoUrl = resolveAppLogo(platformBranding?.logoUrl);
  const hasMobileTabBar = Boolean(auth?.isAuthenticated);

  return (
    <footer className="border-t border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]">
      <div className={`mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-4 ${hasMobileTabBar ? 'footer-mobile-tab-clearance' : ''}`}>
        {/* Top row: brand + contact */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={resolvedLogoUrl}
              alt={appName}
              className="h-9 w-9 shrink-0 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--ms-text-strong)]">{appName}</p>
              {tagline && <p className="truncate text-[11px] text-[var(--ms-text-muted)]">{tagline}</p>}
            </div>
          </div>

          {/* Contact links */}
          {(supportPhone || supportEmail || whatsappUrl || websiteUrl || address) && (
            <div className="flex flex-wrap items-center gap-2">
              {supportPhone && (
                <a
                  href={`tel:${supportPhone}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 text-[12px] font-medium text-[var(--ms-text)] transition-colors hover:bg-[var(--ms-bg-subtle)]"
                >
                  <Phone className="h-3.5 w-3.5 text-[var(--ms-text-muted)]" aria-hidden="true" />
                  <span>{supportPhone}</span>
                </a>
              )}
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 text-[12px] font-medium text-[var(--ms-text)] transition-colors hover:bg-[var(--ms-bg-subtle)]"
                >
                  <Mail className="h-3.5 w-3.5 text-[var(--ms-text-muted)]" aria-hidden="true" />
                  <span>{supportEmail}</span>
                </a>
              )}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 text-[12px] font-medium text-[var(--ms-text)] transition-colors hover:bg-[var(--ms-bg-subtle)]"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-[var(--ms-text-muted)]" aria-hidden="true" />
                  <span>WhatsApp</span>
                </a>
              )}
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 text-[12px] font-medium text-[var(--ms-text)] transition-colors hover:bg-[var(--ms-bg-subtle)]"
                >
                  <Globe2 className="h-3.5 w-3.5 text-[var(--ms-text-muted)]" aria-hidden="true" />
                  <span>Site web</span>
                </a>
              )}
              {address && (
                <span className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[12px] text-[var(--ms-text-muted)]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{address}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom row: copyright + badge */}
        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-[var(--ms-border)]">
          <p className="text-[11px] text-[var(--ms-text-muted)]">
            &copy; {currentYear} {footerText}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ms-text-muted)]">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Interface s&eacute;curis&eacute;e
          </span>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
