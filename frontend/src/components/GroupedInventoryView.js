import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { formatCfa as cfa } from '../utils/format';
import {
  KPICard, PageHeader, Workspace, EmptyState, LoadingSkeleton,
} from './business';
import {
  ArrowLeft, Search, ChevronDown, Download, Phone, ExternalLink,
  Boxes, Wallet, TrendingUp, Coins, AlertTriangle, PackageX, RefreshCw, Star,
} from 'lucide-react';

const RANGE_OPTIONS = [
  { value: 'day', label: '24 h' },
  { value: 'week', label: '7 j' },
  { value: 'month', label: '30 j' },
  { value: 'year', label: '12 mois' },
  { value: 'all', label: 'Tout' },
];

const SORT_OPTIONS = [
  { value: 'revenue', label: 'Revenu' },
  { value: 'profit', label: 'Bénéfice' },
  { value: 'stockValue', label: 'Valeur stock' },
  { value: 'units', label: 'Unités vendues' },
  { value: 'margin', label: 'Marge' },
  { value: 'products', label: 'Nb produits' },
];

// Filtres de risque appliqués aux groupes (même langage que le profil fournisseur)
const RISK_FILTERS = [
  { key: 'out', label: 'Rupture', matches: (g) => (g.outOfStockCount || 0) > 0 },
  { key: 'low', label: 'Stock bas', matches: (g) => (g.lowStockCount || 0) > 0 },
  { key: 'dead', label: 'Stock mort', matches: (g) => (g.deadStockCount || 0) > 0 },
];

const num = (v) => Number(v || 0).toLocaleString('fr-FR');
const pct = (v) => `${Number(v || 0).toFixed(1)} %`;

const sortGroups = (groups, key) => {
  const accessor = {
    revenue: (g) => g.totalRevenue,
    profit: (g) => g.totalProfit,
    stockValue: (g) => g.stockValue,
    units: (g) => g.totalUnitsSold,
    margin: (g) => g.averageMargin,
    products: (g) => g.totalProducts,
  }[key] || ((g) => g.totalRevenue);
  return [...groups].sort((a, b) => accessor(b) - accessor(a));
};

