import React, { useState, useContext, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Menu } from "lucide-react";
import { clientPath, productPath, employeeBasePath } from "../utils/paths";
import { useAppSettings } from "../context/AppSettingsContext";
import { mixHexColors, resolveAppLogo } from "../utils/appBranding";

const Navigation = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [autresOpen, setAutresOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const branding = appSettings.branding;
  const logoUrl = resolveAppLogo(branding.logoUrl);
  const brandTint = mixHexColors(branding.primaryColor, 0.88);
  const userInitial = auth.user?.name?.charAt(0)?.toUpperCase() || "U";
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setIsMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!isDesktop && isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => { document.body.style.overflow = ""; document.body.style.touchAction = ""; };
  }, [isDesktop, isMenuOpen]);
  useEffect(() => {
    const onEscape = (e) => { if (e.key === "Escape") setIsMenuOpen(false); };
    if (isMenuOpen) { document.addEventListener("keydown", onEscape); return () => document.removeEventListener("keydown", onEscape); }
  }, [isMenuOpen]);

  // === Déconnexion ===
  const handleLogout = () => {
    localStorage.removeItem("token");
    try {
      sessionStorage.removeItem("accessRestrictionInfo");
    } catch (error) {
      console.error("Unable to clear restriction info", error);
    }
    setAuth({
      isAuthenticated: false,
      user: null,
      isAdmin: false,
      isLoading: false,
    });
    setIsMenuOpen(false);
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  // === Recherche Globale ===
  useEffect(() => {
    const fetchResults = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(res.data.results || []);
      } catch (err) {
        console.error("Erreur recherche globale :", err);
      }
    };
    const delay = setTimeout(fetchResults, 400);
    return () => clearTimeout(delay);
  }, [query]);

  const openPath = (path) => {
    if (isDesktop && typeof window !== "undefined") {
      window.open(path, "_blank", "noopener,noreferrer");
    } else {
      navigate(path);
    }
  };

  const handleSelectResult = (item) => {
    setQuery("");
    setResults([]);
    switch (item.type) {
      case "client":
        openPath(clientPath(item));
        break;
      case "product":
        openPath(productPath(item));
        break;
      case "sale":
        openPath(`/sales/${item._id}`);
        break;
      case "employee":
        navigate(employeeBasePath(item));
        break;
      default:
        navigate("/");
    }
  };

  const showSearchBar = auth.isAuthenticated && auth.isAdmin; // ✅ Seuls les admins connectés

  return (
    <nav className="surface-bar sticky top-0 z-50 nav-safe-top border-b border-gray-200/70 shadow-sm">
      <div className="mx-auto max-w-[1600px] px-3 py-2 sm:px-4">
        <div className="flex min-h-[58px] items-center gap-3">
          {/* === Logo === */}
          <Link
            to="/"
            className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-gray-100/70"
            onClick={closeMenu}
          >
            <img
              src={logoUrl}
              alt={branding.shortName || branding.appName}
              className="h-10 w-10 shrink-0 rounded-xl border border-gray-200/80 bg-white object-contain shadow-apple-sm"
            />
            <div className="hidden min-w-0 lg:block">
              <span className="block truncate text-[17px] font-semibold tracking-tight text-gray-900">
                {branding.appName}
              </span>
              {branding.tagline && (
                <span className="block truncate text-[11px] text-gray-500">
                  {branding.tagline}
                </span>
              )}
            </div>
          </Link>

          {/* === Menu desktop === */}
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-visible px-1 md:flex">
            {renderNavigationLinks(auth, handleLogout, closeMenu, false, false, autresOpen, setAutresOpen)}
          </div>

          {/* === Profil & Actions === */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {auth.isAuthenticated && (
              <>
                <Link
                  to="/profile"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200/80 bg-gray-50 transition-colors duration-apple ease-apple hover:bg-gray-100"
                  onClick={closeMenu}
                  aria-label="Profil"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                    {auth.user?.photo ? (
                      <img src={auth.user.photo} alt={auth.user.name || "Profil"} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-700 font-medium text-sm">
                        {userInitial}
                      </span>
                    )}
                  </div>
                </Link>
              </>
            )}

            {!isDesktop && (
              <button
                onClick={toggleMenu}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-gray-600 transition-colors duration-apple ease-apple hover:bg-gray-50 hover:text-gray-900 focus:outline-none active:bg-gray-100"
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            )}
          </div>
        </div>

        {showSearchBar && (
          <div className="mt-2 hidden md:block">
            <GlobalSearchBar
              query={query}
              setQuery={setQuery}
              results={results}
              onSelectResult={handleSelectResult}
              className="mx-auto w-full max-w-3xl"
            />
          </div>
        )}

        {/* === Barre de recherche mobile === */}
        {showSearchBar && (
          <GlobalSearchBar
            query={query}
            setQuery={setQuery}
            results={results}
            onSelectResult={handleSelectResult}
            className="md:hidden mt-3 w-full"
            isMobile
          />
        )}

        {/* Backdrop: tap outside to close (mobile only) */}
        {!isDesktop && isMenuOpen && (
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={closeMenu}
            className="md:hidden fixed inset-0 z-40 bg-[#f2f2f7]/95"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}

        {/* === Menu mobile: card sections, app background === */}
        <div
          className={`md:hidden relative z-[51] overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
            isMenuOpen ? "max-h-[80vh] opacity-100 visible" : "max-h-0 opacity-0 invisible pointer-events-none"
          }`}
        >
          <div
            className="overflow-y-auto overflow-x-hidden py-4 px-3 mt-2 rounded-2xl border border-gray-200/80 shadow-sm touch-manipulation bg-[#f2f2f7]"
            style={{
              paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
              WebkitOverflowScrolling: "touch",
              maxHeight: "80vh",
            }}
          >
            {auth.isAuthenticated && (
              <div
                className="mb-3 flex min-h-[56px] items-center gap-3 rounded-xl border border-gray-200/60 px-4 py-3 shadow-sm"
                style={{ backgroundColor: brandTint }}
              >
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                  {auth.user?.photo ? (
                    <img src={auth.user.photo} alt={auth.user.name || 'Profil'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-700 font-semibold text-base">{userInitial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{auth.user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{auth.user?.email}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-0">
              {renderNavigationLinks(auth, handleLogout, closeMenu, true, true, false, () => {})}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

// === Mobile menu: section card (efficient grouping) ===
const MobileMenuSection = ({ title, children }) => (
  <div className="bg-white/95 rounded-xl border border-gray-200/70 shadow-sm overflow-hidden mb-3 last:mb-0">
    <div className="px-3.5 pt-2.5 pb-1">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
    </div>
    <div className="flex flex-col pb-1">{children}</div>
  </div>
);

// === Liens du menu (desktop + mobile) ===
const renderNavigationLinks = (auth, handleLogout, closeMenu, isMobile = false, hidePrimaryTabsOnMobile = false, autresOpen = false, setAutresOpen = () => {}) => {
  const linkClass = isMobile
    ? "group/nav flex min-h-[48px] w-full items-center rounded-lg px-3.5 py-2.5 text-[15px] font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
    : "group/nav relative flex h-[58px] min-w-[72px] max-w-[96px] items-center justify-center rounded-xl px-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100/80 hover:text-gray-950";

  const iconClass = isMobile
    ? "h-5 w-5 shrink-0 text-gray-500"
    : "h-5 w-5 shrink-0 text-gray-500 transition-colors group-hover/nav:text-gray-800";

  const showPrimaryTabs = !(isMobile && hidePrimaryTabsOnMobile);

  return auth.isAuthenticated ? (
    <>
      {showPrimaryTabs && (
        <>
      {/* === Ventes === */}
      <NavIcon
        to="/sales"
        icon={
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        }
        label="Ventes"
        className={linkClass}
        onClick={closeMenu}
        isMobile={isMobile}
        openInNewTab={!isMobile}
      />
      <NavIcon
        to="/bank"
        icon={
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M3 10h18M5 10V7l7-4 7 4v3M5 10v8m4-8v8m4-8v8m4-8v8M3 18h18"
            />
          </svg>
        }
        label="Caisse"
        className={linkClass}
        onClick={closeMenu}
        isMobile={isMobile}
        openInNewTab={!isMobile}
      />

      {/* === Clients === */}
      <NavIcon
        to="/clients"
        icon={
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        }
        label="Clients"
        className={linkClass}
        onClick={closeMenu}
        isMobile={isMobile}
        openInNewTab={!isMobile}
      />
      
      <NavIcon
            to="/products"
            icon={
              <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
            label="Produits"
            className={linkClass}
            onClick={closeMenu}
            isMobile={isMobile}
            openInNewTab={!isMobile}
          />
          {/* Desktop: Dépenses then Autres dropdown */}
          {!isMobile && (
            <NavIcon
              to="/expenses"
              icon={
                <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              }
              label="Dépenses"
              className={linkClass}
              onClick={closeMenu}
              isMobile={isMobile}
              openInNewTab={!isMobile}
            />
          )}
          {!isMobile && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAutresOpen((o) => !o)}
                className={`${linkClass} ${autresOpen ? "bg-gray-100 text-gray-950" : ""}`}
                aria-expanded={autresOpen}
                aria-haspopup="true"
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="max-w-full truncate text-[11px] font-medium leading-tight text-gray-500 group-hover/nav:text-gray-800">Autres</span>
                </div>
              </button>
              <AnimatePresence>
                {autresOpen && (
                  <>
                    <div className="fixed inset-0 z-[55]" aria-hidden onClick={() => setAutresOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 top-full z-[60] mt-2 w-[min(95vw,560px)] rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xl"
                    >
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {/* Colonne gauche */}
                        <div className="space-y-3">
                          {auth.isAdmin && (
                            <>
                              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Utilisateurs</div>
                              <Link to="/users/stats" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2 font-medium" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dashboard Utilisateurs</Link>
                            </>
                          )}
                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-0.5">Employés</div>
                          <div className="space-y-0.5">
                            <Link to="/employees" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2 font-medium" onClick={() => { closeMenu(); setAutresOpen(false); }}>Employés</Link>
                            <Link to="/employees/new" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Nouvel employé</Link>
                          </div>
                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-0.5">Ventes</div>
                          <div className="space-y-0.5">
                            <Link to="/sales#sale-form" className="block py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md px-2 -mx-2 font-medium" onClick={() => { closeMenu(); setAutresOpen(false); }}>Enregistrer une vente</Link>
                            <Link to="/sales" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Liste des ventes</Link>
                            <Link to="/sales/all" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Archives ventes</Link>
                            <Link to="/sales/all?history=1&paymentStructure=full_payment" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paiement complet</Link>
                            <Link to="/sales/all?history=1&paymentStructure=multiple_payments" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paiements multiples</Link>
                            <Link to="/sales/partially-paid" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paiements partiels</Link>
                            {auth.isAdmin && <Link to="/sales/deleted" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Ventes supprimées</Link>}
                          </div>
                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-0.5">Clients</div>
                          <div className="space-y-0.5">
                            <Link to="/clients" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Liste des clients</Link>
                            <Link to="/clients/dashboard" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Tableau de bord clients</Link>
                          </div>
                        </div>
                        {/* Colonne droite */}
                        <div className="space-y-3">
                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Produits</div>
                          <div className="space-y-0.5">
                            <Link to="/products" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Catalogue produits</Link>
                            {auth.isAdmin && (
                              <>
                                <Link to="/product-dashboard" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dashboard Produits</Link>
                                <Link to="/products/never-sold" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Jamais vendus</Link>
                                <Link to="/products/top-sellers" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Meilleures ventes</Link>
                                <Link to="/products/critical" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Stock critique</Link>
                                <Link to="/products/out-of-stock" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Rupture de stock</Link>
                                <Link to="/products/by-supplier" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Par fournisseur</Link>
                                <Link to="/products/by-container" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Par conteneur</Link>
                                <Link to="/products/by-warehouse" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Par entrepôt</Link>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-0.5">Autres</div>
                          <div className="space-y-0.5">
                            <Link to="/bank" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Caisse</Link>
                            <Link to="/expenses" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dépenses</Link>
                            {auth.isAdmin && <Link to="/expenses/monthly-plan" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Objectif mensuel</Link>}
                          </div>
                          {auth.isAdmin && (
                            <>
                              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-0.5">Administration</div>
                              <div className="space-y-0.5">
                                <Link to="/settings" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paramètres</Link>
                                <Link to="/users/stats" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dashboard Utilisateurs</Link>
                                <Link to="/admin/users" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Gestion utilisateurs</Link>
                                <Link to="/users/login-stats" className="block py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Historique connexions</Link>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {isMobile && hidePrimaryTabsOnMobile && (
        <div className="space-y-1">
          <MobileMenuSection title="Principal">
            <NavIcon to="/" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} label="Accueil" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/profile" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} label="Mon profil" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            {auth.isAdmin && <NavIcon to="/users/stats" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 13h8V3H3zm10 8h8V11h-8zm0-8h8V3h-8zM3 21h8v-6H3z" /></svg>} label="Dashboard Utilisateurs" className={linkClass} onClick={closeMenu} isMobile={isMobile} />}
          </MobileMenuSection>
          <MobileMenuSection title="Ventes">
            <NavIcon to="/sales#sale-form" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>} label="Enregistrer une vente" className={`${linkClass} text-indigo-600 hover:bg-indigo-50/80 active:bg-indigo-100/60`} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} label="Liste des ventes" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/all" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} label="Archives" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/all?history=1&paymentStructure=full_payment" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" /></svg>} label="Paiement complet" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/all?history=1&paymentStructure=multiple_payments" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h8M8 12h8M8 17h5" /></svg>} label="Paiements multiples" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/partially-paid" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Paiements partiels" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            {auth.isAdmin && <NavIcon to="/sales/deleted" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} label="Ventes supprimées" className={linkClass} onClick={closeMenu} isMobile={isMobile} />}
          </MobileMenuSection>
          <MobileMenuSection title="Caisse & Dépenses">
            <NavIcon to="/bank" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M5 10V7l7-4 7 4v3M5 10v8m4-8v8m4-8v8m4-8v8M3 18h18" /></svg>} label="Caisse" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/expenses" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>} label="Dépenses" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            {auth.isAdmin && <NavIcon to="/expenses/monthly-plan" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 3a1 1 0 012 0v1.07A8.001 8.001 0 112.07 15H1a1 1 0 110-2h2a1 1 0 011 1 6 6 0 106-6 1 1 0 01-1-1V3zm1 5a1 1 0 011 1v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 0112 13V9a1 1 0 011-1z" /></svg>} label="Objectif mensuel" className={linkClass} onClick={closeMenu} isMobile={isMobile} />}
          </MobileMenuSection>
          <MobileMenuSection title="Clients">
            <NavIcon to="/clients" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Liste des clients" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/clients/dashboard" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} label="Tableau de bord clients" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
          </MobileMenuSection>
          <MobileMenuSection title="Produits">
            <NavIcon to="/products" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} label="Catalogue" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            {auth.isAdmin && (
              <>
                <NavIcon to="/product-dashboard" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>} label="Dashboard Produits" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
                <NavIcon to="/products/never-sold" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} label="Jamais vendus" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
                <NavIcon to="/products/top-sellers" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} label="Meilleures ventes" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
                <NavIcon to="/products/critical" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} label="Stock critique" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
                <NavIcon to="/products/out-of-stock" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>} label="Rupture de stock" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
                <NavIcon to="/products/by-supplier" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} label="Par fournisseur" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
                <NavIcon to="/products/by-container" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} label="Par conteneur" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
                <NavIcon to="/products/by-warehouse" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>} label="Par entrepôt" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              </>
            )}
          </MobileMenuSection>
          <MobileMenuSection title="Employés">
            <NavIcon to="/employees" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} label="Liste des employés" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/employees/new" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>} label="Nouvel employé" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
          </MobileMenuSection>
          {auth.isAdmin && (
            <MobileMenuSection title="Administration">
              <NavIcon to="/admin/users" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} label="Gestion utilisateurs" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              <NavIcon to="/users/login-stats" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>} label="Historique connexions" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              <NavIcon to="/documents" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} label="Documents entreprise" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            </MobileMenuSection>
          )}
        </div>
      )}

      {/* === Admin uniquement (desktop only; on mobile these are in the dropdown sections above) === */}
      {auth.isAdmin && !(isMobile && hidePrimaryTabsOnMobile) && (
        <>
          <NavIcon
            to="/product-dashboard"
            icon={
              <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
            }
            label="Dashboard Produits"
            className={linkClass}
            onClick={closeMenu}
            isMobile={isMobile}
          />
          <NavIcon
        to="/users/stats"
        icon={
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M3 13h8V3H3zm10 8h8V11h-8zm0-8h8V3h-8zM3 21h8v-6H3z"
            />
          </svg>
        }
        label="Dashboard Utilisateurs"
        className={linkClass}
        onClick={closeMenu}
        isMobile={isMobile}
      />

          <NavIcon
            to="/employees"
            icon={
              <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            }
            label="Employés"
            className={linkClass}
            onClick={closeMenu}
            isMobile={isMobile}
          />

        </>
      )}

      {/* === Déconnexion === */}
      <button
        onClick={handleLogout}
        className={`${linkClass} text-red-600 hover:bg-red-50/80 active:bg-red-100/60`}
        aria-label="Déconnexion"
      >
        <div className={`flex ${isMobile ? "flex-row items-center" : "flex-col items-center"}`}>
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          {isMobile && <span>Déconnexion</span>}
        </div>
      </button>
    </>
  ) : (
    <Link to="/login" className={linkClass} onClick={closeMenu}>
      <div className={`flex ${isMobile ? "flex-row items-center" : "flex-col items-center"}`}>
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
          />
        </svg>
        {isMobile && <span>Connexion</span>}
      </div>
    </Link>
  );
};

