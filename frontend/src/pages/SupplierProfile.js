import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '../features/catalog/api';
import { formatCfa as cfa } from '../utils/format';
import {
  KPICard, PageHeader, Workspace, EmptyState, LoadingSkeleton,
} from '../components/business';
import {
  ArrowLeft, Search,
  TrendingUp, Wallet, Coins, PackageX, Star, Boxes, AlertTriangle, Crown,
  BarChart3,
} from 'lucide-react';

const RANGE_OPTIONS = [
  { value: 'day', label: '24 h' },
  { value: 'week', label: '7 j' },
  { value: 'month', label: '30 j' },
  { value: 'year', label: '12 mois' },
  { value: 'all', label: 'Tout' },
];

// Filtres d'état du stock appliqués au tableau des produits
const STOCK_FILTERS = [
  { key: '', label: 'Tous' },
  { key: 'out', label: 'Rupture' },
  { key: 'low', label: 'Stock bas' },
  { key: 'dead', label: 'Stock mort' },
];

const LOW_STOCK_THRESHOLD = 5; // convention app : « moins de 5 unités »

const num = (v) => Number(v || 0).toLocaleString('fr-FR');
const pct = (v) => `${Number(v || 0).toFixed(1)} %`;
const initialsOf = (s) => (s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const matchesStockFilter = (p, filter) => {
  if (filter === 'out') return (p.stock || 0) === 0;
  if (filter === 'low') return (p.stock || 0) > 0 && p.stock < LOW_STOCK_THRESHOLD;
  if (filter === 'dead') return Boolean(p.isDead);
  return true;
};

const SupplierViewButton = ({ active, onClick, icon, label, badge }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-[var(--radiusMedium)] px-2 text-sm font-semibold transition sm:px-4 ${
      active
        ? 'bg-[var(--ms-blue)] text-white shadow-[var(--ms-shadow-sm)]'
        : 'text-[var(--ms-text-muted)] hover:bg-white hover:text-[var(--ms-text)]'
    }`}
  >
    {icon}
    <span className="truncate">{label}</span>
    {badge !== undefined && (
      <span className={`hidden min-w-5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums sm:inline ${active ? 'bg-white/20 text-white' : 'bg-white text-[var(--ms-text-muted)]'}`}>
        {num(badge)}
      </span>
    )}
  </button>
);

// Pastille d'état du stock : rupture / bas / normal
const StockPill = ({ p }) => {
  const stock = Number(p.stock) || 0;
  const tone = stock === 0 ? 'danger' : stock < LOW_STOCK_THRESHOLD ? 'warning' : 'success';
  const [bg, fg] = {
    danger: ['var(--colorStatusDangerBackground1)', 'var(--colorStatusDangerForeground1)'],
    warning: ['var(--colorStatusWarningBackground1)', 'var(--colorStatusWarningForeground1)'],
    success: ['var(--colorStatusSuccessBackground1)', 'var(--colorStatusSuccessForeground1)'],
  }[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 fui-caption1-strong"
      style={{ background: bg, color: fg }}
      title={stock === 0 ? 'Rupture de stock' : stock < LOW_STOCK_THRESHOLD ? 'Stock bas' : 'En stock'}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />
      {stock === 0 ? 'Rupture' : num(stock)}
    </span>
  );
};

// Marge en % + jauge de progression
const MarginCell = ({ p }) => {
  const m = Number(p.margin) || 0;
  const clamped = Math.min(Math.max(m, 0), 100);
  const color = m < 0 ? 'var(--colorStatusDangerForeground1)' : 'var(--colorBrandForeground1)';
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="fui-caption1-strong shrink-0 tabular-nums" style={{ color }}>{pct(p.margin)}</span>
      <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full" style={{ background: 'var(--colorNeutralBackground3)' }}>
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
      </div>
    </div>
  );
};

const SupplierProfile = () => {
  const { name } = useParams();
  const navigate = useNavigate();

  const [range, setRange] = useState('all');
  const [supplier, setSupplier] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('revenue');
  const [stockFilter, setStockFilter] = useState('');
  const [activeView, setActiveView] = useState('analytics');

  const supplierName = useMemo(() => {
    if (!name) return '';
    try { return decodeURIComponent(name); } catch { return name; }
  }, [name]);

  useEffect(() => {
    const fetchSupplier = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await catalogApi.bySupplier({ range });
        const suppliers = res.data?.suppliers || res.data?.groups || [];
        const match = suppliers.find(
          (s) => (s.name || s.supplierName || '').trim().toLowerCase() === supplierName.trim().toLowerCase()
        );
        setSupplier(match || null);
        setGeneratedAt(res.data?.generatedAt || '');
        if (!match) setError('Aucun fournisseur correspondant pour cette période.');
      } catch (err) {
        console.error('Erreur chargement profil fournisseur:', err);
        setError("Impossible de charger le profil fournisseur pour le moment.");
      } finally {
        setLoading(false);
      }
    };
    if (supplierName) fetchSupplier();
    else { setLoading(false); setError('Fournisseur introuvable.'); }
  }, [range, supplierName]);

  const allProducts = useMemo(() => supplier?.products || [], [supplier]);

  // ----- Top produits par revenu (part du revenu total) -----
  const topByRevenue = useMemo(
    () => [...allProducts].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 5),
    [allProducts]
  );
  const maxRevenue = Math.max(1, ...topByRevenue.map((p) => Number(p.revenue) || 0));

  // ----- Tableau : recherche + filtre d'état + tri -----
  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allProducts.filter(
      (p) =>
        matchesStockFilter(p, stockFilter) &&
        (!q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
    );
    const acc = {
      revenue: (p) => p.revenue, profit: (p) => p.profit, stock: (p) => p.stock,
      sold: (p) => p.sold, margin: (p) => p.margin,
    }[sortKey] || ((p) => p.revenue);
    return [...filtered].sort((a, b) => acc(b) - acc(a));
  }, [allProducts, search, sortKey, stockFilter]);

  const metaLabel = generatedAt
    ? `Actualisé le ${new Date(generatedAt).toLocaleDateString('fr-FR')} à ${new Date(generatedAt).toLocaleTimeString('fr-FR').slice(0, 5)}`
    : null;

  if (loading) return <Workspace><LoadingSkeleton rows={6} /></Workspace>;

  if (error && !supplier) {
    return (
      <Workspace>
        <EmptyState
          title="Fournisseur introuvable"
          description={error}
          action={<button onClick={() => navigate('/products/by-supplier')} className="ms-button ms-button-secondary ms-button-md">Retour aux fournisseurs</button>}
        />
      </Workspace>
    );
  }

  const topProduct = supplier?.topProduct;
  const outCount = Number(supplier?.outOfStockCount) || 0;
  const lowCount = Number(supplier?.lowStockCount) || 0;
  const deadCount = Number(supplier?.deadStockCount) || 0;

  // Statistique compacte de composition du portefeuille
  const Stat = ({ label, value }) => (
    <div className="min-w-0">
      <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
      <p className="fui-subtitle1 truncate tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{value}</p>
    </div>
  );

  // Tuile santé cliquable — sert de filtre au tableau des produits
  const HealthTile = ({ filterKey, icon, iconBg, iconFg, label, value }) => {
    const active = stockFilter === filterKey;
    return (
      <button
        type="button"
        onClick={() => {
          setStockFilter(active ? '' : filterKey);
          setSearch('');
          setActiveView('products');
        }}
        aria-pressed={active}
        className="fluent-card-filled p-4 flex items-center gap-3 text-left transition-shadow hover:shadow-[var(--ms-shadow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
        style={active ? { boxShadow: '0 0 0 1.5px var(--colorBrandBackground)' } : undefined}
      >
        <span className="ms-kpi-icon shrink-0" style={{ background: iconBg, color: iconFg }}>{icon}</span>
        <div>
          <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
          <p className="fui-subtitle1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{value}</p>
          <p className="fui-caption1" style={{ color: 'var(--colorBrandForeground1)' }}>{active ? 'Voir tous les produits' : 'Voir ces produits'}</p>
        </div>
      </button>
    );
  };

  return (
    <Workspace className="space-y-6">
      <PageHeader
        eyebrow="Partenaires & approvisionnement"
        title={supplier?.name || supplier?.supplierName || supplierName}
        description="Ses produits et la performance de ce fournisseur, période par période."
        meta={metaLabel}
        actions={
          <button onClick={() => navigate('/products/by-supplier')} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5">
            <ArrowLeft size={14} /> Fournisseurs
          </button>
        }
      />

      {/* Période d'analyse */}
      <section className="fluent-card-filled flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="fui-subtitle2 flex items-center gap-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
            <TrendingUp size={15} /> Période d'analyse
          </p>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Les analyses et le tableau des produits reflètent la période sélectionnée.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-1 rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-white p-1" role="group" aria-label="Période d'analyse">
          {RANGE_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setRange(o.value)} aria-pressed={range === o.value} className={`min-h-[36px] rounded-[var(--radiusSmall,4px)] px-2 text-xs font-semibold transition sm:px-3 ${range === o.value ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text-muted)] hover:bg-[var(--ms-bg-subtle)]'}`}>{o.label}</button>
          ))}
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-2 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-1.5" aria-label="Sections du fournisseur">
        <SupplierViewButton active={activeView === 'analytics'} onClick={() => setActiveView('analytics')} icon={<BarChart3 size={16} />} label="Analyses" />
        <SupplierViewButton
          active={activeView === 'products'}
          onClick={() => {
            setActiveView('products');
            setStockFilter('');
            setSearch('');
          }}
          icon={<Boxes size={16} />}
          label="Produits"
          badge={allProducts.length}
        />
      </nav>

      {/* ===== Analyses ===== */}
      {activeView === 'analytics' && (<>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Revenu (période)" value={cfa(supplier?.totalRevenue)} context={`Bénéfice: ${cfa(supplier?.totalProfit)}`} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <KPICard title="Bénéfice (période)" value={cfa(supplier?.totalProfit)} context={`${num(supplier?.totalUnitsSold)} unités vendues`} icon={<Coins className="h-4 w-4" />} tone="success" />
        <KPICard title="Valeur du stock" value={cfa(supplier?.stockValue)} context={`Coût: ${cfa(supplier?.stockCostValue)}`} icon={<Wallet className="h-4 w-4" />} />
        <KPICard title="Marge moyenne" value={pct(supplier?.averageMargin)} context={`Écoulement: ${pct(supplier?.sellThroughRate)}`} icon={<Star className="h-4 w-4" />} tone="neutral" />
      </div>

      {/* Composition du portefeuille */}
      <div className="fluent-card-filled grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-4">
        <Stat label="Produits" value={num(supplier?.totalProducts)} />
        <Stat label="Unités en stock" value={num(supplier?.totalStock)} />
        <Stat label="Profit potentiel" value={cfa(supplier?.potentialProfit)} />
        <Stat label="Catégories" value={num(supplier?.categoryCount)} />
      </div>

      {/* Santé du stock — tuiles cliquables (filtrent le tableau) + top produit */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <HealthTile
          filterKey="out"
          icon={<PackageX size={16} />}
          iconBg="var(--colorStatusDangerBackground1)"
          iconFg="var(--colorStatusDangerForeground1)"
          label="Ruptures"
          value={num(outCount)}
        />
        <HealthTile
          filterKey="low"
          icon={<AlertTriangle size={16} />}
          iconBg="var(--colorStatusWarningBackground1)"
          iconFg="var(--colorStatusWarningForeground1)"
          label="Stock bas"
          value={num(lowCount)}
        />
        <HealthTile
          filterKey="dead"
          icon={<Boxes size={16} />}
          iconBg="var(--colorNeutralBackground3)"
          iconFg="var(--colorNeutralForeground2)"
          label="Stock mort"
          value={num(deadCount)}
        />
        <div className="fluent-card-filled p-4 flex items-center gap-3">
          <span className="ms-kpi-icon shrink-0" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}><Star size={16} /></span>
          <div className="min-w-0">
            <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Top produit</p>
            <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{topProduct?.name || '—'}</p>
          </div>
        </div>
      </div>

      {/* ===== Top produits — part du revenu ===== */}
      {topByRevenue.length > 0 && (supplier?.totalRevenue || 0) > 0 && (
        <div className="fluent-card-filled p-5">
          <p className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Top produits — revenu</p>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Part de chaque produit dans le revenu de la période
          </p>
          <div className="mt-4 space-y-2">
            {topByRevenue.map((p, i) => {
              const share = ((Number(p.revenue) || 0) / maxRevenue) * 100;
              const revenueShare = supplier?.totalRevenue ? ((Number(p.revenue) || 0) / supplier.totalRevenue) * 100 : 0;
              return (
                <Link key={p._id} to={`/products/${p._id}`} className="block rounded-[var(--radiusMedium)] px-2 py-1.5 -mx-2 transition-colors hover:bg-[var(--ms-bg-subtle)]">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full fui-caption1-strong tabular-nums"
                      style={{
                        background: i === 0 ? 'var(--colorStatusWarningBackground1)' : 'var(--colorNeutralBackground3)',
                        color: i === 0 ? 'var(--colorStatusWarningForeground1)' : 'var(--colorNeutralForeground2)',
                      }}
                    >
                      {i === 0 ? <Crown className="h-3 w-3" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="fui-caption1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{p.name}</span>
                        <span className="fui-caption1-strong shrink-0 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>
                          {cfa(p.revenue)} <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>({revenueShare.toFixed(0)} %)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--colorNeutralBackground3)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(3, share)}%`, background: 'var(--colorBrandBackground)' }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      </>)}

      {/* ===== Tableau des produits ===== */}
      {activeView === 'products' && <div className="fluent-card-filled overflow-hidden">
        <div className="ms-command-bar flex-wrap gap-y-2" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
          <p className="fui-subtitle2 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground1)' }}>
            <Boxes size={15} /> Produits ({num(products.length)} sur {num(allProducts.length)})
          </p>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <div className="inline-flex rounded-[var(--radiusMedium)] border p-0.5" style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground2)' }} role="group" aria-label="Filtrer par état du stock">
              {STOCK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStockFilter(f.key)}
                  aria-pressed={stockFilter === f.key}
                  className={`ms-button ms-button-sm ${stockFilter === f.key ? 'ms-button-primary' : 'bg-transparent border-transparent text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
              <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="ms-search-box" style={{ paddingLeft: 30, minWidth: 160 }} />
            </div>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="form-control w-auto text-sm min-h-[36px]">
              <option value="revenue">Revenu</option>
              <option value="profit">Bénéfice</option>
              <option value="sold">Vendus</option>
              <option value="stock">Stock</option>
              <option value="margin">Marge</option>
            </select>
          </div>
        </div>

        {(stockFilter || search) && (
          <div className="flex flex-col gap-2 border-b border-[var(--ms-border)] bg-[var(--ms-blue-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="fui-body1 text-[var(--ms-text)]">
              Un filtre est actif : <strong>{num(products.length)}</strong> produit(s) affiché(s) sur <strong>{num(allProducts.length)}</strong>.
            </p>
            <button
              type="button"
              onClick={() => { setStockFilter(''); setSearch(''); }}
              className="ms-button ms-button-secondary ms-button-sm shrink-0"
            >
              Afficher tous les produits
            </button>
          </div>
        )}

        {products.length === 0 ? (
          <EmptyState
            title="Aucun produit"
            description={stockFilter || search ? 'Aucun produit ne correspond aux filtres actifs.' : 'Aucun produit pour ce fournisseur sur la période.'}
          />
        ) : (
          <>
            {/* ── Cartes mobile ── */}
            <div className="space-y-3 p-3 sm:hidden">
              {products.map((p) => (
                <Link key={p._id} to={`/products/${p._id}`} className="fluent-card-filled block space-y-3 p-4 transition hover:shadow-[var(--ms-shadow-sm)]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusMedium)] fui-caption1-strong"
                      style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                      {initialsOf(p.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{p.name}</p>
                        {p.isDead && <span className="ms-status-badge ms-status-warning">mort</span>}
                      </div>
                      <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        {p.category || 'Non catégorisé'}{p.sku ? ` · ${p.sku}` : ''}
                      </p>
                    </div>
                    <StockPill p={p} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Prix unitaire</p>
                      <p className="fui-body1-strong tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{cfa(p.price)}</p>
                    </div>
                    <div>
                      <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Vendus</p>
                      <p className="fui-body1-strong tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{num(p.sold)}</p>
                    </div>
                    <div>
                      <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Revenu</p>
                      <p className="fui-body1-strong tabular-nums" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{cfa(p.revenue)}</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--colorNeutralStroke3)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Bénéfice</span>
                      <span className="fui-body1-strong tabular-nums" style={{ color: 'var(--colorBrandForeground1)' }}>{cfa(p.profit)}</span>
                    </div>
                    <MarginCell p={p} />
                  </div>
                </Link>
              ))}
            </div>

            {/* ── Grille desktop ── */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-[minmax(0,1.6fr)_100px_100px_72px_108px_108px_96px] items-center gap-3 px-4 py-2.5"
                style={{ background: 'var(--colorNeutralBackground2)', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
                {['Produit', 'Stock', 'Prix', 'Vendus', 'Revenu', 'Bénéfice', 'Marge'].map((h, i) => (
                  <span key={h} className={`fui-caption1-strong ${i > 0 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--colorNeutralForeground3)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {h}
                  </span>
                ))}
              </div>
              <div>
                {products.map((p) => (
                  <Link key={p._id} to={`/products/${p._id}`}
                    className="group grid grid-cols-[minmax(0,1.6fr)_100px_100px_72px_108px_108px_96px] items-center gap-3 px-4 py-3 transition hover:bg-[var(--ms-bg-subtle)]"
                    style={{ borderBottom: '1px solid var(--colorNeutralStroke3)', background: p.isDead ? 'var(--colorStatusWarningBackground1)' : 'transparent' }}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusMedium)] fui-caption1-strong transition-transform group-hover:scale-105"
                        style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                        {initialsOf(p.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="fui-body1-strong truncate group-hover:underline" style={{ color: 'var(--colorBrandForeground1)' }}>{p.name}</span>
                          {p.isDead && <span className="ms-status-badge ms-status-warning shrink-0">mort</span>}
                        </div>
                        <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          {p.category || 'Non catégorisé'}{p.sku ? ` · ${p.sku}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right"><StockPill p={p} /></div>
                    <div className="text-right tabular-nums fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>{cfa(p.price)}</div>
                    <div className="text-right tabular-nums fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>{num(p.sold)}</div>
                    <div className="text-right tabular-nums fui-body1-strong" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{cfa(p.revenue)}</div>
                    <div className="text-right tabular-nums fui-body1-strong" style={{ color: 'var(--colorBrandForeground1)' }}>{cfa(p.profit)}</div>
                    <MarginCell p={p} />
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>}
    </Workspace>
  );
};

export default SupplierProfile;
