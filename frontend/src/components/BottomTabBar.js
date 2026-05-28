import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, Landmark, Users, Package } from "lucide-react";
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

  if (!auth.isAuthenticated) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden pointer-events-none touch-manipulation"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
      }}
      aria-label="Navigation principale"
    >
      <div className="pointer-events-auto mx-auto grid h-16 min-h-[64px] max-w-md grid-cols-4 gap-1 rounded-[22px] border border-gray-200/80 bg-white/95 p-1.5 shadow-[0_14px_42px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        {tabs.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
          return (
            <Link
              key={path}
              to={path}
              className={`relative flex min-w-0 min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[18px] px-2 py-2 transition-all duration-200 ease-apple active:scale-[0.98] ${
                isActive
                  ? "bg-gray-950 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-6 h-6 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[11px] truncate w-full text-center font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
