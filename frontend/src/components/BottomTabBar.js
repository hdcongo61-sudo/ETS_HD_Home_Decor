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
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden surface-bar border-t border-gray-200/50 pt-2 touch-manipulation"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-4 gap-0 h-14 min-h-[56px]">
        {tabs.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 min-h-[48px] px-2 py-2 transition-colors duration-apple ease-apple rounded-xl active:bg-gray-100/80 ${
                isActive
                  ? "text-[#007AFF] font-medium"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50/80"
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
