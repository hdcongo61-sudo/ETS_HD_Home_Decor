import React from 'react';
import GroupedInventoryView from '../components/GroupedInventoryView';

const WarehouseProducts = () => (
  <GroupedInventoryView
    endpoint="/products/by-warehouse"
    eyebrow="Inventaire entrepôt"
    title="Produits par entrepôt"
    description="Performance, stock et rentabilité de chaque entrepôt (dépôt)."
    groupSingular="entrepôt"
    groupPlural="Entrepôts"
    csvPrefix="entrepots"
  />
);

export default WarehouseProducts;
