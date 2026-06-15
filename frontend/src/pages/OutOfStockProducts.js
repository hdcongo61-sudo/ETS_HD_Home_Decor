import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Edit3, PackageX, Wallet } from 'lucide-react';
import api from '../services/api';
import { productEditPath, productPath } from '../utils/paths';
import {
  ProductActionButton,
  ProductEmptyState,
  ProductHero,
  ProductMetricCard,
  ProductPageShell,
  ProductSection,
  formatProductCurrency,
  formatProductNumber,
} from '../components/ProductAnalyticsUI';
import { Workspace } from '../components/business';

const OutOfStockProducts = () => {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOutOfStock = async () => {
      try {
        setLoading(true);
        const res = await api.get('/products/dashboard');
        setProducts(res.data.outOfStockProducts || []);
      } catch (err) {
        console.error(err);
        setError('Erreur lors du chargement des produits en rupture de stock.');
      } finally {
        setLoading(false);
      }
    };
    fetchOutOfStock();
  }, []);

  const totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
  <Workspace>
    <ProductPageShell>
      <ProductHero
        eyebrow="Alerte stock"
        title="Produits en rupture de stock"
        description="Articles actuellement épuisés et à réapprovisionner en priorité."
        onBack={() => navigate('/product-dashboard')}
      />

      {error && (
        <div className="rounded-[var(--radiusLarge)] border border-red-200 bg-red-50 px-4 py-3 text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-950"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ProductMetricCard title="Produits en rupture" value={formatProductNumber(products.length)} icon={PackageX} tone="rose" />
            <ProductMetricCard title="Valeur potentielle" value={formatProductCurrency(totalValue)} icon={Wallet} tone="amber" />
          </div>

          <ProductSection
            title="Liste des ruptures"
            description="Cliquez sur un produit pour voir sa fiche ou réapprovisionnez directement."
          >
            {products.length > 0 ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full divide-y divide-[var(--colorNeutralStroke2)] text-sm">
                    <thead className="bg-[var(--colorNeutralBackground2)] text-xs uppercase text-[var(--colorNeutralForeground3)]">
                      <tr>
                        {['Produit', 'Catégorie', 'Fournisseur', 'Prix', 'Action'].map((header) => (
                          <th key={header} className="px-5 py-3 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--colorNeutralStroke2)]">
                      {products.map((product) => (
                        <tr
                          key={product._id}
                          className="cursor-pointer transition hover:bg-[var(--colorNeutralBackground2)]"
                          onClick={() => navigate(productPath(product))}
                        >
                          <td className="px-5 py-4 font-semibold text-[var(--colorNeutralForeground1)]">{product.name}</td>
                          <td className="px-5 py-4 text-[var(--colorNeutralForeground3)]">{product.category || '—'}</td>
                          <td className="px-5 py-4 text-[var(--colorNeutralForeground3)]">{product.supplierName || '—'}</td>
                          <td className="px-5 py-4 font-semibold text-[var(--colorNeutralForeground1)]">{formatProductCurrency(product.price)}</td>
                          <td className="px-5 py-4">
                            <ProductActionButton
                              icon={Edit3}
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(productEditPath(product));
                              }}
                            >
                              Réapprovisionner
                            </ProductActionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {products.map((product) => (
                    <motion.article
                      key={product._id}
                      whileTap={{ scale: 0.99 }}
                      className="rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] p-4"
                      onClick={() => navigate(productPath(product))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--colorNeutralForeground1)]">{product.name}</p>
                          <p className="mt-1 text-xs text-[var(--colorNeutralForeground3)]">{product.category || '—'}</p>
                        </div>
                        <span className="rounded-full bg-[var(--colorStatusDangerBackground1)] px-2.5 py-1 text-xs font-semibold text-[var(--colorStatusDangerForeground1)]">
                          Rupture
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[var(--colorNeutralForeground3)]">
                        Fournisseur : <span className="font-medium text-[var(--colorNeutralForeground2)]">{product.supplierName || '—'}</span>
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[var(--colorNeutralForeground1)]">{formatProductCurrency(product.price)}</span>
                        <ProductActionButton
                          icon={Edit3}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(productEditPath(product));
                          }}
                        >
                          Réapprovisionner
                        </ProductActionButton>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </>
            ) : (
              <ProductEmptyState
                title="Aucune rupture"
                description="Tous les produits ont encore du stock disponible."
              />
            )}
          </ProductSection>
        </>
      )}
    </ProductPageShell>
  </Workspace>
  );
};

export default OutOfStockProducts;
