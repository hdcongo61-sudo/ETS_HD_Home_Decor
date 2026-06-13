import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart, Landmark, Users, Package, Circle } from "lucide-react";
import AuthContext from "../context/AuthContext";

const tabs = [
  { path: "/sales", label: "Ventes", icon: ShoppingCart },
  { path: "/bank", label: "Caisse", icon: Landmark },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/products", label: "Produits", icon: Package },
];

const BottomTabBar = () => {
  const { auth } = useContext(AuthContext);
  const location = useLocation();
  const [hidden, setHidden] = useState(false);

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
        if (desktop || y < 60) {
          setHidden(false);
        } else if (delta > 6) {
          setHidden(true);
        } else if (delta < -6) {
          setHidden(false);
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!auth.isAuthenticated) return null;

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
        <div className="relative grid min-h-[66px] grid-cols-4 gap-1 rounded-lg border border-[var(--ms-border)] bg-white p-1 shadow-[var(--ms-shadow)]">
        {tabs.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
          return (
            <Link
              key={path}
              to={path}
              className={`group relative flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1.5 py-2 transition-colors duration-150 ease-apple active:scale-[0.99] ${
                isActive
                  ? "text-white"
                  : "text-[var(--ms-text-muted)] hover:bg-[var(--ms-bg-subtle)] hover:text-[var(--ms-text-strong)]"
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
              <span className={`relative flex h-7 w-7 items-center justify-center rounded-md transition-colors ${isActive ? "bg-white/12" : "group-hover:bg-white"}`}>
                <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={isActive ? 2.25 : 1.9} />
              </span>
              <span className="relative w-full truncate text-center text-[10.5px] font-semibold leading-tight tracking-0">
                {label}
              </span>
              {!isActive && (
                <Circle className="relative mt-0.5 h-1 w-1 fill-current text-transparent transition-colors group-hover:text-gray-300" aria-hidden="true" />
              )}
            </Link>
          );
        })}
        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
