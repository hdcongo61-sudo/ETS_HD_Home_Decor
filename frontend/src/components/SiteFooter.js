import React from 'react';

const currentYear = new Date().getFullYear();

const SiteFooter = () => (
  <footer className="border-t border-gray-200/70 bg-white/80 supports-backdrop-blur:bg-white/60">
    <div className="container mx-auto px-4 py-4 text-center text-xs sm:text-sm text-gray-500">
      © {currentYear} ETS HD Tech Filiale. Tous droits réservés.
    </div>
  </footer>
);

export default SiteFooter;
