// components/GlobalModals.js
import React from 'react';
import GlobalSaleModal from './GlobalSaleModal';
import GlobalPaymentModal from './GlobalPaymentModal';
import FloatingActionButton from './FloatingActionButton';

const GlobalModals = () => {
  return (
    <>
      <FloatingActionButton />
      <GlobalSaleModal />
      <GlobalPaymentModal />
    </>
  );
};

export default GlobalModals;