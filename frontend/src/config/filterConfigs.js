import { Calendar, DollarSign, Tag, User, Package, TrendingUp, Truck, CreditCard, FileText, Search } from 'lucide-react';

/**
 * Configurations de filtres prédéfinies pour différents types de pages
 */

// Filtres pour les ventes
export const SALES_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Client, référence, produit...',
    icon: Search,
    quick: true,
  },
  {
    key: 'dateRange',
    type: 'dateRange',
    label: 'Période',
    icon: Calendar,
    quick: true,
  },
  {
    key: 'paymentStatus',
    type: 'select',
    label: 'Statut paiement',
    icon: CreditCard,
    quick: true,
    options: [
      { value: 'paid', label: 'Payé' },
      { value: 'partial', label: 'Partiel' },
      { value: 'unpaid', label: 'Impayé' },
    ],
  },
  {
    key: 'deliveryStatus',
    type: 'select',
    label: 'Statut livraison',
    icon: Truck,
    quick: true,
    options: [
      { value: 'pending', label: 'En attente' },
      { value: 'in_transit', label: 'En transit' },
      { value: 'delivered', label: 'Livré' },
    ],
  },
  {
    key: 'amountRange',
    type: 'amount',
    label: 'Montant (CFA)',
    icon: DollarSign,
    quick: false,
    min: 0,
    step: 1000,
  },
  {
    key: 'createdBy',
    type: 'select',
    label: 'Créé par',
    icon: User,
    quick: false,
    options: [], // À remplir dynamiquement avec la liste des utilisateurs
  },
  {
    key: 'paymentMethod',
    type: 'multiselect',
    label: 'Mode de paiement',
    icon: CreditCard,
    quick: false,
    options: [
      { value: 'cash', label: 'Espèces' },
      { value: 'card', label: 'Carte' },
      { value: 'mobile_money', label: 'Mobile Money' },
      { value: 'bank_transfer', label: 'Virement' },
      { value: 'cheque', label: 'Chèque' },
    ],
  },
  {
    key: 'profitRange',
    type: 'amount',
    label: 'Marge bénéficiaire (CFA)',
    icon: TrendingUp,
    quick: false,
    min: 0,
    step: 1000,
  },
];

// Filtres pour les produits
export const PRODUCTS_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Nom, référence, description...',
    icon: Search,
    quick: true,
  },
  {
    key: 'category',
    type: 'select',
    label: 'Catégorie',
    icon: Tag,
    quick: true,
    options: [], // À remplir dynamiquement
  },
  {
    key: 'stockStatus',
    type: 'select',
    label: 'Statut stock',
    icon: Package,
    quick: true,
    options: [
      { value: 'in_stock', label: 'En stock' },
      { value: 'low_stock', label: 'Stock faible' },
      { value: 'out_of_stock', label: 'Rupture' },
    ],
  },
  {
    key: 'priceRange',
    type: 'amount',
    label: 'Prix (CFA)',
    icon: DollarSign,
    quick: true,
    min: 0,
    step: 1000,
  },
  {
    key: 'supplier',
    type: 'select',
    label: 'Fournisseur',
    icon: Truck,
    quick: false,
    options: [], // À remplir dynamiquement
  },
  {
    key: 'container',
    type: 'select',
    label: 'Conteneur',
    icon: Package,
    quick: false,
    options: [], // À remplir dynamiquement
  },
  {
    key: 'warehouse',
    type: 'select',
    label: 'Entrepôt',
    icon: Package,
    quick: false,
    options: [], // À remplir dynamiquement
  },
  {
    key: 'stockRange',
    type: 'number',
    label: 'Quantité en stock',
    icon: Package,
    quick: false,
    min: 0,
    step: 1,
  },
  {
    key: 'hasDiscount',
    type: 'select',
    label: 'Remise',
    icon: TrendingUp,
    quick: false,
    options: [
      { value: 'yes', label: 'Avec remise' },
      { value: 'no', label: 'Sans remise' },
    ],
  },
];

