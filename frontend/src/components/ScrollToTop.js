import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = [
  [/^\/$/, 'Accueil'],
  [/^\/sales(?:\/|$)/, 'Ventes'],
  [/^\/products(?:\/|$)/, 'Produits'],
  [/^\/clients(?:\/|$)/, 'Clients'],
  [/^\/bank(?:\/|$)/, 'Caisse'],
  [/^\/inventory-v2(?:\/|$)/, 'Inventaire'],
  [/^\/purchasing(?:\/|$)/, 'Achats'],
  [/^\/expenses(?:\/|$)/, 'Dépenses'],
  [/^\/employees(?:\/|$)/, 'Employés'],
  [/^\/settings(?:\/|$)/, 'Paramètres'],
  [/^\/support(?:\/|$)/, 'Assistance'],
  [/^\/login$/, 'Connexion'],
];

const getPageTitle = (pathname) => {
  const match = PAGE_TITLES.find(([pattern]) => pattern.test(pathname));
  return match ? `${match[1]} | ETS HD Gestion` : 'ETS HD Gestion';
};

/**
 * Scrolls to top of the page on every route change (menu links, etc.).
 * Works on both mobile and desktop.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.title = getPageTitle(pathname);

    // Give keyboard and assistive-technology users a stable landmark after a
    // client-side route change without stealing focus from form submissions.
    const main = document.querySelector('main[tabindex="-1"]');
    if (main && document.activeElement === document.body) {
      main.focus({ preventScroll: true });
    }
  }, [pathname]);

  return null;
}
