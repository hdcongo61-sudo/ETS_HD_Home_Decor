import React from 'react';
import GroupedInventoryView from '../components/GroupedInventoryView';

const CategoryProducts = () => (
  <GroupedInventoryView
    endpoint="/products/by-category"
    eyebrow="Inventaire par catégorie"
    title="Produits par catégorie"
    description="Performance, stock et rentabilité de chaque catégorie de produits."
    groupSingular="catégorie"
    groupPlural="Catégories"
    showPhone={false}
    linkToProfile={false}
    csvPrefix="categories"
  />
);

export default CategoryProducts;
