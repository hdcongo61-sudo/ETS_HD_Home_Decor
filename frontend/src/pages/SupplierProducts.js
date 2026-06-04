import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  Coins,
  Package,
  RotateCcw,
  Search,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import api from '../services/api';
import {
  ProductActionButton,
  ProductEmptyState,
  ProductHero,
  ProductMetricCard,
  ProductPageShell,
  ProductSection,
} from '../components/ProductAnalyticsUI';
import { Workspace } from '../components/business';

const rangeOptions = [
  { value: 'day', label: '24 dernières heures' },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: 'year', label: '12 derniers mois' },
  { value: 'all', label: 'Toutes les périodes' },
];

const defaultTotals = {
  supplierCount: 0,
  productCount: 0,
  stockValue: 0,
  revenue: 0,
  profit: 0,
  unitsSold: 0,
};

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} CFA`;
const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const parseFilterNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const SupplierProducts = () => {
  const [range, setRange] = useState('month');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [productFilters, setProductFilters] = useState({
    search: '',
    category: '',
    minUnits: '',
    minRevenue: '',
    minProfit: '',
  });
  const [suppliers, setSuppliers] = useState([]);
  const [totals, setTotals] = useState(defaultTotals);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSupplierData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/products/by-supplier?range=${range}`);
        const { suppliers = [], totals = {}, generatedAt = '' } = res.data || {};
        setSuppliers(suppliers);
        setTotals({ ...defaultTotals, ...totals });
        setGeneratedAt(generatedAt);
      } catch (err) {
        console.error('Erreur lors du chargement des produits par fournisseur:', err);
        setError("Impossible de charger les données fournisseurs pour le moment.");
      } finally {
        setLoading(false);
      }
    };

    fetchSupplierData();
  }, [range]);

  const summaryCards = [
    { title: 'Fournisseurs actifs', value: formatNumber(totals.supplierCount), icon: Truck, tone: 'blue' },
    { title: 'Produits suivis', value: formatNumber(totals.productCount), icon: Package, tone: 'slate' },
    { title: 'Valeur du stock', value: formatCurrency(totals.stockValue), icon: Boxes, tone: 'sky' },
    { title: 'Revenus générés', value: formatCurrency(totals.revenue), icon: Wallet, tone: 'emerald' },
    { title: 'Profit total', value: formatCurrency(totals.profit), icon: TrendingUp, tone: 'violet' },
    { title: 'Unités vendues', value: formatNumber(totals.unitsSold), icon: Coins, tone: 'amber' },
  ];

  const supplierOptions = useMemo(
    () =>
      suppliers
        .map((supplier) => supplier.supplierName || 'Inconnu')
        .filter((supplierName, index, names) => names.indexOf(supplierName) === index)
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [suppliers]
  );

  const categoryOptions = useMemo(() => {
    const categories = suppliers.flatMap((supplier) =>
      (supplier.products || []).map((product) => product.category).filter(Boolean)
    );

    return [...new Set(categories)].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );
  }, [suppliers]);

  const hasProductFilters = Object.values(productFilters).some(
    (value) => String(value).trim() !== ''
  );

  const visibleSuppliers = useMemo(() => {
    const supplierScoped = supplierFilter
      ? suppliers.filter((supplier) => (supplier.supplierName || 'Inconnu') === supplierFilter)
      : suppliers;

    if (!hasProductFilters) return supplierScoped;

    const search = normalizeText(productFilters.search);
    const category = normalizeText(productFilters.category);
    const minUnits = parseFilterNumber(productFilters.minUnits);
    const minRevenue = parseFilterNumber(productFilters.minRevenue);
    const minProfit = parseFilterNumber(productFilters.minProfit);

    return supplierScoped
      .map((supplier) => ({
        ...supplier,
        products: (supplier.products || []).filter((product) => {
          const matchesSearch =
            !search ||
            normalizeText(product.name).includes(search) ||
            normalizeText(product.sku).includes(search);
          const matchesCategory = !category || normalizeText(product.category) === category;
          const matchesUnits = minUnits === null || Number(product.sold || 0) >= minUnits;
          const matchesRevenue = minRevenue === null || Number(product.revenue || 0) >= minRevenue;
          const matchesProfit = minProfit === null || Number(product.profit || 0) >= minProfit;

          return matchesSearch && matchesCategory && matchesUnits && matchesRevenue && matchesProfit;
        }),
      }))
      .filter((supplier) => supplier.products.length > 0);
  }, [suppliers, supplierFilter, productFilters, hasProductFilters]);

  const updateProductFilter = (key, value) => {
    setProductFilters((current) => ({ ...current, [key]: value }));
  };

  const resetProductFilters = () => {
    setProductFilters({ search: '', category: '', minUnits: '', minRevenue: '', minProfit: '' });
  };

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

  const supplierMetricCards = (supplier) => [
    { label: 'Revenu', value: formatCurrency(supplier.totalRevenue), tone: 'emerald' },
    { label: 'Profit', value: formatCurrency(supplier.totalProfit), tone: 'violet' },
    { label: 'Unités vendues', value: formatNumber(supplier.totalUnitsSold), tone: 'amber' },
    { label: 'Marge moy.', value: `${Number(supplier.averageMargin || 0).toFixed(1)} %`, tone: 'sky' },
  ];

  return (
  <Workspace>
    <ProductPageShell>
      <ProductHero
        eyebrow="Inventaire fournisseur"
        title="Produits par fournisseur"
        description="Analyse détaillée des performances produit par fournisseur, avec filtres par catégorie, volume, revenu et profit."
        meta={renderGeneratedAt()}
        onBack={() => navigate('/product-dashboard')}
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
              Période
              <select value={range} onChange={(e) => setRange(e.target.value)} className="form-control min-w-[190px] text-sm">
                {rangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
              Fournisseur
              <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="form-control min-w-[210px] text-sm">
                <option value="">Tous les fournisseurs</option>
                {supplierOptions.map((supplierName) => (
                  <option key={supplierName} value={supplierName}>
                    {supplierName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
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
          <motion.div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {summaryCards.map((card) => (
              <ProductMetricCard key={card.title} {...card} />
            ))}
          </motion.div>

          <ProductSection
            title="Filtres des produits"
            description="Filtre les lignes affichées dans chaque fournisseur."
            action={
              hasProductFilters ? (
                <ProductActionButton onClick={resetProductFilters} icon={RotateCcw}>
                  Réinitialiser
                </ProductActionButton>
              ) : null
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                Produit ou SKU
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={productFilters.search}
                    onChange={(e) => updateProductFilter('search', e.target.value)}
                    placeholder="Rechercher..."
                    className="form-control pl-9 text-sm font-normal normal-case tracking-normal"
                  />
                </div>
              </label>
              <FilterSelect label="Catégorie" value={productFilters.category} onChange={(value) => updateProductFilter('category', value)}>
                <option value="">Toutes les catégories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </FilterSelect>
              <FilterInput label="Ventes min." value={productFilters.minUnits} onChange={(value) => updateProductFilter('minUnits', value)} />
              <FilterInput label="Revenu min." value={productFilters.minRevenue} onChange={(value) => updateProductFilter('minRevenue', value)} />
              <FilterInput label="Profit min." value={productFilters.minProfit} onChange={(value) => updateProductFilter('minProfit', value)} />
            </div>
          </ProductSection>

          <ProductSection
            title="Résumé par fournisseur"
            description="Comparaison rapide du revenu, profit, unités vendues et marge moyenne."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Fournisseur</th>
                    <th className="px-4 py-3 text-right">Revenu</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                    <th className="px-4 py-3 text-right">Unités vendues</th>
                    <th className="px-4 py-3 text-right">Marge moy.</th>
                    <th className="px-4 py-3 text-right">Produits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visibleSuppliers.map((supplier) => (
                    <tr key={`summary-${supplier.supplierName}`} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/70">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        <Link to={`/suppliers/${encodeURIComponent(supplier.supplierName || 'Inconnu')}`} className="underline-offset-4 hover:underline">
                          {supplier.supplierName || 'Inconnu'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(supplier.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-violet-600">{formatCurrency(supplier.totalProfit)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatNumber(supplier.totalUnitsSold)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sky-700">{`${Number(supplier.averageMargin || 0).toFixed(1)} %`}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatNumber(supplier.totalProducts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleSuppliers.length === 0 && (
                <ProductEmptyState title="Aucun fournisseur" description="Aucun fournisseur à comparer avec ce filtre." />
              )}
            </div>
          </ProductSection>

          <div className="space-y-4">
            {visibleSuppliers.map((supplier) => (
              <motion.article
                key={supplier.supplierName}
                className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
                        <Link to={`/suppliers/${encodeURIComponent(supplier.supplierName || 'Inconnu')}`} className="underline-offset-4 hover:underline">
                          {supplier.supplierName || 'Inconnu'}
                        </Link>
                      </h2>
                      {supplier.supplierPhone && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{supplier.supplierPhone}</p>
                      )}
                    </div>
                    <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {formatNumber(supplier.totalProducts)} produits
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {supplierMetricCards(supplier).map((metric) => (
                      <SmallMetric key={`${supplier.supplierName}-${metric.label}`} {...metric} />
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SmallMetric label="Produits" value={formatNumber(supplier.totalProducts)} />
                    <SmallMetric label="Stock" value={formatCurrency(supplier.totalStockValue)} />
                    <SmallMetric label="Stock critique" value={formatNumber(supplier.lowStockCount)} tone="amber" />
                    <SmallMetric label="Rupture" value={formatNumber(supplier.outOfStockCount)} tone="rose" />
                  </div>
                </div>

                <ProductTable products={supplier.products || []} emptyText="Aucun produit enregistré pour ce fournisseur." />
              </motion.article>
            ))}

            {visibleSuppliers.length === 0 && !error && (
              <ProductEmptyState title="Aucun fournisseur" description="Aucun fournisseur à afficher pour la période sélectionnée." />
            )}
          </div>
        </>
      )}
    </ProductPageShell>
  </Workspace>
  );
};

const FilterInput = ({ label, value, onChange }) => (
  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
    {label}
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-control text-sm font-normal normal-case tracking-normal"
    />
  </label>
);

const FilterSelect = ({ label, value, onChange, children }) => (
  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-control text-sm font-normal normal-case tracking-normal"
    >
      {children}
    </select>
  </label>
);

const toneMap = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300',
  slate: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
};

const SmallMetric = ({ label, value, tone = 'slate' }) => (
  <div className={`flex min-h-[78px] flex-col justify-center rounded-2xl border p-3 ${toneMap[tone] || toneMap.slate}`}>
    <p className="text-xs font-medium opacity-80">{label}</p>
    <p className="mt-1 text-base font-bold sm:text-lg">{value}</p>
  </div>
);

const ProductTable = ({ products, emptyText }) => (
  <div className="overflow-x-auto -mx-2 sm:mx-0">
    <table className="responsive-table min-w-full text-sm">
      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left">Produit</th>
          <th className="px-3 py-2 text-left">Catégorie</th>
          <th className="px-3 py-2 text-right">Stock</th>
          <th className="px-3 py-2 text-right">Valeur stock</th>
          <th className="px-3 py-2 text-right">Ventes</th>
          <th className="px-3 py-2 text-right">Revenu</th>
          <th className="px-3 py-2 text-right">Profit</th>
          <th className="px-3 py-2 text-right">Marge</th>
        </tr>
      </thead>
      <tbody>
        {products.length > 0 ? (
          products.map((product) => (
            <tr key={product._id} className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/70">
              <td data-title="Produit" className="responsive-table__product-cell px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                <Link to={`/products/${product._id}`} className="underline-offset-4 hover:underline">
                  {product.name}
                </Link>
                {product.sku && <span className="ml-2 text-xs text-gray-400">{product.sku}</span>}
              </td>
              <td data-title="Catégorie" className="px-3 py-2 text-gray-500">{product.category || 'Non catégorisé'}</td>
              <td data-title="Stock" className="px-3 py-2 text-right">{formatNumber(product.stock)}</td>
              <td data-title="Valeur Stock" className="px-3 py-2 text-right">{formatCurrency(product.stockValue)}</td>
              <td data-title="Ventes" className="px-3 py-2 text-right">{formatNumber(product.sold)}</td>
              <td data-title="Revenu" className="px-3 py-2 text-right font-semibold text-emerald-600">{formatCurrency(product.revenue)}</td>
              <td data-title="Profit" className="px-3 py-2 text-right font-semibold text-violet-600">{formatCurrency(product.profit)}</td>
              <td data-title="Marge" className="px-3 py-2 text-right">{`${Number(product.margin || 0).toFixed(1)} %`}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8} className="px-3 py-5 text-center text-gray-500">
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default SupplierProducts;
