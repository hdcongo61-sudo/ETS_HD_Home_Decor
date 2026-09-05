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
  Calculator,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Building2,
  LifeBuoy,
  Sparkles,
  Blocks,
  Truck,
  Boxes,
  RotateCcw,
  Workflow,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
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
  { to: '/ultimate-filters',  icon: Sparkles,         label: 'Filtres Ultimes', highlight: true },
  { to: '/comptabilite',     icon: Calculator,      label: 'Comptabilité' },
  { to: '/purchasing',       icon: Truck,           label: 'Achats', modules: ['purchasing'] },
  { to: '/inventory-v2',     icon: Boxes,           label: 'Inventaire', modules: ['inventory'] },
  { to: '/returns',          icon: RotateCcw,       label: 'Retours', modules: ['returns'] },
  { to: '/expenses',         icon: Receipt,         label: 'Dépenses' },
  { to: '/employees',        icon: BriefcaseBusiness,label: 'Employés' },
  { to: '/product-dashboard',icon: BarChart2,        label: 'Analytics' },
  { to: '/users/stats',      icon: Activity,         label: 'Utilisateurs' },
  { to: '/documents',        icon: FileText,         label: 'Documents' },
  { to: '/support',          icon: LifeBuoy,         label: 'Assistance' },
  { to: '/cutover',          icon: Workflow,         label: 'Bascule' },
  { to: '/security',         icon: ShieldCheck,      label: 'Sécurité' },
  { to: '/admin-modules',    icon: Blocks,           label: 'Modules' },
];

const NavItem = ({ to, icon: Icon, label, expanded, active, badge = 0, highlight = false, showTooltip, hideTooltip }) => (
  <Link
    to={to}
    className={`fluent-nav-rail__item ${
      active ? (expanded ? 'fluent-nav-rail__item--active-expanded' : 'fluent-nav-rail__item--active-collapsed') : ''
    } ${highlight ? 'fluent-nav-rail__item--highlight' : ''}`}
    onMouseEnter={(e) => { if (!expanded && showTooltip) showTooltip(e, label); }}
    onMouseLeave={hideTooltip}
    onFocus={(e) => { if (!expanded && showTooltip) showTooltip(e, label); }}
    onBlur={hideTooltip}
    aria-label={badge > 0 ? `${label} (${badge} non lu${badge > 1 ? 's' : ''})` : label}
    aria-current={active ? 'page' : undefined}
    style={highlight && !active ? {
      background: 'var(--ms-blue-soft)',
      color: 'var(--colorBrandForeground1)',
    } : undefined}
  >
    <span className="fluent-nav-rail__item-icon" style={{ position: 'relative' }}>
      <Icon size={18} />
      {badge > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: -5, right: -7, minWidth: 16, height: 16, padding: '0 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 999, fontSize: 10, fontWeight: 700, lineHeight: 1,
            background: 'var(--colorStatusDangerForeground1)', color: '#fff',
          }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </span>
    {expanded && (
      <motion.span
        key="label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="fluent-nav-rail__item-label"
      >
        {label}
      </motion.span>
    )}
  </Link>
);

