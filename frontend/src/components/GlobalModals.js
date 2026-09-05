import React, { useContext, useEffect, useRef } from 'react';
import FloatingActionButton from './FloatingActionButton';
import BackToTopButton from './BackToTopButton';
import AuthContext from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { GLOBAL_MODALS } from '../config/modals';

/**
 * Rendu de la pile des modales globales à partir du registre `config/modals.js`.
 * Les composants restent montés et dérivent leur état de `isModalOpen(id)` :
 * plusieurs modales peuvent donc être empilées, et l'ordre du DOM suit l'ordre
 * de la pile (la plus récente au-dessus).
 */
const GlobalModals = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin || auth?.isAdmin);
  const permissions = Array.isArray(auth?.user?.permissions) ? auth.user.permissions : [];
  const hasPermission = (permission) => isAdmin || permissions.includes(permission);
  const { areGlobalModalsSuppressed, modalStack, closeAllModals } = useModal();
  const wasSuppressedRef = useRef(areGlobalModalsSuppressed);

  useEffect(() => {
    const suppressionJustStarted = areGlobalModalsSuppressed && !wasSuppressedRef.current;
    wasSuppressedRef.current = areGlobalModalsSuppressed;

    // Une boîte de dialogue de page s'ouvre par-dessus une modale globale :
    // on vide la pile. Plus de course possible avec une modale « en cours
    // de fermeture » : la pile est la seule source de vérité.
    if (suppressionJustStarted && modalStack.length > 0) {
      closeAllModals();
    }
  }, [areGlobalModalsSuppressed, closeAllModals, modalStack.length]);

  if (!auth?.isAuthenticated || areGlobalModalsSuppressed) {
    return null;
  }

  return (
    <>
      <BackToTopButton />
      <FloatingActionButton canAddExpense={hasPermission('use_expenses')} />
      {Object.entries(GLOBAL_MODALS).map(([modalId, definition]) => {
        if (definition.adminOnly && !isAdmin) return null;
        if (definition.permission && !hasPermission(definition.permission)) return null;
        const Component = definition.component;
        const entry = modalStack.find((stackEntry) => stackEntry.id === modalId);
        return <Component key={modalId} {...(entry?.props || {})} />;
      })}
    </>
  );
};

export default GlobalModals;
