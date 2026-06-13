import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  ShoppingCart,
  Landmark,
  Users,
  Package,
  Receipt,
  BriefcaseBusiness,
  BarChart2,
  Activity,
  FileText,
  Settings,
  UserRound,
  LogOut,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { resolveAppLogo } from '../utils/appBranding';

export const SIDEBAR_COLLAPSED_W = 64;
export const SIDEBAR_EXPANDED_W  = 240;

const PRIMARY_NAV = [
  { to: '/',        icon: Home,          label: 'Accueil',  exact: true },
  { to: '/sales',   icon: ShoppingCart,  label: 'Ventes' },
  { to: '/bank',    icon: Landmark,      label: 'Caisse' },
  { to: '/clients', icon: Users,         label: 'Clients' },
  { to: '/products',icon: Package,       label: 'Produits' },
  { to: '/admin-requests', icon: ClipboardList, label: 'Demandes' },
];

const ADMIN_NAV = [
  { to: '/caisse/session',   icon: Landmark,        label: 'Caisse (session)' },
  { to: '/expenses',         icon: Receipt,         label: 'Dépenses' },
  { to: '/employees',        icon: BriefcaseBusiness,label: 'Employés' },
  { to: '/product-dashboard',icon: BarChart2,        label: 'Analytics' },
  { to: '/users/stats',      icon: Activity,         label: 'Utilisateurs' },
  { to: '/documents',        icon: FileText,         label: 'Documents' },
];

