import React, { useContext } from 'react';
import GlobalSaleModal from './GlobalSaleModal';
import GlobalPaymentModal from './GlobalPaymentModal';
import FloatingActionButton from './FloatingActionButton';
import AuthContext from '../context/AuthContext';

const GlobalModals = () => {
  const { auth } = useContext(AuthContext);

  if (!auth?.isAuthenticated) {
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
