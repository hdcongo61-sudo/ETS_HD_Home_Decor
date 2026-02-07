import React from 'react';

const currentYear = new Date().getFullYear();

const SiteFooter = () => (
  <footer className="surface-bar border-t border-gray-200/50">
    <div className="container mx-auto px-4 py-4 text-center text-[13px] text-gray-500">
      © {currentYear} ETS HD Tech Filiale. Tous droits réservés.
    </div>
  </footer>
);

export default SiteFooter;