// Filtres pour les dépenses
export const EXPENSES_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Description...',
    icon: Search,
    quick: true,
  },
  {
    key: 'dateRange',
    type: 'dateRange',
    label: 'Période',
    icon: Calendar,
    quick: true,
  },
  {
    key: 'category',
    type: 'select',
    label: 'Catégorie',
    icon: Tag,
    quick: true,
    options: [
      { value: 'salary', label: 'Salaire' },
      { value: 'rent', label: 'Loyer' },
      { value: 'utilities', label: 'Services publics' },
      { value: 'supplies', label: 'Fournitures' },
      { value: 'transport', label: 'Transport' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'other', label: 'Autre' },
    ],
  },
  {
    key: 'amountRange',
    type: 'amount',
    label: 'Montant (CFA)',
    icon: DollarSign,
    quick: true,
    min: 0,
    step: 1000,
  },
  {
    key: 'paymentMethod',
    type: 'select',
    label: 'Mode de paiement',
    icon: CreditCard,
    quick: false,
    options: [
      { value: 'cash', label: 'Espèces' },
      { value: 'card', label: 'Carte' },
      { value: 'mobile_money', label: 'Mobile Money' },
      { value: 'bank_transfer', label: 'Virement' },
      { value: 'cheque', label: 'Chèque' },
    ],
  },
  {
    key: 'createdBy',
    type: 'select',
    label: 'Créé par',
    icon: User,
    quick: false,
    options: [], // À remplir dynamiquement
  },
];

// Filtres pour les clients
export const CLIENTS_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Nom, téléphone, email...',
    icon: Search,
    quick: true,
  },
  {
    key: 'totalSpentRange',
    type: 'amount',
    label: 'Total dépensé (CFA)',
    icon: DollarSign,
    quick: true,
    min: 0,
    step: 10000,
  },
  {
    key: 'purchaseCountRange',
    type: 'number',
    label: 'Nombre d\'achats',
    icon: Package,
    quick: false,
    min: 0,
    step: 1,
  },
  {
    key: 'loyaltyTier',
    type: 'select',
    label: 'Niveau fidélité',
    icon: TrendingUp,
    quick: false,
    options: [
      { value: 'vip', label: 'VIP' },
      { value: 'loyal', label: 'Fidèle' },
      { value: 'regular', label: 'Regular' },
      { value: 'new', label: 'Nouveau' },
    ],
  },
  {
    key: 'hasDebt',
    type: 'select',
    label: 'Dette',
    icon: DollarSign,
    quick: false,
    options: [
      { value: 'yes', label: 'Avec dette' },
      { value: 'no', label: 'Sans dette' },
    ],
  },
];

// Filtres pour les employés
export const EMPLOYEES_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Nom, email, téléphone...',
    icon: Search,
    quick: true,
  },
  {
    key: 'position',
    type: 'select',
    label: 'Poste',
    icon: User,
    quick: true,
    options: [], // À remplir dynamiquement
  },
  {
    key: 'salaryRange',
    type: 'amount',
    label: 'Salaire (CFA)',
    icon: DollarSign,
    quick: false,
    min: 0,
    step: 10000,
  },
  {
    key: 'hireDateRange',
    type: 'dateRange',
    label: 'Date d\'embauche',
    icon: Calendar,
    quick: false,
  },
];

// Filtres pour les transactions bancaires
export const BANK_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Description...',
    icon: Search,
    quick: true,
  },
  {
    key: 'dateRange',
    type: 'dateRange',
    label: 'Période',
    icon: Calendar,
    quick: true,
  },
  {
    key: 'type',
    type: 'select',
    label: 'Type',
    icon: CreditCard,
    quick: true,
    options: [
      { value: 'deposit', label: 'Dépôt' },
      { value: 'withdraw', label: 'Retrait' },
    ],
  },
  {
    key: 'amountRange',
    type: 'amount',
    label: 'Montant (CFA)',
    icon: DollarSign,
    quick: true,
    min: 0,
    step: 1000,
  },
];

// Filtres pour les documents
export const DOCUMENTS_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Nom du document...',
    icon: Search,
    quick: true,
  },
  {
    key: 'dateRange',
    type: 'dateRange',
    label: 'Période',
    icon: Calendar,
    quick: true,
  },
  {
    key: 'type',
    type: 'select',
    label: 'Type de document',
    icon: FileText,
    quick: true,
    options: [
      { value: 'invoice', label: 'Facture' },
      { value: 'quote', label: 'Devis' },
      { value: 'receipt', label: 'Reçu' },
      { value: 'contract', label: 'Contrat' },
      { value: 'other', label: 'Autre' },
    ],
  },
  {
    key: 'createdBy',
    type: 'select',
    label: 'Créé par',
    icon: User,
    quick: false,
    options: [], // À remplir dynamiquement
  },
];

/**
 * Helper function to populate dynamic options
 * @param {Array} filterConfig - Filter configuration
 * @param {Object} dynamicOptions - Object with keys matching filter keys and values as option arrays
 * @returns {Array} Updated filter configuration
 */
export const populateDynamicOptions = (filterConfig, dynamicOptions) => {
  return filterConfig.map(filter => {
    if (dynamicOptions[filter.key]) {
      return {
        ...filter,
        options: dynamicOptions[filter.key],
      };
    }
    return filter;
  });
};
