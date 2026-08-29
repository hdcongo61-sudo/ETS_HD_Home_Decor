/**
 * features — manifeste des domaines frontend (Phase 7.1).
 *
 * Chaque feature possède : routes, fonctions d'API, hooks, composants,
 * schémas et tests. Le manifeste aligne les clés sur le catalogue de
 * modules serveur (GET /api/v2/modules) pour une navigation pilotée
 * par le backend à terme.
 */
const FEATURES = [
  {
    key: 'auth',
    label: 'Authentification',
    routes: ['/login', '/register', '/security', '/profile'],
    api: () => import('./auth/api'),
    hooks: () => import('./auth/hooks'),
    modules: [], // pas de module serveur dédié — transversal
  },
  {
    key: 'catalog',
    label: 'Catalogue & produits',
    routes: ['/products', '/products/:id/:slug?', '/products/out-of-stock'],
    api: () => import('./catalog/api'),
    modules: ['inventory'],
  },
  {
    key: 'customers',
    label: 'Clients',
    routes: ['/clients'],
    api: () => import('./customers/api'),
    modules: [],
  },
  {
    key: 'expenses',
    label: 'Dépenses',
    routes: ['/expenses'],
    api: () => import('./expenses/api'),
    modules: [],
  },
  {
    key: 'documents',
    label: 'Documents',
    routes: ['/documents'],
    api: () => import('./documents/api'),
    modules: [],
  },
  {
    key: 'inventory',
    label: 'Inventaire',
    routes: ['/products', '/product-dashboard', '/inventory-v2'],
    api: () => import('./inventory/api'),
    modules: ['inventory', 'transfers', 'stock-counts'],
  },
  {
    key: 'purchasing',
    label: 'Achats & fournisseurs',
    routes: ['/products/by-supplier', '/purchasing'],
    api: () => import('./purchasing/api'),
    modules: ['purchasing', 'inbound-shipments', 'replenishment'],
  },
  {
    key: 'reporting',
    label: 'Rapports & exports',
    routes: ['/comptabilite', '/admin-modules', '/reporting', '/cutover'],
    api: () => import('./reporting/api'),
    modules: [],
  },
  {
    key: 'sales',
    label: 'Ventes & paiements',
    routes: ['/sales', '/bank', '/returns'],
    api: () => import('./sales/api'),
    modules: ['payments', 'returns', 'cash'],
  },
  {
    key: 'platform',
    label: 'Plateforme',
    routes: ['/super-admin', '/admin-requests', '/admin-modules'],
    api: () => import('./platform/api'),
    modules: ['admin.newUi'],
  },
];

export default FEATURES;
