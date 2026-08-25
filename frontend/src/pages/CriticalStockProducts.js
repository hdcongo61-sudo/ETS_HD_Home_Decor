import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { productEditPath, productPath } from '../utils/paths';
import { AlertTriangle, BarChart3, Edit3, Wallet } from 'lucide-react';
import {
  ProductHero,
  ProductMetricCard,
  ProductPageShell,
  ProductSection,
} from '../components/ProductAnalyticsUI';
import { EmptyState, LoadingSkeleton, Workspace } from '../components/business';

const CriticalStockProducts = () => {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchCriticalProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/products/dashboard');
      setProducts(res.data.lowStockProducts || []);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des produits à stock critique.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCriticalProducts();
  }, [fetchCriticalProducts]);

  const totalValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);

  const chartData = products.map((p) => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name,
    stock: p.stock,
  }));

  return (
  <Workspace>
    <ProductPageShell>
      <ProductHero
        eyebrow="Stock"
        title="Produits à stock critique"
        description="Liste des articles dont le stock est inférieur à 5 unités."
        onBack={() => navigate('/product-dashboard')}
      />

      {error ? (
        <ProductSection title="Produits à traiter">
          <EmptyState
            title="Erreur de chargement"
            description={error}
            action={
              <button
                type="button"
                onClick={fetchCriticalProducts}
                className="ms-button ms-button-primary ms-button-md"
              >
                Réessayer
              </button>
            }
          />
        </ProductSection>
      ) : loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)]"
              />
            ))}
          </div>
          <ProductSection title="Produits à traiter" description="Chargement…">
            <LoadingSkeleton rows={6} />
          </ProductSection>
        </div>
      ) : (
      <>
      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ProductMetricCard title="Produits critiques" value={products.length} tone="amber" icon={AlertTriangle} />
        <ProductMetricCard
          title="Valeur Totale du Stock"
          value={`${totalValue.toLocaleString()} CFA`}
          tone="sky"
          icon={Wallet}
        />
        <ProductMetricCard
          title="Stock Moyen"
          value={
            products.length
              ? (products.reduce((sum, p) => sum + (p.stock || 0), 0) / products.length).toFixed(1)
              : '0'
          }
          tone="slate"
          icon={BarChart3}
        />
      </div>

      {/* Graphique */}
      {products.length > 0 && (
        <ProductSection title="Niveaux de stock" description="Vue rapide des produits critiques.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="stock" fill="#F59E0B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ProductSection>
      )}

      {/* Tableau */}
      <ProductSection title="Produits à traiter" description="Ouvrez la fiche ou réapprovisionnez directement.">
      {/* Mobile cards */}
      <div className="lg:hidden space-y-3 p-3">
        {products.map((p) => (
          <div
            key={p._id}
            className="fluent-card-filled p-4 space-y-3 cursor-pointer"
            onClick={() => navigate(productPath(p))}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="fui-body1-strong">{p.name}</p>
                {p.category && (
                  <p className="fui-caption1 text-[var(--colorNeutralForeground3)] mt-0.5">{p.category}</p>
                )}
              </div>
              <span
                className="inline-flex items-center gap-1 rounded-[var(--radiusMedium)] px-2 py-1 text-xs font-semibold"
                style={{
                  background: 'var(--colorPaletteRedBackground2)',
                  color: 'var(--colorStatusDangerForeground1)',
                }}
              >
                <AlertTriangle className="h-3 w-3" />
                {p.stock}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Prix</p>
                <p className="fui-body1-strong tabular-nums">{(p.price || 0).toLocaleString('fr-FR')} CFA</p>
              </div>
              <div>
                <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Valeur Totale</p>
                <p className="fui-body1-strong tabular-nums" style={{color: 'var(--colorStatusDangerForeground1)'}}>
                  {((p.stock || 0) * (p.price || 0)).toLocaleString('fr-FR')} CFA
                </p>
              </div>
            </div>

            {p.supplierName && (
              <div className="flex items-center gap-2 rounded-[var(--radiusMedium)] border px-3 py-2">
                <Wallet className="h-4 w-4 text-[var(--colorNeutralForeground3)]" />
                <span className="fui-caption1">{p.supplierName}</span>
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(productEditPath(p));
              }}
              className="w-full ms-button ms-button-primary ms-button-md"
            >
              <Edit3 className="h-4 w-4" />
              Réapprovisionner
            </button>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--colorNeutralStroke2)] text-sm">
          <thead className="bg-[var(--colorNeutralBackground2)]">
            <tr>
              {['Produit', 'Catégorie', 'Fournisseur', 'Prix (CFA)', 'Stock', 'Valeur Totale', 'Actions'].map((h) => (
                <th key={h} className="px-6 py-3 text-left font-medium uppercase text-[var(--colorNeutralForeground3)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--colorNeutralStroke2)]">
            {products.map((p) => (
              <tr
                key={p._id}
                className="cursor-pointer transition hover:bg-[var(--colorNeutralBackground2)]"
                onClick={() => navigate(productPath(p))}
              >
                <td className="px-6 py-4 font-semibold text-[var(--colorNeutralForeground1)]">{p.name}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground3)]">{p.category || '—'}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground3)]">{p.supplierName || '—'}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground2)]">{p.price?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 text-[var(--colorStatusDangerForeground1)] font-semibold">{p.stock}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground1)] font-semibold">
                  {((p.stock || 0) * (p.price || 0)).toLocaleString()} CFA
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(productEditPath(p));
                    }}
                    className="inline-flex items-center gap-2 rounded-[var(--radiusLarge)] bg-[var(--colorNeutralBackground3)] px-3 py-1.5 text-sm font-medium text-[var(--colorNeutralForeground2)] hover:bg-[var(--colorNeutralBackground4)]"
                  >
                    <Edit3 className="h-4 w-4" />
                    Réapprovisionner
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </ProductSection>
      </>
      )}
    </ProductPageShell>
  </Workspace>
  );
};

export default CriticalStockProducts;
