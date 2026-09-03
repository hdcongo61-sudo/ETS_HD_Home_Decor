// Registre central des modales globales : les seules ouvertes via ModalContext
// et rendues par GlobalModals. Pour ajouter une modale :
//   1. ajouter son id à MODAL_IDS ;
//   2. l'enregistrer dans GLOBAL_MODALS avec son composant (et `adminOnly` si
//      elle est réservée aux admins).
// L'ouverture se fait partout avec `openModal(MODAL_IDS.X)` — jamais de chaîne
// en dur, ce qui évite les fautes de frappe silencieuses.
import GlobalSaleModal from '../components/GlobalSaleModal';
import GlobalPaymentModal from '../components/GlobalPaymentModal';
import GlobalExpenseModal from '../components/GlobalExpenseModal';

export const MODAL_IDS = {
  SALE: 'sale',
  PAYMENT: 'payment',
  EXPENSE: 'expense',
};

export const GLOBAL_MODALS = {
  [MODAL_IDS.SALE]: { component: GlobalSaleModal },
  [MODAL_IDS.PAYMENT]: { component: GlobalPaymentModal },
  // Ouverte aux admins et aux membres avec la permission `use_expenses`
  // (attribuée par un admin depuis la gestion des utilisateurs).
  [MODAL_IDS.EXPENSE]: { component: GlobalExpenseModal, permission: 'use_expenses' },
};
