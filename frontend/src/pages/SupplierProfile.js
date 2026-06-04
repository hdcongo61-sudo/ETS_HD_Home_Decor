import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import {
  Button,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  Surface,
  Workspace,
} from '../components/business';

const rangeOptions = [
  { value: 'day', label: '24 dernières heures' },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: 'year', label: '12 derniers mois' },
  { value: 'all', label: 'Toutes les périodes' },
];

const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');

const SupplierProfile = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState('all');
  const [supplier, setSupplier] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const supplierName = useMemo(() => {
    if (!name) return '';
    try {
      return decodeURIComponent(name);
    } catch (err) {
      return name;
    }
  }, [name]);

  useEffect(() => {
    const fetchSupplier = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/products/by-supplier?range=${range}`);
        const suppliers = res.data?.suppliers || [];
        const match = suppliers.find(
          (s) =>
            (s.supplierName || '').trim().toLowerCase() ===
            supplierName.trim().toLowerCase()
        );
        setSupplier(match || null);
        setGeneratedAt(res.data?.generatedAt || '');
        if (!match) {
          setError('Aucun fournisseur correspondant pour cette période.');
        }
      } catch (err) {
        console.error('Erreur chargement profil fournisseur:', err);
        setError("Impossible de charger le profil fournisseur pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    if (supplierName) {
      fetchSupplier();
    } else {
      setLoading(false);
      setError('Fournisseur introuvable.');
    }
  }, [range, supplierName]);

  const summaryCards = supplier
    ? [
        {
          title: 'Produits',
          value: formatNumber(supplier.totalProducts),
          tone: 'info',
        },
        {
          title: 'Stock total',
          value: formatCurrency(supplier.totalStockValue),
          tone: 'neutral',
        },
        {
          title: 'Revenu total',
          value: formatCurrency(supplier.totalRevenue),
          tone: 'success',
        },
        {
          title: 'Profit total',
          value: formatCurrency(supplier.totalProfit),
          tone: 'success',
        },
        {
          title: 'Unités vendues',
          value: formatNumber(supplier.totalUnitsSold),
          tone: 'info',
        },
        {
          title: 'Marge moyenne',
          value: `${Number(supplier.averageMargin || 0).toFixed(1)} %`,
          tone: 'neutral',
        },
        {
          title: 'Stock critique',
          value: formatNumber(supplier.lowStockCount),
          tone: 'warning',
        },
        {
          title: 'Ruptures',
          value: formatNumber(supplier.outOfStockCount),
          tone: 'danger',
        },
      ]
    : [];

  const renderGeneratedAt = () => {
    if (!generatedAt) return null;
    try {
      const date = new Date(generatedAt);
      return `Actualisé le ${date.toLocaleDateString('fr-FR')} à ${date
        .toLocaleTimeString('fr-FR')
        .slice(0, 5)}`;
    } catch (err) {
      return null;
    }
  };

  if (loading) {
    return (
      <Workspace>
        <LoadingSkeleton rows={5} />
      </Workspace>
    );
  }

  if (error && !supplier) {
    return (
      <Workspace>
        <EmptyState
          title="Fournisseur introuvable"
          description={error}
          action={<Button onClick={() => navigate('/products/by-supplier')}>Retour aux fournisseurs</Button>}
        />
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PageHeader
        eyebrow="Inventaire fournisseur"
        title="Profil fournisseur"
        description={`${supplier?.supplierName || supplierName}${supplier?.supplierPhone ? ` - ${supplier.supplierPhone}` : ''}`}
        meta={renderGeneratedAt()}
        actions={<Button type="button" onClick={() => navigate('/products/by-supplier')}>Retour</Button>}
      />

      <CommandBar>
          <label htmlFor="range" className="text-sm font-medium text-gray-600">
            Période
          </label>
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="form-control w-auto min-w-[210px] text-sm"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
      </CommandBar>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <KPICard
            key={card.title}
            title={card.title}
            value={card.value}
            tone={card.tone}
          />
        ))}
      </div>

      <Surface>
        <div className="flex items-center justify-between mb-4">
          <h2 className="ms-section-title">
            Produits du fournisseur
          </h2>
          <span className="ms-page-meta">
            {formatNumber(supplier?.products?.length || 0)} produits
          </span>
        </div>

        <DataTable>
          <table className="responsive-table min-w-full text-sm">
            <thead>
              <tr>
                <th className="py-2 px-3 text-left">Produit</th>
                <th className="py-2 px-3 text-left">Catégorie</th>
                <th className="py-2 px-3 text-right">Stock</th>
                <th className="py-2 px-3 text-right">Valeur Stock</th>
                <th className="py-2 px-3 text-right">Ventes</th>
                <th className="py-2 px-3 text-right">Revenu</th>
                <th className="py-2 px-3 text-right">Profit</th>
                <th className="py-2 px-3 text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {supplier?.products && supplier.products.length > 0 ? (
                supplier.products.map((product) => (
                  <tr
                    key={`${supplier.supplierName}-${product._id}`}
                    className="cursor-pointer transition-colors"
                  >
                    <td data-title="Produit" className="py-2 px-3 font-medium text-gray-800 responsive-table__product-cell">
                      <Link
                        to={`/products/${product._id}`}
                        className="font-semibold text-[var(--ms-primary)] hover:underline"
                      >
                        {product.name}
                      </Link>
                      {product.sku && (
                        <span className="ml-2 text-xs text-gray-400">
                          {product.sku}
                        </span>
                      )}
                    </td>
                    <td data-title="Catégorie" className="py-2 px-3 text-gray-500">
                      {product.category || 'Non catégorisé'}
                    </td>
                    <td data-title="Stock" className="py-2 px-3 text-right">
                      {formatNumber(product.stock)}
                    </td>
                    <td data-title="Valeur Stock" className="py-2 px-3 text-right">
                      {formatCurrency(product.stockValue)}
                    </td>
                    <td data-title="Ventes" className="py-2 px-3 text-right">
                      {formatNumber(product.sold)}
                    </td>
                    <td data-title="Revenu" className="py-2 px-3 text-right font-semibold text-[var(--ms-success)]">
                      {formatCurrency(product.revenue)}
                    </td>
                    <td data-title="Profit" className="py-2 px-3 text-right font-semibold text-[var(--ms-primary)]">
                      {formatCurrency(product.profit)}
                    </td>
                    <td data-title="Marge" className="py-2 px-3 text-right">
                      {`${Number(product.margin || 0).toFixed(1)} %`}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-4 px-3 text-center text-gray-500"
                  >
                    Aucun produit enregistré pour ce fournisseur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DataTable>
      </Surface>
    </Workspace>
  );
};

export default SupplierProfile;
