import React, { useContext, useEffect } from 'react';
import GlobalSaleModal from './GlobalSaleModal';
import GlobalPaymentModal from './GlobalPaymentModal';
import GlobalExpenseModal from './GlobalExpenseModal';
import FloatingActionButton from './FloatingActionButton';
import AuthContext from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

const GlobalModals = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin || auth?.isAdmin);
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
      <FloatingActionButton isAdmin={isAdmin} />
      <GlobalSaleModal />
      <GlobalPaymentModal />
      {isAdmin && <GlobalExpenseModal />}
    </>
  );
};

export default GlobalModals;
