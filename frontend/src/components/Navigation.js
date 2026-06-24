import React, { useState, useContext, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import { FEATURE_KEYS } from "../config/features";
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  FileText,
  LayoutGrid,
  Package,
  Search,
  UserRound,
  X,
  ShoppingCart,
  Landmark,
  Users,
  Receipt,
  BarChart2,
  Archive,
  AlertTriangle,
  TrendingUp,
  Building2,
  ShieldCheck,
  Settings,
  UserCheck,
  FileStack,
  ClipboardList,
  PlusCircle,
  History,
  CreditCard,
  LifeBuoy,
} from "lucide-react";
import { clientPath, productPath, employeeBasePath } from "../utils/paths";
import { useAppSettings } from "../context/AppSettingsContext";
import { useModal } from "../context/ModalContext";
import { mixHexColors, resolveAppLogo } from "../utils/appBranding";

const Navigation = () => {
  const { auth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  // While searching, keep the top bar pinned (the mobile keyboard fires scroll
  // events that would otherwise hide/show the bar and make the page "seek").
  const searchActiveRef = useRef(false);
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
  const { activeModal, areGlobalModalsSuppressed } = useModal();

  // On mobile, any open form — global modal (sale/payment), side panel
  // (produit/client/dépense) or a form page (/new, /edit) — should own the
  // whole screen, so hide the top bar there (desktop keeps it).
  const isFormContext = Boolean(activeModal) || areGlobalModalsSuppressed || /\/(edit|new)(\/|$)/.test(location.pathname);

  useEffect(() => { setIsMenuOpen(false); setQuickAccessOpen(false); }, [location.pathname]);
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

  // Track whether the user is searching (input has text or quick access open).
  useEffect(() => {
    searchActiveRef.current = Boolean(query) || quickAccessOpen;
    if (searchActiveRef.current) setNavHidden(false);
  }, [query, quickAccessOpen]);

  // === Masquer la barre de navigation au défilement (mobile uniquement) ===
  // Vers le bas → cachée ; vers le haut ou près du sommet → visible.
  useEffect(() => {
    if (isDesktop) { setNavHidden(false); return; }
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (isMenuOpen || y < 60 || searchActiveRef.current) {
          setNavHidden(false);
        } else if (delta > 6) {
          setNavHidden(true);
        } else if (delta < -6) {
          setNavHidden(false);
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDesktop, isMenuOpen]);

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
      case "supplier":
        openPath(`/suppliers/${encodeURIComponent(item.name || item.slug || item._id)}`);
        break;
      default:
        navigate("/");
    }
  };

  const showSearchBar = auth.isAuthenticated && auth.isAdmin; // ✅ Seuls les admins connectés

  return (
    <>
    <nav
      className={`sticky top-0 z-50 nav-safe-top border-b border-[var(--colorNeutralStroke2)] fluent-acrylic transition-transform duration-300 ease-out will-change-transform ${isFormContext ? 'hidden md:block' : ''}`}
      style={{ boxShadow: 'var(--shadow2)', transform: navHidden ? 'translateY(-100%)' : 'translateY(0)' }}
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="flex h-[48px] items-center gap-3">
          {/* === Logo === */}
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-md px-0.5 py-0.5 mr-1"
            onClick={closeMenu}
          >
            <img
              src={logoUrl}
              alt={branding.shortName || branding.appName}
              onError={(e) => {
                const fallback = `${process.env.PUBLIC_URL || ''}/logo.png`;
                if (e.currentTarget.src !== window.location.origin + fallback && !e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = '1';
                  e.currentTarget.src = fallback;
                }
              }}
              className="h-7 w-7 shrink-0 rounded-sm border border-[var(--ms-border)] bg-white object-contain"
            />
            <div className="hidden min-w-0 lg:block">
              <span className="block truncate text-[14px] font-semibold text-[var(--ms-text-strong)] leading-tight">
                {branding.appName}
              </span>
            </div>
          </Link>

          {/* Super-admin badge — desktop only */}
          {auth.isSuperAdmin && (
            <Link
              to="/super-admin"
              className="hidden md:flex items-center gap-1.5 rounded-md px-2.5 h-8 text-[12px] font-semibold transition-colors"
              style={{ background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)', border: '1px solid var(--colorStatusWarningStroke1)' }}
              title="Panneau Super Admin"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Super Admin</span>
            </Link>
          )}

          {/* Quick Access button — desktop only (hidden for platform operators) */}
          {auth.isAuthenticated && !(auth.isSuperAdmin && !sessionStorage.getItem('impersonating')) && (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setQuickAccessOpen((o) => !o)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 border text-[13px] font-medium transition-colors ${
                  quickAccessOpen
                    ? 'bg-[var(--colorBrandBackground)] border-[var(--colorBrandBackground)] text-white'
                    : 'border-[var(--colorNeutralStroke2)] bg-transparent text-[var(--colorNeutralForeground2)] hover:bg-[var(--colorNeutralBackground2)]'
                }`}
                aria-label="Accès rapide"
                aria-expanded={quickAccessOpen}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden lg:inline">Accès rapide</span>
              </button>
              <AnimatePresence>
                {quickAccessOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[55]"
                      aria-hidden
                      onClick={() => setQuickAccessOpen(false)}
                    />
                    <QuickAccessPanel
                      auth={auth}
                      onClose={() => setQuickAccessOpen(false)}
                    />
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Desktop: spacer pushes search + profile to the right */}
          <div className="hidden md:block flex-1" />

          {showSearchBar && (
            <GlobalSearchBar
              query={query}
              setQuery={setQuery}
              results={results}
              onSelectResult={handleSelectResult}
              className="hidden w-52 shrink-0 md:block lg:w-60 xl:w-72"
              compact
            />
          )}

          {/* Separator before profile */}
          <div className="hidden md:block w-px h-6 bg-[var(--ms-border)]" />

          {/* === Profil & Actions === */}
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            {showSearchBar && (
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className="md:hidden flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ms-border)] bg-[var(--ms-white)] text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] transition-colors"
                aria-label="Rechercher"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            <Link
              to="/profile"
              onClick={closeMenu}
              className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] hover:bg-[var(--ms-surface-muted)] transition-colors"
              aria-label="Profil"
            >
              {auth.user?.photo ? (
                <img src={auth.user.photo} alt={auth.user.name || "Profil"} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[var(--ms-text)] font-semibold text-xs">{userInitial}</span>
              )}
            </Link>

          </div>
        </div>
      </div>
    </nav>

    {showSearchBar && (
      <MobileSearchOverlay
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        query={query}
        setQuery={setQuery}
        results={results}
        onSelectResult={handleSelectResult}
      />
    )}
    </>
  );
};

// === Mobile menu: section card (efficient grouping) ===
const MobileMenuSection = ({ title, children }) => (
  <div className="mb-2 overflow-hidden rounded-md border border-[var(--ms-border)] last:mb-0">
    <div className="px-3 pb-1 pt-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ms-text-muted)]">{title}</span>
    </div>
    <div className="flex flex-col px-1 pb-1">{children}</div>
  </div>
);

// === Liens du menu (desktop + mobile) ===
export const renderNavigationLinks = (auth, handleLogout, closeMenu, isMobile = false, hidePrimaryTabsOnMobile = false, autresOpen = false, setAutresOpen = () => {}) => {
  const linkClass = isMobile
    ? "group/nav flex min-h-[48px] w-full items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium text-[var(--ms-text)] transition-colors hover:bg-[var(--ms-bg-subtle)] active:bg-[var(--ms-surface-muted)] touch-manipulation"
    : "group/nav relative flex h-[36px] items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-[var(--ms-text)] transition-colors hover:bg-[var(--ms-bg-subtle)] hover:text-[var(--ms-text-strong)]";

  const iconClass = isMobile
    ? "h-[18px] w-[18px] shrink-0 text-[var(--ms-text-muted)] transition-colors group-hover/nav:text-[var(--ms-text)]"
    : "h-[16px] w-[16px] shrink-0 text-[var(--ms-text-muted)] transition-colors group-hover/nav:text-[var(--ms-text-strong)]";

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
          />
          {/* Desktop: Dépenses then Autres dropdown */}
          {!isMobile && auth.isAdmin && (
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
            />
          )}
          {!isMobile && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAutresOpen((o) => !o)}
                className={`${linkClass} ${autresOpen ? "bg-[var(--ms-bg-subtle)] text-[var(--ms-text-strong)]" : ""}`}
                aria-expanded={autresOpen}
                aria-haspopup="true"
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="max-w-full truncate text-[11px] font-medium leading-tight text-[var(--ms-text-muted)] group-hover/nav:text-[var(--ms-text)]">Autres</span>
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
                      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                      className="absolute right-0 top-full z-[60] mt-1.5 w-[min(95vw,560px)] overflow-hidden rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[0_4px_12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)]"
                    >
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {/* Colonne gauche */}
                        <div className="space-y-3">
                          {auth.isAdmin && (
                            <>
                              <div className="text-[10px] font-semibold text-[var(--ms-text-muted)] uppercase tracking-wider">Utilisateurs</div>
                              <Link to="/users/stats" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2 font-medium" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dashboard Utilisateurs</Link>
                            </>
                          )}
                          {auth.isAdmin && (
                            <>
                              <div className="text-[10px] font-semibold text-[var(--ms-text-muted)] uppercase tracking-wider pt-0.5">Employés</div>
                              <div className="space-y-0.5">
                                <Link to="/employees" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2 font-medium" onClick={() => { closeMenu(); setAutresOpen(false); }}>Employés</Link>
                                <Link to="/employees/new" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Nouvel employé</Link>
                              </div>
                            </>
                          )}
                          <div className="text-[10px] font-semibold text-[var(--ms-text-muted)] uppercase tracking-wider pt-0.5">Ventes</div>
                          <div className="space-y-0.5">
                            <Link to="/sales#sale-form" className="block py-1.5 text-sm text-[var(--ms-blue)] hover:bg-[var(--ms-blue-soft)] rounded-md px-2 -mx-2 font-medium" onClick={() => { closeMenu(); setAutresOpen(false); }}>Enregistrer une vente</Link>
                            <Link to="/sales" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Liste des ventes</Link>
                            <Link to="/sales/all" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Archives ventes</Link>
                            <Link to="/sales/all?history=1&paymentStructure=full_payment" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paiement complet</Link>
                            <Link to="/sales/all?history=1&paymentStructure=multiple_payments" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paiements multiples</Link>
                            <Link to="/sales/partially-paid" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paiements partiels</Link>
                            {auth.isAdmin && <Link to="/sales/deleted" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Ventes supprimées</Link>}
                          </div>
                          <div className="text-[10px] font-semibold text-[var(--ms-text-muted)] uppercase tracking-wider pt-0.5">Clients</div>
                          <div className="space-y-0.5">
                            <Link to="/clients" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Liste des clients</Link>

                          </div>
                        </div>
                        {/* Colonne droite */}
                        <div className="space-y-3">
                          <div className="text-[10px] font-semibold text-[var(--ms-text-muted)] uppercase tracking-wider">Produits</div>
                          <div className="space-y-0.5">
                            <Link to="/products" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Catalogue produits</Link>
                            {auth.isAdmin && (
                              <>
                                <Link to="/product-dashboard" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dashboard Produits</Link>
                                <Link to="/products/never-sold" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Jamais vendus</Link>
                                <Link to="/products/top-sellers" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Meilleures ventes</Link>
                                <Link to="/products/critical" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Stock critique</Link>
                                <Link to="/products/out-of-stock" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Rupture de stock</Link>
                                <Link to="/products/by-supplier" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Par fournisseur</Link>
                                <Link to="/products/by-container" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Par conteneur</Link>
                                <Link to="/products/by-warehouse" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Par entrepôt</Link>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] font-semibold text-[var(--ms-text-muted)] uppercase tracking-wider pt-0.5">Autres</div>
                          <div className="space-y-0.5">
                            <Link to="/bank" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Caisse</Link>
                            {auth.isAdmin && <Link to="/expenses" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dépenses</Link>}
                            {auth.isAdmin && <Link to="/expenses/monthly-plan" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Objectif mensuel</Link>}
                            <Link to="/admin-requests" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>{auth.isAdmin ? 'Demandes admin' : 'Mes demandes'}</Link>
                          </div>
                          {auth.isAdmin && (
                            <>
                              <div className="text-[10px] font-semibold text-[var(--ms-text-muted)] uppercase tracking-wider pt-0.5">Administration</div>
                              <div className="space-y-0.5">
                                <Link to="/settings" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Paramètres</Link>
                                <Link to="/support" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Assistance</Link>
                                <Link to="/users/stats" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Dashboard Utilisateurs</Link>
                                <Link to="/admin/users" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Gestion utilisateurs</Link>
                                <Link to="/users/login-stats" className="block py-1.5 text-sm text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] rounded-md px-2 -mx-2" onClick={() => { closeMenu(); setAutresOpen(false); }}>Historique connexions</Link>
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
            <NavIcon to="/admin-requests" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m-9 7h16a2 2 0 002-2V7.5a2 2 0 00-.586-1.414l-3.5-3.5A2 2 0 0016.5 2H4a2 2 0 00-2 2v15a2 2 0 002 2z" /></svg>} label={auth.isAdmin ? "Demandes admin" : "Mes demandes"} className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            {auth.isAdmin && <NavIcon to="/users/stats" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 13h8V3H3zm10 8h8V11h-8zm0-8h8V3h-8zM3 21h8v-6H3z" /></svg>} label="Dashboard Utilisateurs" className={linkClass} onClick={closeMenu} isMobile={isMobile} />}
          </MobileMenuSection>
          <MobileMenuSection title="Ventes">
            <NavIcon to="/sales#sale-form" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>} label="Enregistrer une vente" className={`${linkClass} text-[var(--ms-blue)] hover:bg-[var(--ms-blue-soft)]/80 active:bg-[var(--ms-blue-soft)]`} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} label="Liste des ventes" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/all" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} label="Archives" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/all?history=1&paymentStructure=full_payment" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" /></svg>} label="Paiement complet" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/all?history=1&paymentStructure=multiple_payments" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h8M8 12h8M8 17h5" /></svg>} label="Paiements multiples" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            <NavIcon to="/sales/partially-paid" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Paiements partiels" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            {auth.isAdmin && <NavIcon to="/sales/deleted" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} label="Ventes supprimées" className={linkClass} onClick={closeMenu} isMobile={isMobile} />}
          </MobileMenuSection>
          <MobileMenuSection title="Caisse & Dépenses">
            <NavIcon to="/bank" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M5 10V7l7-4 7 4v3M5 10v8m4-8v8m4-8v8m4-8v8M3 18h18" /></svg>} label="Caisse" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            {auth.isAdmin && <NavIcon to="/expenses" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>} label="Dépenses" className={linkClass} onClick={closeMenu} isMobile={isMobile} />}
            {auth.isAdmin && <NavIcon to="/expenses/monthly-plan" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 3a1 1 0 012 0v1.07A8.001 8.001 0 112.07 15H1a1 1 0 110-2h2a1 1 0 011 1 6 6 0 106-6 1 1 0 01-1-1V3zm1 5a1 1 0 011 1v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 0112 13V9a1 1 0 011-1z" /></svg>} label="Objectif mensuel" className={linkClass} onClick={closeMenu} isMobile={isMobile} />}
          </MobileMenuSection>
          <MobileMenuSection title="Clients">
            <NavIcon to="/clients" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Liste des clients" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
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
          {auth.isAdmin && (
            <MobileMenuSection title="Employés">
              <NavIcon to="/employees" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} label="Liste des employés" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              <NavIcon to="/employees/new" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>} label="Nouvel employé" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            </MobileMenuSection>
          )}
          {auth.isAdmin && (
            <MobileMenuSection title="Administration">
              <NavIcon to="/settings" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.757.426 1.757 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.757-2.924 1.757-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.757-.426-1.757-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Paramètres" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              <NavIcon to="/admin-requests" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m-9 7h16a2 2 0 002-2V7.5a2 2 0 00-.586-1.414l-3.5-3.5A2 2 0 0016.5 2H4a2 2 0 00-2 2v15a2 2 0 002 2z" /></svg>} label="Demandes admin" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              <NavIcon to="/admin/users" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} label="Gestion utilisateurs" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              <NavIcon to="/users/login-stats" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>} label="Historique connexions" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
              <NavIcon to="/documents" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} label="Documents entreprise" className={linkClass} onClick={closeMenu} isMobile={isMobile} />
            </MobileMenuSection>
          )}

          {/* === Super Admin section (mobile) === */}
          {auth.isSuperAdmin && (
            <MobileMenuSection title="Super Admin">
              <Link
                to="/super-admin"
                onClick={closeMenu}
                className={`${linkClass} text-[var(--colorStatusWarningForeground1)] hover:bg-[var(--colorStatusWarningBackground1)]`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--colorStatusWarningBackground1)]`}>
                  <ShieldCheck className="h-[18px] w-[18px]" style={{ color: 'var(--colorStatusWarningForeground1)' }} />
                </span>
                <span className="ml-3 min-w-0 flex-1 truncate font-semibold">Gestion boutiques</span>
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className={linkClass}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-100/90 text-[var(--ms-text)]`}>
                  <Building2 className="h-[18px] w-[18px]" />
                </span>
                <span className="ml-3 min-w-0 flex-1 truncate">Nouvelle boutique</span>
              </Link>
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

      {auth.isAdmin && (
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
      )}

        </>
      )}

      {/* === Déconnexion === */}
      <button
        onClick={handleLogout}
        className={
          isMobile
            ? "mt-3 flex min-h-[52px] w-full items-center rounded-[22px] border border-red-100 bg-red-50 px-3.5 py-3 text-[15px] font-semibold text-red-700 shadow-sm transition-all duration-200 hover:bg-red-100 active:scale-[0.99] active:bg-red-100 touch-manipulation"
            : `${linkClass} text-red-600 hover:bg-red-50/80 active:bg-red-100/60`
        }
        aria-label="Déconnexion"
      >
        <div className={`flex w-full ${isMobile ? "flex-row items-center gap-3" : "flex-col items-center"}`}>
          <span className={isMobile ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-red-600" : ""}>
          <svg
            className={isMobile ? "h-5 w-5 shrink-0" : iconClass}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          </span>
          {isMobile && <span className="min-w-0 flex-1 text-left">Déconnexion</span>}
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
    ? "bg-gray-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)]"
    : "bg-gray-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.13)] hover:bg-gray-950 hover:text-white";
  const renderedIcon = React.isValidElement(icon)
    ? React.cloneElement(icon, {
        className: `${icon.props.className || ""} ${isActive ? "!text-white" : ""}`,
      })
    : icon;

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
        <span className={isMobile ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isActive ? "bg-white/16 text-white" : "bg-gray-100/90 text-[var(--ms-text)]"}` : "flex h-6 w-6 items-center justify-center"}>
          {renderedIcon}
        </span>
        {isMobile && <span className="ml-3 min-w-0 flex-1 truncate">{label}</span>}
        {!isMobile && (
          <span className={`max-w-full truncate text-[11px] font-medium leading-tight transition-colors ${isActive ? "text-white" : "text-[var(--ms-text-muted)] group-hover/nav:text-[var(--ms-text)]"}`}>
            {label}
          </span>
        )}
      </div>
      {!isMobile && isActive && (
        <span className="absolute bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-white/85" />
      )}
    </Link>
  );
};

/* ═══════════════════════════════════════════
   QUICK ACCESS PANEL — Fluent 2 Mega-Menu
   ═══════════════════════════════════════════ */
const QA_GROUPS = (auth, hasFeature = () => true) => ([
  {
    label: 'Ventes',
    items: [
      { to: '/sales#sale-form', icon: PlusCircle,   label: 'Nouvelle vente',        highlight: true },
      { to: '/sales',           icon: ShoppingCart,  label: 'Liste des ventes' },
      { to: '/sales/all',       icon: History,       label: 'Archives ventes' },
      { to: '/sales/partially-paid', icon: CreditCard, label: 'Paiements partiels' },
      ...(auth.isAdmin ? [{ to: '/sales/deleted', icon: Archive, label: 'Ventes supprimées' }] : []),
    ],
  },
  {
    label: 'Produits',
    items: [
      { to: '/products',        icon: Package,       label: 'Catalogue produits' },
      ...(auth.isAdmin ? [
        { to: '/product-dashboard', icon: BarChart2, label: 'Dashboard produits' },
        { to: '/products/top-sellers', icon: TrendingUp, label: 'Meilleures ventes' },
        { to: '/products/critical',    icon: AlertTriangle, label: 'Stock critique' },
        { to: '/products/out-of-stock',icon: AlertTriangle, label: 'Rupture de stock' },
        { to: '/products/by-supplier', icon: Building2, label: 'Par fournisseur' },
      ] : []),
    ],
  },
  {
    label: 'Clients',
    items: [
      { to: '/clients',           icon: Users,         label: 'Liste des clients' },
      ...(auth.isAdmin ? [{ to: '/clients/loyalty', icon: Award, label: 'Fidélité', feature: FEATURE_KEYS.LOYALTY }] : []),
    ],
  },
  ...(auth.isAdmin ? [{
    label: 'Employés',
    items: [
      { to: '/employees',     icon: BriefcaseBusiness, label: 'Liste des employés', feature: FEATURE_KEYS.EMPLOYEES_PAYROLL },
      { to: '/employees/new', icon: PlusCircle,        label: 'Nouvel employé',     feature: FEATURE_KEYS.EMPLOYEES_PAYROLL },
    ],
  }] : []),
  ...(auth.isAdmin ? [
    {
      label: 'Finances',
      items: [
        { to: '/bank',                  icon: Landmark,  label: 'Caisse', feature: FEATURE_KEYS.BANK },
        { to: '/expenses',              icon: Receipt,   label: 'Dépenses' },
        { to: '/expenses/monthly-plan', icon: ClipboardList, label: 'Objectif mensuel', feature: FEATURE_KEYS.MONTHLY_SPENDING_PLAN },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: '/settings',       icon: Settings,   label: 'Paramètres' },
        { to: '/support',        icon: LifeBuoy,   label: 'Assistance' },
        { to: '/admin/users',    icon: UserCheck,  label: 'Gestion utilisateurs' },
        { to: '/users/stats',    icon: BarChart2,  label: 'Dashboard utilisateurs' },
        { to: '/documents',      icon: FileStack,  label: 'Documents', feature: FEATURE_KEYS.DOCUMENTS },
        { to: '/admin-requests', icon: FileText,   label: 'Demandes admin' },
      ],
    },
  ] : [
    {
      label: 'Autres',
      items: [
        { to: '/bank',           icon: Landmark,      label: 'Caisse', feature: FEATURE_KEYS.BANK },
        { to: '/admin-requests', icon: ClipboardList, label: 'Mes demandes' },
      ],
    },
  ]),
]).map((g) => ({ ...g, items: g.items.filter((it) => !it.feature || hasFeature(it.feature)) }));

