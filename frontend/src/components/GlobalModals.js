import React, { useContext, useEffect, useRef } from 'react';
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
  const wasSuppressedRef = useRef(areGlobalModalsSuppressed);

  useEffect(() => {
    const suppressionJustStarted = areGlobalModalsSuppressed && !wasSuppressedRef.current;
    wasSuppressedRef.current = areGlobalModalsSuppressed;

    // Close a global modal when a page-level dialog opens over it. If a global
    // action is clicked while an existing dialog is finishing its close cycle,
    // keep that intent: the modal will render as soon as suppression is released.
    if (suppressionJustStarted && activeModal) {
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
