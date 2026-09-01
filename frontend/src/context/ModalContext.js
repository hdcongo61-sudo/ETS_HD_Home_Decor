import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ModalContext = createContext();

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

let nextModalKey = 0;

/**
 * Pile des modales globales ouvertes.
 * - `openModal(id, props)` empile une modale (une seule instance par id :
 *   la ré-ouvrir la fait remonter au sommet avec de nouvelles props).
 * - `closeModal(id?)` ferme la modale du sommet, ou celle dont l'id est donné.
 * - Le rendu est piloté par le registre central `config/modals.js` :
 *   les composants restent montés et lisent `isModalOpen(id)`, ce qui permet
 *   d'empiler plusieurs modales sans course ni comparaison de chaînes.
 */
export const ModalProvider = ({ children }) => {
  // [{ id, key, props }] — l'ordre du tableau est l'ordre d'affichage (z-order).
  const [modalStack, setModalStack] = useState([]);
  const [globalModalSuppressions, setGlobalModalSuppressions] = useState(0);

  const openModal = useCallback((modalId, props = null) => {
    setModalStack((stack) => [
      ...stack.filter((entry) => entry.id !== modalId),
      { id: modalId, key: nextModalKey++, props },
    ]);
  }, []);

  const closeModal = useCallback((modalId = null) => {
    setModalStack((stack) => {
      if (modalId === null) return stack.slice(0, -1);
      return stack.filter((entry) => entry.id !== modalId);
    });
  }, []);

  const closeAllModals = useCallback(() => setModalStack([]), []);

  const isModalOpen = useCallback(
    (modalId) => modalStack.some((entry) => entry.id === modalId),
    [modalStack]
  );

  const getModalProps = useCallback(
    (modalId) => modalStack.find((entry) => entry.id === modalId)?.props ?? null,
    [modalStack]
  );

  const suppressGlobalModals = useCallback(() => {
    setGlobalModalSuppressions((count) => count + 1);

    return () => {
      setGlobalModalSuppressions((count) => Math.max(0, count - 1));
    };
  }, []);

  // Rétro-compatibilité : id de la modale au sommet (utilisé pour masquer la
  // navigation / le FAB quand une modale est ouverte).
  const activeModal = modalStack.length > 0 ? modalStack[modalStack.length - 1].id : null;

  const value = useMemo(() => ({
    activeModal,
    modalStack,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalProps,
    suppressGlobalModals,
    areGlobalModalsSuppressed: globalModalSuppressions > 0,
  }), [
    activeModal,
    modalStack,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalProps,
    suppressGlobalModals,
    globalModalSuppressions,
  ]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};
