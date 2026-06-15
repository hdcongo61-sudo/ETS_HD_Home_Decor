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

      {/* Tableau principal */}
      <ProductSection title="Classement détaillé" description="Produits ordonnés par volume et performance financière.">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-[var(--colorNeutralStroke2)] text-sm">
          <thead className="bg-[var(--colorNeutralBackground2)]">
            <tr>
              {[
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

      {/* Cartes mobiles */}
      <div className="md:hidden space-y-4">
        {data.map((p, index) => (
          <div
            key={p._id || index}
            className="rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] p-4 shadow-sm"
            onClick={() => navigate(productPath(p))}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-base font-semibold text-[var(--colorNeutralForeground1)]">{p.name}</p>
                <p className="text-xs text-[var(--colorNeutralForeground3)]">{p.category || '—'}</p>
              </div>
              <span className="text-xs text-[var(--colorNeutralForeground3)]">#{index + 1}</span>
            </div>
            <p className="text-sm text-[var(--colorNeutralForeground3)] mt-1">
              Fournisseur : <span className="text-[var(--colorNeutralForeground2)]">{p.supplierName || '—'}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-xs text-[var(--colorNeutralForeground3)] uppercase">Unités vendues</p>
                <p className="font-semibold text-[var(--colorNeutralForeground1)]">{p.sold?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--colorNeutralForeground3)] uppercase">Revenu</p>
                <p className="font-semibold text-emerald-700">{p.revenue?.toLocaleString() || '—'} CFA</p>
              </div>
              <div>
                <p className="text-xs text-[var(--colorNeutralForeground3)] uppercase">Profit</p>
                <p className="font-semibold text-emerald-600">{p.profit?.toLocaleString() || '—'} CFA</p>
              </div>
              <div>
                <p className="text-xs text-[var(--colorNeutralForeground3)] uppercase">Marge</p>
                <p className="font-semibold text-indigo-600">
                  {p.margin ? p.margin.toFixed(1) + '%' : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      </ProductSection>

      {/* Statistiques globales */}
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
    </ProductPageShell>
  </Workspace>
  );
};

export default TopSellingProducts;
