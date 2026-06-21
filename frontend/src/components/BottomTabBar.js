import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, ShoppingCart, Package, Plus, Menu as MenuIcon, X } from "lucide-react";
import AuthContext from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { renderNavigationLinks } from "./Navigation";
import { clearCache } from "../utils/offlineCache";

// Mobile-first primary navigation: thumb-reachable tabs around a raised central
// "Vendre" action, plus a "Menu" sheet that opens the full navigation. Desktop
// uses the top bar + nav rail instead (this whole bar is md:hidden).
const leftTabs = [
  { path: "/", label: "Accueil", icon: Home, exact: true },
  { path: "/sales", label: "Ventes", icon: ShoppingCart },
];
const rightTabs = [
  { path: "/products", label: "Produits", icon: Package },
];

const BottomTabBar = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const { openModal, activeModal, areGlobalModalsSuppressed } = useModal();
  const location = useLocation();
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const userInitial = auth.user?.name?.charAt(0)?.toUpperCase() || "U";

  // Any open form — global modal (sale/payment), side panel (produit/client/
  // dépense) or a form page (/new, /edit) — should own the whole screen, so
  // hide the bottom menu. areGlobalModalsSuppressed is set by panels/modals.
  const isFormContext = Boolean(activeModal) || areGlobalModalsSuppressed || /\/(edit|new)(\/|$)/.test(location.pathname);

  // Close the menu sheet whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock body scroll while the menu sheet is open.
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => { document.body.style.overflow = ""; document.body.style.touchAction = ""; };
  }, [menuOpen]);

  // Close the sheet with the Escape key.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onEscape = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [menuOpen]);

  // Hide on scroll-down (mobile only); reveal on scroll-up or near the top.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        const desktop = window.matchMedia("(min-width: 768px)").matches;
        if (desktop || y < 60 || menuOpen) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  if (!auth.isAuthenticated || isFormContext) return null;

  const handleLogout = () => {
    localStorage.removeItem("token");
    try {
      sessionStorage.removeItem("accessRestrictionInfo");
    } catch (error) {
      console.error("Unable to clear restriction info", error);
    }
    clearCache();
    setAuth({ isAuthenticated: false, user: null, isAdmin: false, isLoading: false });
    setMenuOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);

  const Tab = ({ path, label, icon: Icon, exact }) => {
    const isActive = exact
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path + "/");
    return (
      <Link
        to={path}
        className={`group relative flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 transition-colors duration-150 active:scale-[0.98] ${
          isActive ? "text-white" : "text-[var(--ms-text-muted)] hover:bg-[var(--ms-bg-subtle)] hover:text-[var(--ms-text-strong)]"
        }`}
        aria-current={isActive ? "page" : undefined}
      >
        {isActive && (
          <motion.span
            layoutId="bottom-tab-active"
            className="absolute inset-0 rounded-md bg-[var(--ms-blue)] shadow-[var(--ms-shadow-sm)]"
            transition={{ type: "spring", stiffness: 460, damping: 36 }}
          />
        )}
        <span className="relative flex h-7 w-7 items-center justify-center">
          <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={isActive ? 2.25 : 1.9} />
        </span>
        <span className="relative w-full truncate text-center text-[10.5px] font-semibold leading-tight">{label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden pointer-events-none touch-manipulation transition-all duration-300 ease-out will-change-transform"
        style={{
          paddingBottom: "max(0.9rem, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(0.85rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.85rem, env(safe-area-inset-right, 0px))",
          transform: hidden ? "translateY(160%)" : "translateY(0)",
          opacity: hidden ? 0 : 1,
        }}
        aria-label="Navigation principale"
      >
        <div className="pointer-events-auto relative mx-auto max-w-[430px]">
          <div className="relative grid min-h-[66px] grid-cols-5 items-center gap-1 rounded-lg border border-[var(--ms-border)] bg-white p-1 shadow-[var(--ms-shadow)]">
            <Tab {...leftTabs[0]} />
            <Tab {...leftTabs[1]} />

            {/* Action centrale surélevée : Vendre */}
            <div className="flex items-start justify-center">
              <button
                type="button"
                onClick={() => openModal("sale")}
                className="-mt-7 flex flex-col items-center gap-1 active:scale-[0.97]"
                aria-label="Nouvelle vente"
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-white"
                  style={{ background: "var(--ms-blue)", boxShadow: "0 8px 22px rgba(15,108,189,0.45)", border: "3px solid var(--ms-white)" }}
                >
                  <Plus className="h-7 w-7" strokeWidth={2.5} />
                </span>
                <span className="text-[10.5px] font-bold leading-none" style={{ color: "var(--ms-blue)" }}>Vendre</span>
              </button>
            </div>

            <Tab {...rightTabs[0]} />

            {/* Menu : ouvre la feuille de navigation complète */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={`group relative flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 transition-colors duration-150 active:scale-[0.98] ${
                menuOpen ? "text-white" : "text-[var(--ms-text-muted)] hover:bg-[var(--ms-bg-subtle)] hover:text-[var(--ms-text-strong)]"
              }`}
              aria-label="Ouvrir le menu"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
            >
              {menuOpen && (
                <span className="absolute inset-0 rounded-md bg-[var(--ms-blue)] shadow-[var(--ms-shadow-sm)]" />
              )}
              <span className="relative flex h-7 w-7 items-center justify-center">
                <MenuIcon className="h-[21px] w-[21px] shrink-0" strokeWidth={menuOpen ? 2.25 : 1.9} />
              </span>
              <span className="relative w-full truncate text-center text-[10.5px] font-semibold leading-tight">Menu</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Feuille de navigation (bottom sheet) */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Menu de navigation">
            <motion.button
              type="button"
              aria-label="Fermer le menu"
              onClick={closeMenu}
              className="absolute inset-0 bg-[rgba(32,31,30,0.32)] backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl border-t border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[0_-8px_28px_rgba(0,0,0,0.18)]"
            >
              {/* Poignée + en-tête */}
              <div className="shrink-0 px-4 pt-2.5">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--ms-border)]" aria-hidden="true" />
                {auth.isAuthenticated && (
                  <div className="mb-2 flex min-h-[60px] items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3.5 py-2.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ms-border)] bg-[var(--ms-surface-muted)]">
                      {auth.user?.photo ? (
                        <img src={auth.user.photo} alt={auth.user.name || "Profil"} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-base font-semibold text-[var(--ms-text)]">{userInitial}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight text-[var(--ms-text-strong)]">{auth.user?.name}</p>
                      <p className="truncate text-xs text-[var(--ms-text-muted)]">{auth.user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ms-white)] text-[var(--ms-text)] shadow-sm"
                      aria-label="Fermer le menu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Liens */}
              <div
                className="flex flex-col gap-0 overflow-y-auto overflow-x-hidden px-3 pt-1"
                style={{
                  paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {renderNavigationLinks(auth, handleLogout, closeMenu, true, true, false, () => {})}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BottomTabBar;
