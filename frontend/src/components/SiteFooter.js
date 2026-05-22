import React from 'react';
import { useAppSettings } from '../context/AppSettingsContext';

const currentYear = new Date().getFullYear();

const SiteFooter = () => {
  const { appSettings } = useAppSettings();
  const { footerText, supportPhone, supportEmail } = appSettings.branding;

  return (
    <footer className="surface-bar border-t border-gray-200/50">
      <div className="container mx-auto px-4 py-4 text-center text-[13px] text-gray-500">
        <p>© {currentYear} {footerText}</p>
        {(supportPhone || supportEmail) && (
          <p className="mt-1 text-[12px] text-gray-400">
            {[supportPhone, supportEmail].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </footer>
  );
};

export default SiteFooter;