const NavItem = ({ to, icon: Icon, label, expanded, active }) => (
  <Link
    to={to}
    className={`fluent-nav-rail__item ${active ? 'fluent-nav-rail__item--active' : ''}`}
    title={!expanded ? label : undefined}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
  >
    <span className="fluent-nav-rail__item-icon">
      <Icon size={18} />
    </span>
    <AnimatePresence>
      {expanded && (
        <motion.span
          key="label"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fluent-nav-rail__item-label"
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  </Link>
);

const DesktopNavRail = () => {
  const [expanded, setExpanded] = useState(false);
  const { auth, setAuth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const location = useLocation();
  const branding = appSettings.branding;
  const logoUrl = resolveAppLogo(branding.logoUrl);
  const userInitial = auth.user?.name?.charAt(0)?.toUpperCase() || 'U';

  // Sync sidebar width CSS variable so main content can offset
  useEffect(() => {
    const w = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
  }, [expanded]);

  // Set initial width on mount, clean up on unmount
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${SIDEBAR_COLLAPSED_W}px`);
    return () => {
      document.documentElement.style.removeProperty('--sidebar-w');
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
    try { sessionStorage.removeItem('accessRestrictionInfo'); } catch {}
    setAuth({ isAuthenticated: false, user: null, isAdmin: false, isSuperAdmin: false, tenantId: null, isLoading: false });
  };

  const isActive = (to, exact = false) => {
    if (exact) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  if (!auth.isAuthenticated) return null;

  // A super-admin who is NOT impersonating is a pure platform operator:
  // they only see the platform console, never the shop navigation.
  const isImpersonating = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('impersonating');
  const isPlatformOperator = auth.isSuperAdmin && !isImpersonating;

  const primaryNavItems = isPlatformOperator ? [] : PRIMARY_NAV;
  const adminNavItems = (!isPlatformOperator && auth.isAdmin) ? ADMIN_NAV : [];

  return (
    <motion.aside
      className="fluent-nav-rail hidden md:flex"
      animate={{ width: expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W }}
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      aria-label="Navigation principale"
    >
      {/* ── Logo / App name ── */}
      <div className="fluent-nav-rail__header">
        <Link to="/" className="fluent-nav-rail__logo-btn" aria-label="Accueil">
          <img
            src={logoUrl}
            alt={branding.shortName || branding.appName}
            onError={(e) => {
              const fallback = `${process.env.PUBLIC_URL || ''}/logo.png`;
              if (!e.currentTarget.dataset.fallback) {
                e.currentTarget.dataset.fallback = '1';
                e.currentTarget.src = fallback;
              }
            }}
            className="fluent-nav-rail__logo-img"
          />
          <AnimatePresence>
            {expanded && (
              <motion.span
                key="app-name"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="fluent-nav-rail__logo-label"
              >
                {branding.shortName || branding.appName}
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Primary nav ── */}
      <nav className="fluent-nav-rail__nav" aria-label="Navigation principale">
        {primaryNavItems.map(({ to, icon, label, exact }) => (
          <NavItem
            key={to}
            to={to}
            icon={icon}
            label={label}
            expanded={expanded}
            active={isActive(to, exact)}
          />
        ))}

        {/* Admin section */}
        {adminNavItems.length > 0 && (
          <>
            <div className="fluent-nav-rail__divider" />
            {expanded && (
              <AnimatePresence>
                <motion.span
                  key="admin-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="fluent-nav-rail__group-label"
                >
                  Administration
                </motion.span>
              </AnimatePresence>
            )}
            {adminNavItems.map(({ to, icon, label }) => (
              <NavItem
                key={to}
                to={to}
                icon={icon}
                label={label}
                expanded={expanded}
                active={isActive(to)}
              />
            ))}
          </>
        )}

        {/* Super-admin section — only visible when isSuperAdmin */}
        {auth.isSuperAdmin && (
          <>
            <div className="fluent-nav-rail__divider" />
            {expanded && (
              <AnimatePresence>
                <motion.span
                  key="super-admin-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="fluent-nav-rail__group-label"
                  style={{ color: 'var(--colorStatusWarningForeground1)' }}
                >
                  Super Admin
                </motion.span>
              </AnimatePresence>
            )}
            <NavItem
              to="/super-admin"
              icon={ShieldCheck}
              label="Boutiques"
              expanded={expanded}
              active={isActive('/super-admin')}
            />
            <NavItem
              to="/register"
              icon={Building2}
              label="Nouvelle boutique"
              expanded={expanded}
              active={isActive('/register')}
            />
          </>
        )}
      </nav>

      {/* ── Footer: profile, settings, logout, toggle ── */}
      <div className="fluent-nav-rail__footer">
        {auth.isAdmin && (
          <Link
            to="/settings"
            className={`fluent-nav-rail__item ${isActive('/settings') ? 'fluent-nav-rail__item--active' : ''}`}
            title={!expanded ? 'Paramètres' : undefined}
            aria-label="Paramètres"
          >
            <span className="fluent-nav-rail__item-icon"><Settings size={18} /></span>
            <AnimatePresence>
              {expanded && (
                <motion.span key="settings-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fluent-nav-rail__item-label">
                  Paramètres
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}

        <Link
          to="/profile"
          className={`fluent-nav-rail__item ${isActive('/profile') ? 'fluent-nav-rail__item--active' : ''}`}
          title={!expanded ? 'Mon profil' : undefined}
          aria-label="Mon profil"
        >
          <span className="fluent-nav-rail__item-icon">
            {auth.user?.photo ? (
              <img
                src={auth.user.photo}
                alt={auth.user.name || 'Profil'}
                className="h-[18px] w-[18px] rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: isActive('/profile') ? 'rgba(255,255,255,0.25)' : 'var(--colorNeutralBackground4)',
                  color: isActive('/profile') ? '#fff' : 'var(--colorNeutralForeground1)',
                }}
              >
                {userInitial}
              </span>
            )}
          </span>
          <AnimatePresence>
            {expanded && (
              <motion.span key="profile-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fluent-nav-rail__item-label">
                Mon profil
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        <button
          onClick={handleLogout}
          className="fluent-nav-rail__item fluent-nav-rail__item--danger"
          title={!expanded ? 'Déconnexion' : undefined}
          aria-label="Déconnexion"
        >
          <span className="fluent-nav-rail__item-icon"><LogOut size={18} /></span>
          <AnimatePresence>
            {expanded && (
              <motion.span key="logout-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fluent-nav-rail__item-label">
                Déconnexion
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse / expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="fluent-nav-rail__toggle"
          aria-label={expanded ? 'Réduire le menu' : 'Développer le menu'}
        >
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="flex items-center justify-center"
          >
            <ChevronRight size={14} />
          </motion.span>
        </button>
      </div>
    </motion.aside>
  );
};

export default DesktopNavRail;
