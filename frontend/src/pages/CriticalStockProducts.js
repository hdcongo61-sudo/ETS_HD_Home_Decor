import React, { useEffect, useState } from 'react';
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
import { Workspace } from '../components/business';

const CriticalStockProducts = () => {
  const [products, setProducts] = useState([]);
  const [, setError] = useState('');
  const [, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCriticalProducts = async () => {
      try {
        const res = await api.get('/products/dashboard');
        setProducts(res.data.lowStockProducts || []);
      } catch (err) {
        console.error(err);
        setError('Erreur lors du chargement des produits à stock critique.');
      } finally {
        setLoading(false);
      }
    };
    fetchCriticalProducts();
  }, []);

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
      <div className="hidden overflow-x-auto md:block">
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

      {/* Cartes mobiles */}
      <div className="md:hidden space-y-4">
        {products.map((p) => (
          <div
            key={p._id}
            className="rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] p-4 shadow-sm"
            onClick={() => navigate(productPath(p))}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-base font-semibold text-[var(--colorNeutralForeground1)]">{p.name}</p>
                <p className="text-xs text-[var(--colorNeutralForeground3)]">{p.category || '—'}</p>
              </div>
              <span className="text-xs text-[var(--colorStatusDangerForeground1)]">Stock: {p.stock}</span>
            </div>
            <p className="text-sm text-[var(--colorNeutralForeground3)] mt-1">
              Fournisseur : <span className="text-[var(--colorNeutralForeground2)]">{p.supplierName || '—'}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-xs text-[var(--colorNeutralForeground3)] uppercase">Prix</p>
                <p className="font-semibold text-[var(--colorNeutralForeground1)]">{p.price?.toLocaleString() || '—'} CFA</p>
              </div>
              <div>
                <p className="text-xs text-[var(--colorNeutralForeground3)] uppercase">Valeur</p>
                <p className="font-semibold text-[var(--colorStatusDangerForeground1)]">
                  {((p.stock || 0) * (p.price || 0)).toLocaleString()} CFA
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(productEditPath(p));
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radiusLarge)] bg-[var(--ms-blue)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--ms-blue-dark)]"
            >
              <Edit3 className="h-4 w-4" />
              Réapprovisionner
            </button>
          </div>
        ))}
      </div>
      </ProductSection>
    </ProductPageShell>
  </Workspace>
  );
};

export default CriticalStockProducts;
