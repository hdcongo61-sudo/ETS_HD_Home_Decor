import React from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { resolveAppLogo } from '../utils/appBranding';

/**
 * Unified app loader with animated logo. Use as Suspense fallback or inside overlays.
 * @param {boolean} fullScreen - If true, centers in viewport (min-height). If false, compact for inline/overlay.
 * @param {string} text - Optional text below the logo (e.g. "Chargement...").
 * @param {string} textClassName - Optional class for the text (e.g. "text-white" for overlays).
 */
export default function AppLoader({ fullScreen = true, text = 'Chargement...', textClassName = 'text-gray-500' }) {
  const { appSettings } = useAppSettings();
  const logoUrl = resolveAppLogo(appSettings.branding.logoUrl);
  const appName = appSettings.branding.appName || 'HD Gestion';

  const content = (
    <div className="flex flex-col items-center justify-center gap-5">
      <div className="relative">
        <span className="app-loader-ring absolute -inset-3 rounded-[22px]" aria-hidden="true" />
        <img
          src={logoUrl}
          alt={appSettings.branding.shortName || appName}
          className="app-loader-logo relative h-16 w-16 rounded-2xl border border-gray-200 bg-white object-contain shadow-md"
        />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <p className="max-w-[240px] truncate text-sm font-semibold text-gray-700">{appName}</p>
        {text && <p className={`text-xs font-medium ${textClassName}`}>{text}</p>}
      </div>
      <div className="app-loader-dots flex items-center gap-1.5" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="app-loader-screen flex w-full items-center justify-center p-8">
        {content}
      </div>
    );
  }

  return content;
}