const DesktopNavRail = () => {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem('desktopNavExpanded') === 'true';
    } catch {
      return false;
    }
  });
  const { auth, setAuth } = useContext(AuthContext);
  const location = useLocation();
  const { appSettings } = useAppSettings();
  const branding = appSettings?.branding || {};
  const logoUrl = resolveAppLogo(branding.logoUrl);
  const userInitial = auth.user?.name?.charAt(0)?.toUpperCase() || 'U';
  const [tooltip, setTooltip] = useState(null);

  const showTooltip = (event, label) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, left: rect.right + 10, top: rect.top + rect.height / 2 });
  };
  const hideTooltip = () => setTooltip(null);
  const [supportUnread, setSupportUnread] = useState(0);
  const [moduleStates, setModuleStates] = useState(null);

  // Catalogue de modules serveur (Phase 7.2) : les entrées dont les modules
  // requis sont désactivés ou interdits par le backend sont masquées.
  useEffect(() => {
    if (!auth.isAdmin) return undefined;
    let alive = true;
    api.get('/v2/modules')
      .then(({ data }) => {
        if (!alive) return;
        const map = {};
        (data?.modules || []).forEach((m) => { map[m.key] = m; });
        setModuleStates(map);
      })
      .catch(() => setModuleStates(null));
    return () => { alive = false; };
  }, [auth.isAdmin]);

  // Unread support replies → nav badge. Refreshed on navigation so it clears
  // after the admin opens the Assistance page.
  const isImpersonatingForBadge = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('impersonating');
  const showShopNav = auth.isAuthenticated && auth.isAdmin && !(auth.isSuperAdmin && !isImpersonatingForBadge);
  useEffect(() => {
    if (!showShopNav) { setSupportUnread(0); return; }
    let alive = true;
    api.get('/support/unread')
      .then(({ data }) => { if (alive) setSupportUnread(data?.unread || 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [showShopNav, location.pathname]);

  // Sync sidebar width CSS variable so main content can offset
  useEffect(() => {
    const w = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
    try { localStorage.setItem('desktopNavExpanded', String(expanded)); } catch {}
  }, [expanded]);

  // Clean up the shared layout variable on unmount.
  useEffect(() => {
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
  const adminNavItems = (!isPlatformOperator && auth.isAdmin)
    ? ADMIN_NAV.filter((item) => {
        if (!item.modules || item.modules.length === 0) return true;
        if (!moduleStates) return true; // catalogue pas encore chargé → ne rien masquer
        return item.modules.every((key) => {
          const m = moduleStates[key];
          return m && m.enabled !== false && m.allowed !== false;
        });
      })
    : [];

  return (
    <motion.aside
      className={`fluent-nav-rail fluent-nav-rail--${expanded ? 'expanded' : 'collapsed'} hidden md:flex`}
      animate={{ width: expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W }}
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      aria-label="Navigation principale"
    >
      {/* ── Marque : logo + nom de l'application ── */}
      <div className="fluent-nav-rail__brand">
        <img
          src={logoUrl}
          alt={branding.shortName || branding.appName || 'Logo'}
          className="fluent-nav-rail__brand-logo"
          onError={(e) => {
            const fallback = `${process.env.PUBLIC_URL || ''}/logo.png`;
            if (e.currentTarget.src !== window.location.origin + fallback && !e.currentTarget.dataset.fallback) {
              e.currentTarget.dataset.fallback = '1';
              e.currentTarget.src = fallback;
            }
          }}
        />
        {expanded && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
            className="fluent-nav-rail__brand-name"
          >
            {branding.appName || 'HD Gestion'}
          </motion.span>
        )}
      </div>

      {/* ── Primary nav ── */}
      <nav className="fluent-nav-rail__nav" aria-label="Navigation principale">
        {expanded && primaryNavItems.length > 0 && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
            className="fluent-nav-rail__group-label"
          >
            Menu
          </motion.span>
        )}
        {primaryNavItems.map(({ to, icon, label, exact }) => (
          <NavItem
            key={to}
            to={to}
            icon={icon}
            label={label}
            expanded={expanded}
            active={isActive(to, exact)}
            showTooltip={showTooltip}
            hideTooltip={hideTooltip}
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
            {adminNavItems.map(({ to, icon, label, highlight }) => (
              <NavItem
                key={to}
                to={to}
                icon={icon}
                label={label}
                expanded={expanded}
                active={isActive(to)}
                badge={to === '/support' ? supportUnread : 0}
                highlight={highlight}
                showTooltip={showTooltip}
                hideTooltip={hideTooltip}
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
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
            />
            <NavItem
              to="/register"
              icon={Building2}
              label="Nouvelle boutique"
              expanded={expanded}
              active={isActive('/register')}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
            />
          </>
        )}
      </nav>

      {/* ── Footer: profile, settings, logout, toggle ── */}
      <div className="fluent-nav-rail__footer">
        <Link
          to="/profile"
          className={`fluent-nav-rail__profile ${isActive('/profile') ? 'fluent-nav-rail__profile--active' : ''}`}
          onMouseEnter={(e) => { if (!expanded) showTooltip(e, 'Mon profil'); }}
          onMouseLeave={hideTooltip}
          onFocus={(e) => { if (!expanded) showTooltip(e, 'Mon profil'); }}
          onBlur={hideTooltip}
          aria-label="Mon profil"
        >
          {auth.user?.photo ? (
            <img
              src={auth.user.photo}
              alt={auth.user.name || 'Profil'}
              className="fluent-nav-rail__profile-avatar object-cover"
            />
          ) : (
            <span className="fluent-nav-rail__profile-avatar">{userInitial}</span>
          )}
          {expanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.12 }}
              className="fluent-nav-rail__profile-meta"
            >
              <span className="fluent-nav-rail__profile-name">{auth.user?.name || 'Mon profil'}</span>
              <span className="fluent-nav-rail__profile-role">
                {auth.isSuperAdmin ? 'Super admin' : auth.isAdmin ? 'Administrateur' : 'Membre'}
              </span>
            </motion.span>
          )}
        </Link>

        {auth.isAdmin && (
          <Link
            to="/settings"
            className={`fluent-nav-rail__item ${isActive('/settings') ? (expanded ? 'fluent-nav-rail__item--active-expanded' : 'fluent-nav-rail__item--active-collapsed') : ''}`}
            onMouseEnter={(e) => { if (!expanded) showTooltip(e, 'Paramètres'); }}
            onMouseLeave={hideTooltip}
            onFocus={(e) => { if (!expanded) showTooltip(e, 'Paramètres'); }}
            onBlur={hideTooltip}
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

        <button
          onClick={handleLogout}
          className="fluent-nav-rail__item fluent-nav-rail__item--danger"
          onMouseEnter={(e) => { if (!expanded) showTooltip(e, 'Déconnexion'); }}
          onMouseLeave={hideTooltip}
          onFocus={(e) => { if (!expanded) showTooltip(e, 'Déconnexion'); }}
          onBlur={hideTooltip}
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
          onMouseEnter={(e) => { if (!expanded) showTooltip(e, 'Développer le menu'); }}
          onMouseLeave={hideTooltip}
          onBlur={hideTooltip}
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

      {/* Infobulle au survol (rail replié) */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="rail-tooltip"
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="fluent-nav-rail__tooltip"
            style={{ top: tooltip.top, left: tooltip.left }}
          >
            {tooltip.label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};

export default DesktopNavRail;
