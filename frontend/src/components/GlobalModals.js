import React, { useContext, useEffect } from 'react';
import GlobalSaleModal from './GlobalSaleModal';
import GlobalPaymentModal from './GlobalPaymentModal';
import FloatingActionButton from './FloatingActionButton';
import AuthContext from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

const GlobalModals = () => {
  const { auth } = useContext(AuthContext);
  const { areGlobalModalsSuppressed, activeModal, closeModal } = useModal();

  useEffect(() => {
    if (areGlobalModalsSuppressed && activeModal) {
      closeModal();
    }
  }, [activeModal, areGlobalModalsSuppressed, closeModal]);

  if (!auth?.isAuthenticated || areGlobalModalsSuppressed) {
    return null;
  }

  return (
    <>
      <FloatingActionButton />
      <GlobalSaleModal />
      <GlobalPaymentModal />
    </>
  );
};

export default GlobalModals;
