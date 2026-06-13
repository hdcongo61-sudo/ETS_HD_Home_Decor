import React from 'react';
import GroupedInventoryView from '../components/GroupedInventoryView';

const ContainerProducts = () => (
  <GroupedInventoryView
    endpoint="/products/by-container"
    eyebrow="Inventaire conteneur"
    title="Produits par conteneur"
    description="Performance, stock et rentabilité de chaque conteneur."
    groupSingular="conteneur"
    groupPlural="Conteneurs"
    csvPrefix="conteneurs"
  />
);

export default ContainerProducts;
