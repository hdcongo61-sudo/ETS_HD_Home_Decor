/**
 * ModuleCatalog — catalogue versionné des modules (Phase 7.2).
 *
 * Source de vérité côté backend : clé, libellé, routes, permission requise,
 * droit de plan (featureKey), métadonnées de navigation et schéma de
 * configuration. Le frontend peut s'en servir pour la navigation, mais
 * l'autorisation backend reste seule décisionnaire.
 */
const { FEATURE_KEYS } = require('./features');

const MODULE_VERSION = 1;

const MODULE_CATALOG = [
  {
    key: 'inventory',
    label: 'Inventaire',
    version: MODULE_VERSION,
    routes: ['/api/v2/inventory'],
    permission: 'inventory.read',
    featureKey: null,
    nav: { section: 'operations', order: 10 },
    configSchema: { type: 'object', properties: { showReserved: { type: 'boolean' } } },
  },
  {
    key: 'transfers',
    label: 'Transferts inter-boutiques',
    version: MODULE_VERSION,
    routes: ['/api/v2/inventory/transfers'],
    permission: 'inventory.transfer',
    featureKey: null,
    nav: { section: 'operations', order: 11 },
    configSchema: { type: 'object', properties: { requireReceiptConfirmation: { type: 'boolean' } } },
  },
  {
    key: 'stock-counts',
    label: 'Inventaires physiques',
    version: MODULE_VERSION,
    routes: ['/api/v2/inventory/counts'],
    permission: 'inventory.count',
    featureKey: null,
    nav: { section: 'operations', order: 12 },
    configSchema: { type: 'object', properties: { requireReason: { type: 'boolean' } } },
  },
  {
    key: 'payments',
    label: 'Paiements',
    version: MODULE_VERSION,
    routes: ['/api/v2/payments', '/api/v2/refunds'],
    permission: 'sales.read',
    featureKey: null,
    nav: { section: 'sales', order: 20 },
    configSchema: { type: 'object', properties: { allowCredit: { type: 'boolean' } } },
  },
  {
    key: 'returns',
    label: 'Retours & remboursements',
    version: MODULE_VERSION,
    routes: ['/api/v2/sales/:id/returns'],
    permission: 'sales.return',
    featureKey: null,
    nav: { section: 'sales', order: 21 },
    configSchema: { type: 'object', properties: { maxReturnDays: { type: 'number' } } },
  },
  {
    key: 'cash',
    label: 'Caisse & sessions',
    version: MODULE_VERSION,
    routes: ['/api/v2/cash-registers', '/api/v2/cash-sessions'],
    permission: 'cashier.manage',
    featureKey: null,
    nav: { section: 'sales', order: 22 },
    configSchema: { type: 'object', properties: { defaultOpeningFloat: { type: 'number' } } },
  },
  {
    key: 'purchasing',
    label: 'Achats & fournisseurs',
    version: MODULE_VERSION,
    routes: ['/api/v2/suppliers', '/api/v2/purchase-orders', '/api/v2/supplier-invoices'],
    permission: 'purchasing.manage',
    featureKey: FEATURE_KEYS.SUPPLIER_RESTOCK,
    nav: { section: 'operations', order: 30 },
    configSchema: { type: 'object', properties: { approvalSeparation: { type: 'boolean' } } },
  },
  {
    key: 'inbound-shipments',
    label: 'Expéditions entrantes',
    version: MODULE_VERSION,
    routes: ['/api/v2/inbound-shipments'],
    permission: 'purchasing.manage',
    featureKey: FEATURE_KEYS.SUPPLIER_RESTOCK,
    nav: { section: 'operations', order: 31 },
    configSchema: { type: 'object', properties: { landedCostMethod: { type: 'string', enum: ['value', 'quantity'] } } },
  },
  {
    key: 'replenishment',
    label: 'Réapprovisionnement',
    version: MODULE_VERSION,
    routes: ['/api/v2/purchasing/replenishment-suggestions'],
    permission: 'purchasing.manage',
    featureKey: FEATURE_KEYS.SUPPLIER_RESTOCK,
    nav: { section: 'operations', order: 32 },
    configSchema: { type: 'object', properties: { demandWindowDays: { type: 'number' } } },
  },
];

module.exports = { MODULE_CATALOG, MODULE_VERSION };
