import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ModalContext = createContext();

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [globalModalSuppressions, setGlobalModalSuppressions] = useState(0);

  const openModal = useCallback((modalName, data = null) => {
    setActiveModal(modalName);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  const suppressGlobalModals = useCallback(() => {
    setGlobalModalSuppressions((count) => count + 1);

    return () => {
      setGlobalModalSuppressions((count) => Math.max(0, count - 1));
    };
  }, []);

  const value = useMemo(() => ({
    activeModal,
    modalData,
    openModal,
    closeModal,
    suppressGlobalModals,
    areGlobalModalsSuppressed: globalModalSuppressions > 0,
  }), [activeModal, closeModal, globalModalSuppressions, modalData, openModal, suppressGlobalModals]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};