const QuickAccessPanel = ({ auth, onClose }) => {
  const { hasFeature } = useContext(AuthContext);
  const groups = QA_GROUPS(auth, hasFeature).filter(g => g.items.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      className="absolute left-0 top-[calc(100%+6px)] z-[60] w-[min(96vw,640px)] overflow-hidden rounded-[var(--radiusXLarge)]"
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'saturate(180%) blur(16px)',
        WebkitBackdropFilter: 'saturate(180%) blur(16px)',
        border: '1px solid var(--colorNeutralStroke2)',
        boxShadow: 'var(--shadow28)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
        <span className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>
          Accès rapide
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radiusMedium)] transition-colors"
          style={{ color: 'var(--colorNeutralForeground3)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--colorNeutralBackground3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          aria-label="Fermer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Groups grid */}
      <div
        className="grid p-4 gap-x-6 gap-y-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
      >
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p
              className="fui-caption1-strong uppercase px-2 pb-1"
              style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}
            >
              {group.label}
            </p>
            {group.items.map(({ to, icon: Icon, label, highlight }) => (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-[var(--radiusLarge)] px-2 py-2 text-[13px] font-medium transition-colors"
                style={{
                  color: highlight ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground2)',
                  background: 'transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = highlight ? 'var(--ms-blue-soft)' : 'var(--colorNeutralBackground2)';
                  e.currentTarget.style.color = highlight ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = highlight ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground2)';
                }}
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const SEARCH_RESULT_META = {
  product: {
    label: "Produit",
    icon: Package,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  client: {
    label: "Client",
    icon: UserRound,
    tone: "bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)] ring-[var(--ms-blue-soft)]",
  },
  sale: {
    label: "Vente",
    icon: FileText,
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  employee: {
    label: "Employé",
    icon: BriefcaseBusiness,
    tone: "bg-gray-100 text-[var(--ms-text)] ring-gray-200",
  },
  supplier: {
    label: "Fournisseur",
    icon: Package,
    tone: "bg-orange-50 text-orange-700 ring-orange-100",
  },
  default: {
    label: "Résultat",
    icon: Search,
    tone: "bg-gray-100 text-[var(--ms-text)] ring-gray-200",
  },
};

const getResultTitle = (item) =>
  item?.name || item?.clientName || item?.title || item?.saleNumber || "Résultat sans nom";

const getResultDescription = (item) => {
  if (!item) return "";
  if (item.type === "product") {
    return `Stock: ${Number(item.stock || 0).toLocaleString("fr-FR")}`;
  }
  if (item.type === "client") {
    return item.phone || item.email || "Fiche client";
  }
  if (item.type === "sale") {
    return item.totalAmount
      ? `${Number(item.totalAmount || 0).toLocaleString("fr-FR")} CFA`
      : "Détail de vente";
  }
  if (item.type === "employee") {
    return item.role || item.position || item.phone || "Fiche employé";
  }
  if (item.type === "supplier") {
    return item.phone || "Fiche fournisseur";
  }
  return item.type || "";
};

// Keep the window from jumping (scroll-padding-top makes the browser pull the
// focused field — which lives in the sticky top bar — to the top of the page).
const keepScroll = (fn) => (e) => {
  const y = window.scrollY;
  fn?.(e);
  requestAnimationFrame(() => {
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y });
  });
};

// === Élément de résultat de recherche (partagé : barre desktop + overlay mobile) ===
const SearchResultItem = ({ item, onSelect }) => {
  const isProduct = item.type === "product";
  const meta = SEARCH_RESULT_META[item.type] || SEARCH_RESULT_META.default;
  const ResultIcon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group/search flex w-full items-center gap-3 rounded-[18px] border border-gray-200 bg-white px-3 py-2.5 text-left shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-gray-300 hover:bg-[var(--ms-bg-subtle)] active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 text-[var(--ms-text)]">
        {isProduct && item.image ? (
          <img src={item.image} alt={item.name || "Produit"} className="h-full w-full object-cover" />
        ) : (
          <ResultIcon className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900">
          {getResultTitle(item)}
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[var(--ms-text-muted)]">
          {getResultDescription(item)}
        </span>
      </span>
      <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 sm:inline-flex ${meta.tone}`}>
        {meta.label}
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover/search:text-[var(--ms-text-muted)]" aria-hidden="true" />
    </button>
  );
};

const GlobalSearchBar = ({ query, setQuery, results, onSelectResult, className = "", isMobile = false, compact = false }) => (
  <div className={`relative ${className}`}>
    <input
      type="text"
      value={query}
      onChange={keepScroll((e) => setQuery(e.target.value))}
      onFocus={keepScroll()}
      placeholder={isMobile ? "Rechercher produits, clients, ventes..." : "Recherche rapide"}
      aria-label="Recherche globale"
      className={`w-full rounded-2xl border border-gray-200/90 bg-white/92 pl-9 pr-9 text-sm font-medium text-[var(--ms-text)] shadow-[0_8px_24px_rgba(15,23,42,0.05)] outline-none transition-all placeholder:text-[var(--ms-text-muted)] focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-900/5 ${
        isMobile ? "py-3" : compact ? "py-2" : "py-2.5"
      }`}
    />
    <Search
      className={`absolute left-3 ${isMobile ? "top-3" : compact ? "top-2.5" : "top-2.5"} h-4 w-4 text-[var(--ms-text-muted)]`}
    />
    {query && (
      <button
        onClick={() => setQuery("")}
        className={`absolute right-3 ${isMobile ? "top-3" : compact ? "top-2.5" : "top-2.5"} text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]`}
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
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
          className={`absolute ${isMobile ? "left-0 right-0 w-full" : "right-0 w-[min(420px,90vw)]"} z-[80] mt-2 max-h-[min(70vh,360px)] overflow-y-auto overscroll-contain rounded-[24px] border border-gray-200 bg-[#f7f6f3] p-2 shadow-[0_28px_80px_rgba(15,23,42,0.28)] ring-1 ring-gray-950/10`}
        >
          {results.map((item) => (
            <li key={item._id}>
              <SearchResultItem item={item} onSelect={onSelectResult} />
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  </div>
);

// === Recherche plein écran (mobile uniquement) ===
const MobileSearchOverlay = ({ open, onClose, query, setQuery, results, onSelectResult }) => {
  const inputRef = useRef(null);

  // Auto-focus the field shortly after opening + lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 60);
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onEscape = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onClose]);

  const handleSelect = (item) => {
    onSelectResult(item);
    onClose();
  };

  const hasQuery = query.trim().length >= 2;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-[90] flex flex-col bg-[var(--ms-white)] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Recherche"
        >
          {/* En-tête : retour + champ */}
          <div
            className="flex items-center gap-2 border-b border-[var(--ms-border)] px-3"
            style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))", paddingBottom: "0.5rem" }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la recherche"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] active:scale-[0.97]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ms-text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher produits, clients, ventes..."
                aria-label="Recherche globale"
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] py-2.5 pl-9 pr-9 text-[16px] font-medium text-[var(--ms-text)] outline-none transition-colors placeholder:text-[var(--ms-text-muted)] focus:border-[var(--ms-blue)] focus:bg-white focus:ring-2 focus:ring-[var(--ms-blue)]/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Corps : résultats ou état vide */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
            style={{ WebkitOverflowScrolling: "touch", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
          >
            {results.length > 0 ? (
              <ul className="space-y-2">
                {results.map((item) => (
                  <li key={item._id}>
                    <SearchResultItem item={item} onSelect={handleSelect} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 pt-24 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ms-bg-subtle)] text-[var(--ms-text-muted)]">
                  <Search className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-[var(--ms-text-strong)]">
                  {hasQuery ? "Aucun résultat" : "Rechercher"}
                </p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                  {hasQuery ? "Essayez un autre nom ou numéro." : "Produits, clients, ventes, employés…"}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Navigation;
