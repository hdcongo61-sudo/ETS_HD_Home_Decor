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
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-950 dark:border-gray-700 dark:border-t-white"></div>
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
                  <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      <tr>
                        {['Produit', 'Catégorie', 'Fournisseur', 'Prix', 'Action'].map((header) => (
                          <th key={header} className="px-5 py-3 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {products.map((product) => (
                        <tr
                          key={product._id}
                          className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800/70"
                          onClick={() => navigate(productPath(product))}
                        >
                          <td className="px-5 py-4 font-semibold text-gray-950 dark:text-white">{product.name}</td>
                          <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{product.category || '—'}</td>
                          <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{product.supplierName || '—'}</td>
                          <td className="px-5 py-4 font-semibold text-gray-950 dark:text-white">{formatProductCurrency(product.price)}</td>
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
                      className="rounded-[22px] border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/70"
                      onClick={() => navigate(productPath(product))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-950 dark:text-white">{product.name}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{product.category || '—'}</p>
                        </div>
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                          Rupture
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        Fournisseur : <span className="font-medium text-gray-800 dark:text-gray-200">{product.supplierName || '—'}</span>
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-gray-950 dark:text-white">{formatProductCurrency(product.price)}</span>
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
