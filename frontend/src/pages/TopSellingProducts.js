import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { productPath } from '../utils/paths';
import { TrendingUp, Trophy, Wallet } from 'lucide-react';
import {
  ProductHero,
  ProductMetricCard,
  ProductPageShell,
  ProductSection,
} from '../components/ProductAnalyticsUI';
import { Workspace } from '../components/business';

const TopSellingProducts = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get('/products/dashboard?range=month');
        setData(response.data.topSellingProducts || []);
      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement des produits les plus vendus.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-950"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-600 mt-8">{error}</p>;
  }

  return (
  <Workspace>
    <ProductPageShell>
      <ProductHero
        eyebrow="Performance produits"
        title="Produits les plus vendus"
        description="Classement basé sur les ventes récentes et bénéfices estimés."
        onBack={() => navigate('/product-dashboard')}
      />

      {/* Statistiques globales — synthèse avant le détail */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ProductMetricCard
          title="Revenu Total"
          value={`${data.reduce((sum, p) => sum + (p.revenue || 0), 0).toLocaleString()} CFA`}
          tone="sky"
          icon={Wallet}
        />
        <ProductMetricCard
          title="Profit Total"
          value={`${data.reduce((sum, p) => sum + (p.profit || 0), 0).toLocaleString()} CFA`}
          tone="emerald"
          icon={TrendingUp}
        />
        <ProductMetricCard
          title="Marge Moyenne"
          value={
            data.length
              ? (
                  data.reduce((sum, p) => sum + (p.margin || 0), 0) / data.length
                ).toFixed(1) + '%'
              : '0%'
          }
          tone="amber"
          icon={Trophy}
        />
      </div>

      {/* Tableau principal */}
      <ProductSection title="Classement détaillé" description="Produits ordonnés par volume et performance financière.">
      {/* Mobile cards */}
      <div className="lg:hidden space-y-3 p-3">
        {data.map((p, index) => (
          <div
            key={p._id || index}
            className="fluent-card-filled p-4 space-y-3 cursor-pointer"
            onClick={() => navigate(productPath(p))}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: 'var(--ms-blue-soft)',
                      color: 'var(--colorBrandForeground1)',
                    }}
                  >
                    {index + 1}
                  </span>
                  <p className="fui-body1-strong">{p.name}</p>
                </div>
                {p.category && (
                  <p className="fui-caption1 text-[var(--colorNeutralForeground3)] mt-1">{p.category}</p>
                )}
              </div>
            </div>

            {p.supplierName && (
              <div className="flex items-center gap-2 rounded-[var(--radiusMedium)] border px-3 py-2">
                <Wallet className="h-4 w-4 text-[var(--colorNeutralForeground3)]" />
                <span className="fui-caption1">{p.supplierName}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Unités vendues</p>
                <p className="fui-body1-strong tabular-nums">{(p.sold || 0).toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Prix unitaire</p>
                <p className="fui-body1-strong tabular-nums">{(p.price || 0).toLocaleString('fr-FR')} CFA</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t">
              <div>
                <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Revenu</p>
                <p className="fui-body1-strong tabular-nums" style={{color: 'var(--colorStatusSuccessForeground1)'}}>
                  {(p.revenue || 0).toLocaleString('fr-FR')} CFA
                </p>
              </div>
              <div>
                <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Profit</p>
                <p className="fui-body1-strong tabular-nums" style={{color: 'var(--colorStatusSuccessForeground1)'}}>
                  {(p.profit || 0).toLocaleString('fr-FR')} CFA
                </p>
              </div>
              <div>
                <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Marge</p>
                <p className="fui-body1-strong tabular-nums" style={{color: 'var(--ms-blue)'}}>
                  {p.margin ? p.margin.toFixed(1) + '%' : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--colorNeutralStroke2)] text-sm">
          <thead className="bg-[var(--colorNeutralBackground2)]">
            <tr>
              {[
                '#',
                'Produit',
                'Catégorie',
                'Fournisseur',
                'Prix (CFA)',
                'Unités Vendues',
                'Revenu Total',
                'Profit (CFA)',
                'Marge (%)',
              ].map((header) => (
                <th
                  key={header}
                  className="px-6 py-3 text-left font-medium uppercase text-[var(--colorNeutralForeground3)]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--colorNeutralStroke2)]">
            {data.map((p, index) => (
              <tr
                key={p._id || index}
                className="cursor-pointer transition hover:bg-[var(--colorNeutralBackground2)]"
                onClick={() => navigate(productPath(p))}
              >
                <td className="px-6 py-4 tabular-nums text-[var(--colorNeutralForeground3)]">{index + 1}</td>
                <td className="px-6 py-4 font-semibold text-[var(--colorNeutralForeground1)]">{p.name}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground3)]">{p.category || '—'}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground3)]">{p.supplierName || '—'}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground2)]">{p.price?.toLocaleString() || '—'}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground2)]">{p.sold?.toLocaleString() || 0}</td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground1)] font-semibold">
                  {p.revenue?.toLocaleString() || '—'} CFA
                </td>
                <td className="px-6 py-4 text-emerald-700 font-semibold">
                  {p.profit?.toLocaleString() || '—'} CFA
                </td>
                <td className="px-6 py-4 text-[var(--colorNeutralForeground2)] font-semibold">
                  {p.margin ? p.margin.toFixed(1) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </ProductSection>
    </ProductPageShell>
  </Workspace>
  );
};

export default TopSellingProducts;
