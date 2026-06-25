// Plan-based feature keys + labels (mirror of backend/config/features.js).
// Used for gating UI and upgrade prompts.

export const FEATURE_KEYS = {
  PROFIT_ANALYSIS: 'profit_analysis',
  PRODUCT_IMPORT: 'product_import',
  BULK_EDIT: 'bulk_edit',
  PRODUCT_DUPLICATE: 'product_duplicate',
  DATA_EXPORT: 'data_export',
  PROFORMA: 'proforma',
  DOCUMENTS: 'documents',
  EMPLOYEES_PAYROLL: 'employees_payroll',
  MONTHLY_SPENDING_PLAN: 'monthly_spending_plan',
  BANK: 'bank',
  SUPPLIER_RESTOCK: 'supplier_restock',
  LOYALTY: 'loyalty',
};

export const FEATURE_LABELS = {
  [FEATURE_KEYS.PROFIT_ANALYSIS]: 'Analyse des bénéfices',
  [FEATURE_KEYS.PRODUCT_IMPORT]: 'Import Excel des produits',
  [FEATURE_KEYS.BULK_EDIT]: 'Modification groupée des produits',
  [FEATURE_KEYS.PRODUCT_DUPLICATE]: 'Duplication des produits',
  [FEATURE_KEYS.DATA_EXPORT]: 'Export des données (PDF / Excel)',
  [FEATURE_KEYS.PROFORMA]: 'Factures proforma',
  [FEATURE_KEYS.DOCUMENTS]: "Documents de l'entreprise",
  [FEATURE_KEYS.EMPLOYEES_PAYROLL]: 'Employés & paie',
  [FEATURE_KEYS.MONTHLY_SPENDING_PLAN]: 'Objectif mensuel de dépenses',
  [FEATURE_KEYS.BANK]: 'Caisse / banque',
  [FEATURE_KEYS.SUPPLIER_RESTOCK]: 'Ravitaillement fournisseur',
  [FEATURE_KEYS.LOYALTY]: 'Programme de fidélité',
};

// Lowest paid plan that unlocks each feature (Trial always has everything).
export const FEATURE_REQUIRED_PLAN_LABEL = {
  [FEATURE_KEYS.PROFIT_ANALYSIS]: 'Entreprise',
  [FEATURE_KEYS.PRODUCT_IMPORT]: 'Entreprise',
  [FEATURE_KEYS.BULK_EDIT]: 'Entreprise',
  [FEATURE_KEYS.PRODUCT_DUPLICATE]: 'Entreprise',
  [FEATURE_KEYS.DATA_EXPORT]: 'Pro',
  [FEATURE_KEYS.PROFORMA]: 'Pro',
  [FEATURE_KEYS.DOCUMENTS]: 'Pro',
  [FEATURE_KEYS.EMPLOYEES_PAYROLL]: 'Pro',
  [FEATURE_KEYS.MONTHLY_SPENDING_PLAN]: 'Pro',
  [FEATURE_KEYS.BANK]: 'Entreprise',
  [FEATURE_KEYS.SUPPLIER_RESTOCK]: 'Entreprise',
  [FEATURE_KEYS.LOYALTY]: 'Entreprise',
};

// Plan key (for the upgrade request payload) matching the label above.
export const FEATURE_REQUIRED_PLAN = {
  [FEATURE_KEYS.PROFIT_ANALYSIS]: 'enterprise',
  [FEATURE_KEYS.PRODUCT_IMPORT]: 'enterprise',
  [FEATURE_KEYS.BULK_EDIT]: 'enterprise',
  [FEATURE_KEYS.PRODUCT_DUPLICATE]: 'enterprise',
  [FEATURE_KEYS.DATA_EXPORT]: 'pro',
  [FEATURE_KEYS.PROFORMA]: 'pro',
  [FEATURE_KEYS.DOCUMENTS]: 'pro',
  [FEATURE_KEYS.EMPLOYEES_PAYROLL]: 'pro',
  [FEATURE_KEYS.MONTHLY_SPENDING_PLAN]: 'pro',
  [FEATURE_KEYS.BANK]: 'enterprise',
  [FEATURE_KEYS.SUPPLIER_RESTOCK]: 'enterprise',
  [FEATURE_KEYS.LOYALTY]: 'enterprise',
};

export const featureLabel = (key) => FEATURE_LABELS[key] || key;
export const featureRequiredPlanLabel = (key) => FEATURE_REQUIRED_PLAN_LABEL[key] || 'supérieur';
export const featureRequiredPlanKey = (key) => FEATURE_REQUIRED_PLAN[key] || 'enterprise';
