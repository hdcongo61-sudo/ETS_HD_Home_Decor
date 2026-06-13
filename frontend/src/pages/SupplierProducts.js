import React from 'react';
import GroupedInventoryView from '../components/GroupedInventoryView';

const SupplierProducts = () => (
  <GroupedInventoryView
    endpoint="/products/by-supplier"
    eyebrow="Inventaire fournisseur"
    title="Produits par fournisseur"
    description="Performance, stock et rentabilité de chaque fournisseur."
    groupSingular="fournisseur"
    groupPlural="Fournisseurs"
    showPhone
    linkToProfile
    csvPrefix="fournisseurs"
  />
);

export default SupplierProducts;
