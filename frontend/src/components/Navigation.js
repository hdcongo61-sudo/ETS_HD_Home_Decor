import React, { useState, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";

const Navigation = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

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

  const handleSelectResult = (item) => {
    setQuery("");
    setResults([]);
    switch (item.type) {
      case "client":
        navigate(`/clients/${item._id}`);
        break;
      case "product":
        navigate(`/products/${item._id}`);
        break;
      case "sale":
        navigate(`/sales/${item._id}`);
        break;
      case "employee":
        navigate(`/employees/${item._id}`);
        break;
      default:
        navigate("/");
    }
  };

  const showSearchBar = auth.isAuthenticated && auth.isAdmin; // ✅ Seuls les admins connectés

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200/70 sticky top-0 z-50 supports-backdrop-blur:bg-white/60">
      <div className="container mx-auto px-4 py-2">
        <div className="flex justify-between items-center gap-3">
          {/* === Logo === */}
          <Link
            to="/"
            className="flex items-center space-x-2"
            onClick={closeMenu}
          >
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <svg
                className="w-6 h-6 text-white"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 3L2 9l3 1.73v4.54L12 21l7-5.73v-4.54L22 9l-10-6z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 12l7-5.73M12 12V3M12 12L5 6.27M12 12l7 5.73M12 12v9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-gray-900 text-lg font-semibold hidden md:block">
              ETS HD-Gestion
            </span>
          </Link>

          {/* === Barre de recherche (Admin uniquement) === */}
          {showSearchBar && (
            <div className="relative flex-1 max-w-lg hidden md:block">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher produits, clients, ventes..."
                className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-400"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}

              {/* === Résultats dynamiques === */}
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute z-50 bg-white w-full mt-2 rounded-xl border border-gray-200 shadow-lg overflow-hidden"
                  >
                    {results.map((item) => {
                      const isProduct = item.type === "product";
                      return (
                        <li
                          key={item._id}
                          onClick={() => handleSelectResult(item)}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            {isProduct && item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-8 h-8 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-sm">
                                {item.type === "client" ? "👤" : item.type === "employee" ? "👥" : "📄"}
                              </div>
                            )}
                            <span className="font-medium text-gray-800">
                              {item.name || item.clientName || item.title}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 capitalize">
                            {item.type}
                          </span>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* === Menu desktop === */}
          <div className="hidden md:flex items-center space-x-1">
            {renderNavigationLinks(auth, handleLogout, closeMenu)}
          </div>

          {/* === Profil & Burger === */}
          <div className="flex items-center space-x-4">
            {auth.isAuthenticated && (
              <Link to="/profile" className="hidden md:block" onClick={closeMenu}>
                <div className="bg-gray-100 border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition">
                  <span className="text-gray-700 font-medium text-sm">
                    {auth.user?.name?.charAt(0) || "U"}
                  </span>
                </div>
              </Link>
            )}

            <button
              onClick={toggleMenu}
              className="text-gray-600 focus:outline-none hover:text-gray-900"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* === Menu mobile === */}
        <div
          className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${
            isMenuOpen
              ? "max-h-screen py-3 bg-white/95 backdrop-blur-lg rounded-lg mt-2 shadow-lg border border-gray-200"
              : "max-h-0"
          }`}
        >
          <div className="flex flex-col space-y-1">
            {renderNavigationLinks(auth, handleLogout, closeMenu, true)}
          </div>
        </div>
      </div>
    </nav>
  );
};

// === Liens du menu (desktop + mobile) ===
const renderNavigationLinks = (auth, handleLogout, closeMenu, isMobile = false) => {
  const linkClass = isMobile
    ? "flex items-center px-4 py-3 text-gray-800 hover:bg-gray-100/80 active:bg-gray-200/60 rounded-md transition-all duration-200 text-base font-medium"
    : "flex flex-col items-center p-2 text-gray-700 hover:text-gray-900 rounded-md transition-all duration-200 group";

  const iconClass = isMobile
    ? "w-5 h-5 mr-3 text-gray-500"
    : "w-5 h-5 text-gray-500 group-hover:text-gray-700";

  return auth.isAuthenticated ? (
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

      {/* === Admin uniquement === */}
      {auth.isAdmin && (
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
const NavIcon = ({ to, icon, label, className, onClick, isMobile }) => (
  <Link to={to} className={className} onClick={onClick} aria-label={label}>
    <div className={`flex ${isMobile ? "flex-row items-center" : "flex-col items-center"}`}>
      {icon}
      {isMobile && <span className="ml-3">{label}</span>}
      {!isMobile && (
        <span className="text-xs mt-1 text-gray-500 group-hover:text-gray-700">{label}</span>
      )}
    </div>
  </Link>
);

export default Navigation;
