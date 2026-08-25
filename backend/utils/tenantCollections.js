/**
 * Registre central des collections tenant-scopées (data plane).
 *
 * Source unique utilisée par :
 *   - la suppression en cascade d'un tenant (tenantController.deleteTenant) ;
 *   - la migration mono-boutique (scripts/migrateSingleShop.js) ;
 *   - les futurs jobs de purge et de réconciliation.
 *
 * Toute nouvelle collection portant `tenantId` DOIT être ajoutée ici.
 */
const TENANT_SCOPED_MODELS = [
  'User',
  'Product',
  'Sale',
  'Client',
  'Employee',
  'Expense',
  'BankTransaction',
  'AdminRequest',
  'Document',
  'AppSettings',
  'Category',
  'Container',
  'Warehouse',
  'Supplier',
  'ExpenseCategory',
  'DeletedSale',
  'LoginHistory',
  'Proforma',
  'StockMovement',
  'StockReplacementReminder',
  'SupportTicket',
  'SubscriptionPayment',
];

module.exports = { TENANT_SCOPED_MODELS };
