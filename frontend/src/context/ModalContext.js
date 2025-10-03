import React, { createContext, useContext, useState } from 'react';

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

  const openModal = (modalName, data = null) => {
    setActiveModal(modalName);
    setModalData(data);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
  };

  const value = {
    activeModal,
    modalData,
    openModal,
    closeModal
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};