// === Composant lien icône ===
const NavIcon = ({ to, icon, label, className, onClick, isMobile, openInNewTab = false }) => {
  const location = useLocation();
  const target = String(to || "");
  const cleanPath = target.split(/[?#]/)[0];
  const currentWithSearch = `${location.pathname}${location.search}`;
  const currentWithHash = `${location.pathname}${location.hash}`;
  const isActive = target.includes("?")
    ? currentWithSearch === target
    : target.includes("#")
    ? currentWithHash === target
    : location.pathname === cleanPath;
  const activeClass = isMobile
    ? "bg-indigo-50 text-indigo-700"
    : "bg-gray-100 text-gray-950";

  return (
    <Link
      to={to}
      className={`${className} ${isActive ? activeClass : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      title={label}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
    >
      <div className={`flex w-full ${isMobile ? "flex-row items-center" : "h-full flex-col items-center justify-center gap-1 text-center"}`}>
        <span className={isMobile ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100/80" : "flex h-6 w-6 items-center justify-center"}>
          {icon}
        </span>
        {isMobile && <span className="ml-3 min-w-0 flex-1 truncate">{label}</span>}
        {!isMobile && (
          <span className="max-w-full truncate text-[11px] font-medium leading-tight text-gray-500 transition-colors group-hover/nav:text-gray-800">
            {label}
          </span>
        )}
      </div>
      {!isMobile && isActive && (
        <span className="absolute bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-indigo-500" />
      )}
    </Link>
  );
};

const GlobalSearchBar = ({ query, setQuery, results, onSelectResult, className = "", isMobile = false }) => (
  <div className={`relative ${className}`}>
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Rechercher produits, clients, ventes..."
      className={`w-full pl-10 pr-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-400 ${
        isMobile ? "py-2.5 shadow-sm" : "py-2"
      }`}
    />
    <Search
      className={`absolute left-3 ${isMobile ? "top-3" : "top-2.5"} text-gray-400 w-5 h-5`}
    />
    {query && (
      <button
        onClick={() => setQuery("")}
        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        aria-label="Effacer la recherche"
      >
        <X size={18} />
      </button>
    )}

    <AnimatePresence>
      {results.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute z-50 bg-white w-full mt-2 rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-72 overflow-y-auto"
        >
          {results.map((item) => {
            const isProduct = item.type === "product";
            return (
              <li
                key={item._id}
                onClick={() => onSelectResult(item)}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  {isProduct && item.image ? (
                    <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-sm">
                      {item.type === "client" ? "👤" : item.type === "employee" ? "👥" : "📄"}
                    </div>
                  )}
                  <span className="font-medium text-gray-800">
                    {item.name || item.clientName || item.title}
                  </span>
                </div>
                <span className="text-xs text-gray-500 capitalize">{item.type}</span>
              </li>
            );
          })}
        </motion.ul>
      )}
    </AnimatePresence>
  </div>
);

export default Navigation;