// Per-group product table. Its own ref/hook so each expanded group gets the
// mobile card layout (responsive-table) with proper field labels.
const GroupProductTable = ({ products }) => {
  const tableRef = useRef(null);
  useResponsiveTable(tableRef, [products]);
  return (
    <div className="border-t overflow-x-auto" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
      <table ref={tableRef} className="responsive-table w-full text-sm">
        <thead style={{ background: 'var(--colorNeutralBackground2)' }}>
          <tr>
            {['Produit', 'Catégorie', 'Stock', 'Valeur', 'Vendus', 'Revenu', 'Bénéfice', 'Marge'].map((h, i) => (
              <th key={h} className={`px-3 py-2 fui-caption1-strong ${i >= 2 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--colorNeutralForeground3)', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p._id} style={{ borderBottom: '1px solid var(--colorNeutralStroke3)', background: p.isDead ? 'var(--colorStatusWarningBackground1)' : 'transparent' }}>
              <td className="px-3 py-2">
                <Link to={`/products/${p._id}`} className="fui-body1-strong hover:underline" style={{ color: 'var(--colorBrandForeground1)' }}>{p.name}</Link>
                {p.isDead && <span className="ml-2 ms-status-badge ms-status-warning">mort</span>}
                {p.sku && <span className="ml-2 fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{p.sku}</span>}
              </td>
              <td className="px-3 py-2 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{p.category}</td>
              <td className="px-3 py-2 text-right tabular-nums" style={{ color: p.stock === 0 ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground2)' }}>{num(p.stock)}</td>
              <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{cfa(p.stockValue)}</td>
              <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{num(p.sold)}</td>
              <td className="px-3 py-2 text-right tabular-nums fui-body1-strong" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{cfa(p.revenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums fui-body1-strong" style={{ color: 'var(--colorBrandForeground1)' }}>{cfa(p.profit)}</td>
              <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{pct(p.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Shared analytics view for products grouped by supplier / container / warehouse.
 * The three pages differ only by endpoint + labels.
 */
const GroupedInventoryView = ({
  endpoint,
  eyebrow,
  title,
  description,
  groupSingular,          // e.g. "fournisseur"
  groupPlural,            // e.g. "fournisseurs"
  showPhone = false,
  linkToProfile = false,  // suppliers → /suppliers/:name
  csvPrefix = 'inventaire',
}) => {
  const navigate = useNavigate();
  const [range, setRange] = useState('month');
  const [groups, setGroups] = useState([]);
  const [totals, setTotals] = useState({});
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('revenue');
  const [expanded, setExpanded] = useState({});   // groupName -> bool
  const [riskFilter, setRiskFilter] = useState(''); // '' | 'out' | 'low' | 'dead'

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`${endpoint}?range=${range}`);
      const data = res.data || {};
      setGroups(Array.isArray(data.groups) ? data.groups : []);
      setTotals(data.totals || {});
      setGeneratedAt(data.generatedAt || '');
    } catch (err) {
      console.error('GroupedInventoryView load error:', err);
      setError('Impossible de charger les données pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData reads range/endpoint, listed below
  useEffect(() => { fetchData(); }, [range, endpoint]);

  const maxRevenue = useMemo(
    () => groups.reduce((m, g) => Math.max(m, g.totalRevenue || 0), 0) || 1,
    [groups]
  );
  const totalRevenue = useMemo(
    () => groups.reduce((sum, g) => sum + (g.totalRevenue || 0), 0),
    [groups]
  );
  // Nombre de groupes concernés par chaque filtre de risque (affiché sur les chips)
  const riskCounts = useMemo(
    () => Object.fromEntries(RISK_FILTERS.map((f) => [f.key, groups.filter(f.matches).length])),
    [groups]
  );

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = groups;
    if (q) {
      list = list.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        (g.products || []).some((p) => p.name.toLowerCase().includes(q))
      );
    }
    const risk = RISK_FILTERS.find((f) => f.key === riskFilter);
    if (risk) list = list.filter(risk.matches);
    return sortGroups(list, sortKey);
  }, [groups, search, sortKey, riskFilter]);

  const toggle = (name) => setExpanded((p) => ({ ...p, [name]: !p[name] }));
  const allExpanded = visibleGroups.length > 0 && visibleGroups.every((g) => expanded[g.name]);
  const toggleAll = () => {
    if (allExpanded) setExpanded({});
    else setExpanded(Object.fromEntries(visibleGroups.map((g) => [g.name, true])));
  };

  const exportCsv = () => {
    const header = [groupSingular, 'Produits', 'Catégories', 'Stock', 'Valeur stock', 'Coût stock', 'Revenu', 'Bénéfice', 'Marge %', 'Vendus', 'Écoulement %', 'Stock mort'];
    const rows = visibleGroups.map((g) => [
      g.name, g.totalProducts, g.categoryCount, g.totalStock, g.stockValue, g.stockCostValue,
      g.totalRevenue, g.totalProfit, g.averageMargin, g.totalUnitsSold, g.sellThroughRate, g.deadStockCount,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = ['﻿' + header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${csvPrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const metaLabel = generatedAt
    ? `Actualisé le ${new Date(generatedAt).toLocaleDateString('fr-FR')} à ${new Date(generatedAt).toLocaleTimeString('fr-FR').slice(0, 5)}`
    : null;

  return (
    <Workspace>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        meta={metaLabel}
        actions={
          <button onClick={() => navigate('/product-dashboard')} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5">
            <ArrowLeft size={14} /> Dashboard
          </button>
        }
      />

      {/* Range selector */}
      <div className="ms-command-bar flex-wrap gap-y-2">
        <span className="fui-caption1-strong uppercase mr-1" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>Période</span>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setRange(o.value)} className={`ms-button ms-button-sm ${range === o.value ? 'ms-button-primary' : 'ms-button-secondary'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={fetchData} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"><RefreshCw size={14} /> Actualiser</button>
          <button onClick={exportCsv} disabled={groups.length === 0} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"><Download size={14} /> CSV</button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radiusLarge)] px-4 py-3 fui-body1" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard title={groupPlural} value={num(totals.groupCount)} context={`${num(totals.productCount)} produits`} icon={<Boxes className="h-4 w-4" />} />
            <KPICard title="Valeur du stock" value={cfa(totals.stockValue)} context={`Coût: ${cfa(totals.stockCostValue)}`} icon={<Wallet className="h-4 w-4" />} tone="success" />
            <KPICard title="Revenu (période)" value={cfa(totals.revenue)} context={`Bénéfice: ${cfa(totals.profit)}`} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
            <KPICard title="Profit potentiel" value={cfa(totals.potentialProfit)} context={`${num(totals.deadStockCount)} en stock mort`} icon={<Coins className="h-4 w-4" />} tone={totals.deadStockCount > 0 ? 'warning' : 'neutral'} />
          </div>

          {/* Search + sort + controls */}
          <div className="ms-command-bar flex-wrap gap-y-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
              <input type="text" placeholder={`Rechercher un ${groupSingular} ou produit...`} value={search} onChange={(e) => setSearch(e.target.value)} className="ms-search-box" style={{ paddingLeft: 32 }} />
            </div>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="form-control w-auto text-sm min-h-[36px]">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Trier: {o.label}</option>)}
            </select>
            {RISK_FILTERS.map((f) => {
              const active = riskFilter === f.key;
              const count = riskCounts[f.key] || 0;
              return (
                <button
                  key={f.key}
                  onClick={() => setRiskFilter(active ? '' : f.key)}
                  disabled={count === 0 && !active}
                  aria-pressed={active}
                  className={`ms-button ms-button-sm flex items-center gap-1.5 disabled:opacity-45 ${active ? 'ms-button-primary' : 'ms-button-secondary'}`}
                >
                  {f.key === 'out' ? <PackageX size={14} /> : f.key === 'low' ? <AlertTriangle size={14} /> : <Boxes size={14} />}
                  {f.label}
                  {count > 0 && <span className="tabular-nums">({num(count)})</span>}
                </button>
              );
            })}
            <button onClick={toggleAll} className="ms-button ms-button-secondary ms-button-sm">
              {allExpanded ? 'Tout réduire' : 'Tout déplier'}
            </button>
          </div>

          {/* Groups */}
          {visibleGroups.length === 0 ? (
            <EmptyState title="Aucun résultat" description="Ajustez la recherche, le filtre ou la période." />
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((g, index) => {
                const isOpen = Boolean(expanded[g.name]);
                const sharePct = Math.round((g.totalRevenue / maxRevenue) * 100);
                const revenueShare = totalRevenue > 0 ? ((g.totalRevenue || 0) / totalRevenue) * 100 : 0;
                return (
                  <div key={g.name} className="fluent-card-filled overflow-hidden">
                    {/* Group header (click to expand) */}
                    <button type="button" onClick={() => toggle(g.name)} className="w-full text-left px-4 py-3.5 transition-colors hover:bg-[var(--colorNeutralBackground2)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full fui-caption1-strong tabular-nums"
                              style={{
                                background: index === 0 ? 'var(--colorStatusWarningBackground1)' : 'var(--colorNeutralBackground3)',
                                color: index === 0 ? 'var(--colorStatusWarningForeground1)' : 'var(--colorNeutralForeground2)',
                              }}
                              aria-label={`Rang ${index + 1}`}
                            >
                              {index + 1}
                            </span>
                            <span className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>{g.name}</span>
                            <span className="ms-status-badge ms-status-neutral">{num(g.totalProducts)} produits</span>
                            {g.categoryCount > 0 && <span className="ms-status-badge ms-status-neutral">{num(g.categoryCount)} catég.</span>}
                            {g.outOfStockCount > 0 && <span className="ms-status-badge ms-status-danger">{num(g.outOfStockCount)} rupture</span>}
                            {g.lowStockCount > 0 && <span className="ms-status-badge ms-status-warning">{num(g.lowStockCount)} stock bas</span>}
                            {g.deadStockCount > 0 && <span className="ms-status-badge ms-status-warning">{num(g.deadStockCount)} stock mort</span>}
                          </div>
                          {(showPhone && g.supplierPhone) || g.topProduct?.name ? (
                            <p className="fui-caption1 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                              {showPhone && g.supplierPhone && (
                                <span className="flex items-center gap-1"><Phone size={11} /> {g.supplierPhone}</span>
                              )}
                              {g.topProduct?.name && (
                                <span className="flex items-center gap-1 min-w-0">
                                  <Star size={11} className="shrink-0" /> Top : <span className="truncate" style={{ color: 'var(--colorNeutralForeground2)' }}>{g.topProduct.name}</span>
                                </span>
                              )}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {linkToProfile && (
                            <Link to={`/suppliers/${encodeURIComponent(g.name)}`} onClick={(e) => e.stopPropagation()} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1" title="Profil">
                              <ExternalLink size={12} /> Profil
                            </Link>
                          )}
                          <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--colorNeutralForeground3)' }} />
                        </div>
                      </div>

                      {/* Stat row */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {[
                          { label: 'Revenu', value: cfa(g.totalRevenue), color: 'var(--colorStatusSuccessForeground1)' },
                          { label: 'Bénéfice', value: cfa(g.totalProfit), color: 'var(--colorBrandForeground1)' },
                          { label: 'Marge', value: pct(g.averageMargin) },
                          { label: 'Écoulement', value: pct(g.sellThroughRate) },
                          { label: 'Valeur stock', value: cfa(g.stockValue) },
                          { label: 'Vendus', value: num(g.totalUnitsSold) },
                        ].map((s) => (
                          <div key={s.label} className="rounded-[var(--radiusMedium)] p-2" style={{ background: 'var(--colorNeutralBackground2)' }}>
                            <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{s.label}</p>
                            <p className="fui-body1-strong tabular-nums" style={{ color: s.color || 'var(--colorNeutralForeground1)' }}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Revenue share bar (largeur relative au meilleur groupe, % du revenu total) */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--colorNeutralBackground3)' }}>
                          <div className="h-full rounded-full" style={{ width: `${sharePct}%`, background: 'var(--colorBrandBackground)' }} />
                        </div>
                        {totalRevenue > 0 && (
                          <span className="fui-caption2 shrink-0 tabular-nums" style={{ color: 'var(--colorNeutralForeground3)' }}>
                            {revenueShare.toFixed(0)} % du revenu
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Product table */}
                    {isOpen && <GroupProductTable products={g.products} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Workspace>
  );
};

export default GroupedInventoryView;
