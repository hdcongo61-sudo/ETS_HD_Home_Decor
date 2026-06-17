import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart, Landmark, Users, Package, Plus } from "lucide-react";
import AuthContext from "../context/AuthContext";
import { useModal } from "../context/ModalContext";

// Two tabs on each side of a raised central "Vendre" action (thumb zone).
const leftTabs = [
  { path: "/sales", label: "Ventes", icon: ShoppingCart },
  { path: "/bank", label: "Caisse", icon: Landmark },
];
const rightTabs = [
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/products", label: "Produits", icon: Package },
];

const BottomTabBar = () => {
  const { auth } = useContext(AuthContext);
  const { openModal, activeModal, areGlobalModalsSuppressed } = useModal();
  const location = useLocation();
  const [hidden, setHidden] = useState(false);

  // Any open form — global modal (sale/payment), side panel (produit/client/
  // dépense) or a form page (/new, /edit) — should own the whole screen, so
  // hide the bottom menu. areGlobalModalsSuppressed is set by panels/modals.
  const isFormContext = Boolean(activeModal) || areGlobalModalsSuppressed || /\/(edit|new)(\/|$)/.test(location.pathname);

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
        if (desktop || y < 60) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!auth.isAuthenticated || isFormContext) return null;

  const Tab = ({ path, label, icon: Icon }) => {
    const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
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
          <Tab {...rightTabs[1]} />
        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
