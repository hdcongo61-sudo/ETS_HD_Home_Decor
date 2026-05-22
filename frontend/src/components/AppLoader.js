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

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <img
        src={logoUrl}
        alt={appSettings.branding.shortName || appSettings.branding.appName}
        className="app-loader-logo w-14 h-14 md:w-16 md:h-16 rounded-xl object-contain border border-gray-200 shadow-md bg-white"
      />
      {text && (
        <p className={`text-sm font-medium animate-pulse ${textClassName}`}>{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full p-8">
        {content}
      </div>
    );
  }

  return content;
}
