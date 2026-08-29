import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { catalogApi } from '../features/catalog/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Download,
  Package,
  PackageMinus,
  PackageX,
  Snail,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import {
  ProductActionButton,
  ProductHero,
  ProductMetricCard,
  ProductPageShell,
  ProductSection,
  formatProductCurrency,
  formatProductNumber,
} from '../components/ProductAnalyticsUI';
import { EmptyState, StatusBadge, Workspace } from '../components/business';
import { SERIE_REVENUE, SERIE_PROFIT } from '../utils/chartColors';

const GROUP_TABS = [
  { key: 'suppliers', label: 'Fournisseurs', nameKey: 'supplierName', detailPath: '/products/by-supplier', csv: 'Fournisseurs' },
  { key: 'containers', label: 'Conteneurs', nameKey: 'containerName', detailPath: '/products/by-container', csv: 'Conteneurs' },
  { key: 'warehouses', label: 'Entrepôts', nameKey: 'warehouseName', detailPath: '/products/by-warehouse', csv: 'Entrepots' },
  { key: 'categories', label: 'Catégories', nameKey: 'categoryName', detailPath: '/products/by-category', csv: 'Categories' },
];

const ProductDashboard = () => {
  const navigate = useNavigate();
  const topSellingTableRef = useRef(null);
  const groupTableRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupTab, setGroupTab] = useState('suppliers');

  const [stats, setStats] = useState({
    totalProducts: 0,
    soldProducts: 0,
    totalStockValue: 0,
    neverSoldStockValue: 0,
    neverSoldCount: 0,
    topSellingProducts: [],
    lowStockProducts: [],
    outOfStockProducts: [],
    salesTrend: [],
    supplierStats: [],
    containerStats: [],
    warehouseStats: [],
    categoryStats: []
  });

  const fetchData = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    try {
      const res = await catalogApi.dashboard();
      setStats({
        totalProducts: res.data.totalProducts || 0,
        soldProducts: res.data.soldProducts || 0,
        totalStockValue: res.data.totalStockValue || 0,
        neverSoldStockValue: res.data.neverSoldStockValue || 0,
        neverSoldCount: res.data.neverSoldProducts?.length || 0,
        topSellingProducts: res.data.topSellingProducts || [],
        lowStockProducts: res.data.lowStockProducts || [],
        outOfStockProducts: res.data.outOfStockProducts || [],
        salesTrend: res.data.salesTrend || [],
        supplierStats: res.data.supplierStats || [],
        containerStats: res.data.containerStats || [],
        warehouseStats: res.data.warehouseStats || [],
        categoryStats: res.data.categoryStats || []
      });
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement du tableau de bord produits.");
      if (!silent) toast.error("Erreur lors du chargement du tableau de bord.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // A sale created from the global modal changes stock — refresh silently.
  useEffect(() => {
    const refresh = () => fetchData({ silent: true });
    window.addEventListener('saleCreated', refresh);
    return () => window.removeEventListener('saleCreated', refresh);
  }, [fetchData]);

  useResponsiveTable(topSellingTableRef, [stats.topSellingProducts]);
  useResponsiveTable(groupTableRef, [groupTab, stats.supplierStats, stats.containerStats, stats.warehouseStats, stats.categoryStats]);

  const groupDataByTab = {
    suppliers: stats.supplierStats,
    containers: stats.containerStats,
    warehouses: stats.warehouseStats,
    categories: stats.categoryStats,
  };
  const activeTab = GROUP_TABS.find((t) => t.key === groupTab) || GROUP_TABS[0];
  const activeGroupData = (groupDataByTab[groupTab] || []).map((g) => ({
    ...g,
    groupName: g[activeTab.nameKey] || 'Inconnu',
    totalRevenue: Number(g.totalRevenue || 0),
    totalProfit: Number(g.totalProfit || 0),
    totalStockValue: Number(g.totalStockValue || 0),
    lowStockCount: Number(g.lowStockCount || 0),
    outOfStockCount: Number(g.outOfStockCount || 0),
  }));

  // 📦 Export du groupement affiché vers Excel
  const exportGroupToExcel = () => {
    if (!activeGroupData.length) {
      toast.error('Aucune donnée à exporter.');
      return;
    }

    const data = activeGroupData.map((g) => ({
      [activeTab.label.slice(0, -1)]: g.groupName,
      ...(groupTab === 'suppliers' ? { Téléphone: g.supplierPhone || '' } : {}),
      'Produits Totaux': g.totalProducts,
      'Stock Total (CFA)': g.totalStockValue.toLocaleString(),
      'Revenu Total (CFA)': g.totalRevenue.toLocaleString(),
      'Profit Total (CFA)': g.totalProfit.toLocaleString(),
      'Stock Critique': g.lowStockCount,
      'Ruptures': g.outOfStockCount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab.csv);

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `Statistiques_${activeTab.csv}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export Excel généré avec succès 📊');
  };

  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-950"></div>
      </div>
    );

  if (error)
    return <p className="mt-8 text-center text-red-600">{error}</p>;

  const outCount = stats.outOfStockProducts.length;
  const lowCount = stats.lowStockProducts.length;
  const groupChartData = activeGroupData.slice(0, 6);
  const groupCritical = activeGroupData.reduce((sum, g) => sum + g.lowStockCount, 0);
  const groupOut = activeGroupData.reduce((sum, g) => sum + g.outOfStockCount, 0);

  return (
  <Workspace>
    <ProductPageShell>
      <ProductHero
        eyebrow="Inventaire"
        title="Tableau de bord produits"
        description="Stock, ventes, marges et regroupements par fournisseur, conteneur et entrepôt."
        actions={
          <Link to="/products" className="ms-button ms-button-secondary ms-button-md">
            <Boxes className="h-4 w-4" />
            Gérer les produits
          </Link>
        }
      />

      {/* 🔔 Alertes stock — bandeau inline (remplace les toasts répétitifs) */}
      {(outCount > 0 || lowCount > 0) && (
        <div
          className="flex flex-col gap-2 rounded-[var(--radiusLarge)] border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: outCount > 0 ? 'var(--colorStatusDangerStroke1)' : 'var(--colorStatusWarningStroke1)',
            background: outCount > 0 ? 'var(--colorStatusDangerBackground1)' : 'var(--colorStatusWarningBackground1)',
          }}
          role="alert"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className="h-5 w-5 shrink-0"
              style={{ color: outCount > 0 ? 'var(--colorStatusDangerForeground1)' : 'var(--colorStatusWarningForeground1)' }}
            />
            <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
              {outCount > 0 && `${outCount} produit(s) en rupture`}
              {outCount > 0 && lowCount > 0 && ' · '}
              {lowCount > 0 && `${lowCount} produit(s) en stock critique`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {outCount > 0 && (
              <Link to="/products/out-of-stock" className="ms-button ms-button-danger ms-button-sm">
                Voir les ruptures <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {lowCount > 0 && (
              <Link to="/products/critical" className="ms-button ms-button-secondary ms-button-sm">
                Stock critique <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 1️⃣ Synthèse Globale */}
      <ProductSection
        title="Synthèse globale"
        description="Vue consolidée de l’inventaire et de la performance commerciale."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ProductMetricCard title="Total produits" value={formatProductNumber(stats.totalProducts)} icon={Package} tone="slate" />
          <ProductMetricCard title="Produits vendus" value={formatProductNumber(stats.soldProducts)} icon={TrendingUp} tone="emerald" />
          <ProductMetricCard title="Stock critique" value={formatProductNumber(lowCount)} icon={AlertTriangle} tone="amber" />
          <ProductMetricCard title="Rupture de stock" value={formatProductNumber(outCount)} icon={PackageX} tone="rose" />
          <ProductMetricCard title="Valeur totale du stock" value={formatProductCurrency(stats.totalStockValue)} icon={Wallet} tone="sky" />
          <ProductMetricCard title="Valeur des invendus" value={formatProductCurrency(stats.neverSoldStockValue)} icon={Boxes} tone="violet" />
        </div>

        {/* Graphique tendance ventes */}
        <div className="mt-5 h-52 rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.salesTrend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SERIE_PROFIT} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={SERIE_PROFIT} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v) => [formatProductCurrency(v), 'Ventes']} />
              <Area type="monotone" dataKey="value" stroke={SERIE_PROFIT} strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ProductSection>

      {/* 2️⃣ Liens Rapides — toutes les vues produits */}
      <motion.div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <QuickLinkCard title="Top ventes" subtitle="Produits performants" icon={Trophy} tone="emerald" path="/products/top-sellers" count={stats.topSellingProducts.length} />
        <QuickLinkCard title="Stock critique" subtitle="Sous le seuil d'alerte" icon={AlertTriangle} tone="amber" path="/products/critical" count={lowCount} />
        <QuickLinkCard title="Rupture de stock" subtitle="Stock épuisé" icon={PackageX} tone="rose" path="/products/out-of-stock" count={outCount} />
        <QuickLinkCard title="Jamais vendus" subtitle="Aucune vente enregistrée" icon={Boxes} tone="violet" path="/products/never-sold" count={stats.neverSoldCount} />
        <QuickLinkCard title="Produits lents" subtitle="Suggestions pour écouler" icon={Snail} tone="sky" path="/products/slow-movers" />
        <QuickLinkCard title="Pertes & cadeaux" subtitle="Sorties de stock hors vente" icon={PackageMinus} tone="slate" path="/products/losses" />
      </motion.div>

      {/* 3️⃣ Top produits — chiffres + graphique + classement */}
      <ProductSection
        title="Top produits vendus"
        description="Revenu et marge des produits les plus performants."
        action={<ProductActionButton onClick={() => navigate('/products/top-sellers')}>Classement complet</ProductActionButton>}
      >
        {stats.topSellingProducts.length === 0 ? (
          <EmptyState title="Pas encore de ventes" description="Le classement apparaîtra dès les premières ventes." />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topSellingProducts.slice(0, 8)} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--colorNeutralStroke2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} tickFormatter={(n) => (n && n.length > 12 ? `${n.slice(0, 12)}…` : n)} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => formatProductCurrency(v)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" fill={SERIE_REVENUE} name="Revenu" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill={SERIE_PROFIT} name="Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Mobile card layout */}
            <div className="lg:hidden space-y-3 mt-4">
              {stats.topSellingProducts.slice(0, 5).map((p, index) => (
                <div key={p._id} className="fluent-card-filled p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                          {index + 1}
                        </span>
                        <p className="fui-body1-strong">{p.name}</p>
                      </div>
                      {p.category && (
                        <p className="fui-caption1 text-[var(--colorNeutralForeground3)] mt-1">{p.category}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Quantité</p>
                      <p className="fui-body1-strong tabular-nums">{p.sold}</p>
                    </div>
                    <div>
                      <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Revenu</p>
                      <p className="fui-body1-strong tabular-nums" style={{ color: SERIE_REVENUE }}>{formatProductCurrency(p.revenue)}</p>
                    </div>
                    <div>
                      <p className="fui-caption2 text-[var(--colorNeutralForeground3)]">Marge</p>
                      <p className="fui-body1-strong tabular-nums" style={{ color: SERIE_PROFIT }}>{p.margin}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="mt-4 overflow-x-auto hidden lg:block">
              <table ref={topSellingTableRef} className="responsive-table min-w-full text-left text-sm">
                <thead className="bg-[var(--colorNeutralBackground2)] text-xs uppercase text-[var(--colorNeutralForeground3)]">
                  <tr>
                    <th className="py-2 px-3">Produit</th>
                    <th className="py-2 px-3">Catégorie</th>
                    <th className="py-2 px-3">Quantité</th>
                    <th className="py-2 px-3">Revenu</th>
                    <th className="py-2 px-3">Marge (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topSellingProducts.slice(0, 5).map((p) => (
                    <tr key={p._id} className="border-b border-[var(--colorNeutralStroke2)] transition hover:bg-[var(--colorNeutralBackground2)]">
                      <td className="py-2 px-3 font-medium text-[var(--colorNeutralForeground1)]">{p.name}</td>
                      <td className="py-2 px-3 text-[var(--colorNeutralForeground3)]">{p.category}</td>
                      <td className="py-2 px-3 tabular-nums">{p.sold}</td>
                      <td className="py-2 px-3 tabular-nums">{formatProductCurrency(p.revenue)}</td>
                      <td className="py-2 px-3 tabular-nums">{p.margin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ProductSection>

      {/* 4️⃣ Regroupements — un seul bloc à onglets */}
      <ProductSection
        title="Analyse par regroupement"
        description="Performance et risques de stock par fournisseur, conteneur ou entrepôt."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ProductActionButton onClick={() => navigate(activeTab.detailPath)}>Vue détaillée</ProductActionButton>
            <ProductActionButton onClick={exportGroupToExcel} variant="primary" icon={Download}>Export Excel</ProductActionButton>
          </div>
        }
      >
        {/* Onglets */}
        <div className="mb-4 inline-flex rounded-[var(--radiusMedium)] border p-0.5" style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground2)' }} role="tablist" aria-label="Type de regroupement">
          {GROUP_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={groupTab === tab.key}
              onClick={() => setGroupTab(tab.key)}
              className={`ms-button ms-button-sm ${groupTab === tab.key ? 'ms-button-primary' : 'bg-transparent border-transparent text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeGroupData.length === 0 ? (
          <EmptyState title="Aucune donnée" description={`Aucun ${activeTab.label.toLowerCase().slice(0, -1)} enregistré pour le moment.`} />
        ) : (
          <>
            {/* Résumé risques du groupement */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge tone="neutral">{activeGroupData.length} {activeTab.label.toLowerCase()}</StatusBadge>
              <StatusBadge tone={groupCritical > 0 ? 'warning' : 'success'}>
                {groupCritical} produit(s) en stock critique
              </StatusBadge>
              <StatusBadge tone={groupOut > 0 ? 'danger' : 'success'}>
                {groupOut} rupture(s)
              </StatusBadge>
            </div>

            {/* Graphique — un seul axe (CFA) : revenu & profit */}
            <div className="mb-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupChartData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--colorNeutralStroke2)" />
                  <XAxis dataKey="groupName" tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} tickFormatter={(n) => (n && n.length > 12 ? `${n.slice(0, 12)}…` : n)} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => formatProductCurrency(v)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalRevenue" fill={SERIE_REVENUE} name="Revenu" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalProfit" fill={SERIE_PROFIT} name="Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto">
              <table ref={groupTableRef} className="responsive-table min-w-full text-left text-sm">
                <thead className="bg-[var(--colorNeutralBackground2)] text-[var(--colorNeutralForeground3)] uppercase text-xs">
                  <tr>
                    <th className="py-2 px-3">{activeTab.label.slice(0, -1)}</th>
                    {groupTab === 'suppliers' && <th className="py-2 px-3">Téléphone</th>}
                    <th className="py-2 px-3">Produits</th>
                    <th className="py-2 px-3">Stock Total (CFA)</th>
                    <th className="py-2 px-3">Revenu Total (CFA)</th>
                    <th className="py-2 px-3">Profit Total (CFA)</th>
                    <th className="py-2 px-3">Stock Critique</th>
                    <th className="py-2 px-3">Ruptures</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGroupData.slice(0, 10).map((g, index) => (
                    <tr key={index} className="border-b border-[var(--colorNeutralStroke2)] hover:bg-[var(--colorNeutralBackground2)]">
                      <td className="py-2 px-3 font-medium">
                        {groupTab === 'suppliers' ? (
                          <Link
                            to={`/suppliers/${encodeURIComponent(g.groupName)}`}
                            className="text-[var(--ms-blue-dark)] hover:underline"
                          >
                            {g.groupName}
                          </Link>
                        ) : (
                          <span className="text-[var(--colorNeutralForeground1)]">{g.groupName}</span>
                        )}
                      </td>
                      {groupTab === 'suppliers' && (
                        <td className="py-2 px-3 text-[var(--colorNeutralForeground3)]">{g.supplierPhone || '—'}</td>
                      )}
                      <td className="py-2 px-3 tabular-nums">{g.totalProducts}</td>
                      <td className="py-2 px-3 tabular-nums">{formatProductCurrency(g.totalStockValue)}</td>
                      <td className="py-2 px-3 tabular-nums font-semibold" style={{ color: SERIE_REVENUE }}>
                        {formatProductCurrency(g.totalRevenue)}
                      </td>
                      <td className="py-2 px-3 tabular-nums font-semibold" style={{ color: SERIE_PROFIT }}>
                        {formatProductCurrency(g.totalProfit)}
                      </td>
                      <td className="py-2 px-3 tabular-nums" style={{ color: g.lowStockCount > 0 ? 'var(--colorStatusWarningForeground1)' : 'var(--colorNeutralForeground3)' }}>
                        {g.lowStockCount.toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2 px-3 tabular-nums" style={{ color: g.outOfStockCount > 0 ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground3)' }}>
                        {g.outOfStockCount.toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ProductSection>
    </ProductPageShell>
  </Workspace>
  );
};

// Sous-composants
const toneClasses = {
  slate: 'border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] text-[var(--colorNeutralForeground2)]',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-[var(--colorStatusDangerBackground1)] text-[var(--colorStatusDangerForeground1)]',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

const QuickLinkCard = ({ title, subtitle, icon: Icon, tone = 'slate', path, count }) => {
  const navigate = useNavigate();
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      onClick={() => navigate(path)}
      className="ms-surface cursor-pointer p-5 text-left transition-shadow hover:shadow-[var(--ms-shadow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
    >
      <div className="flex items-center justify-between">
        <div className={`rounded-[var(--radiusLarge)] border p-3 ${toneClasses[tone] || toneClasses.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
        {count > 0 && (
          <div className="rounded-full bg-[var(--colorNeutralBackground3)] px-2 py-0.5 text-xs font-semibold text-[var(--colorNeutralForeground2)] tabular-nums">
            {count}
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="fui-subtitle2 flex items-center gap-1" style={{ color: 'var(--colorNeutralForeground1)' }}>
          {title}
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--colorNeutralForeground3)' }} />
        </h3>
        <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>{subtitle}</p>
      </div>
    </motion.button>
  );
};

export default ProductDashboard;
