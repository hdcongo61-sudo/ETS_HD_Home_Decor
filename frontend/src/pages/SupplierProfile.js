import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { formatCfa as cfa } from '../utils/format';
import {
  KPICard, PageHeader, Workspace, EmptyState, LoadingSkeleton, StatusBadge,
} from '../components/business';
import {
  ArrowLeft, Phone, MessageCircle, Building2, Search, Copy,
  TrendingUp, Wallet, Coins, PackageX, Star, Boxes, AlertTriangle, ClipboardList, Crown,
  LayoutDashboard,
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
const initials = (s) => (s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

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

const SupplierProfile = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { auth } = useContext(AuthContext);
  const shopName = auth?.tenant?.name || '';

  const [range, setRange] = useState('all');
  const [supplier, setSupplier] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('revenue');
  const [stockFilter, setStockFilter] = useState('');
  const [activeView, setActiveView] = useState('overview');
  // Commande fournisseur : sélection + quantités saisies
  const [orderSelection, setOrderSelection] = useState({}); // { productId: true }
  const [orderQty, setOrderQty] = useState({}); // { productId: "12" }

  const supplierName = useMemo(() => {
    if (!name) return '';
    try { return decodeURIComponent(name); } catch { return name; }
  }, [name]);

  useEffect(() => {
    const fetchSupplier = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/products/by-supplier?range=${range}`);
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

  // ----- Produits à recommander : ruptures d'abord, puis meilleurs vendeurs -----
  const restockCandidates = useMemo(
    () =>
      allProducts
        .filter((p) => (p.stock || 0) < LOW_STOCK_THRESHOLD)
        .sort((a, b) => ((a.stock || 0) === (b.stock || 0) ? (b.sold || 0) - (a.sold || 0) : (a.stock || 0) - (b.stock || 0))),
    [allProducts]
  );

  // Pré-sélectionne les ruptures quand la liste change
  useEffect(() => {
    const next = {};
    restockCandidates.forEach((p) => {
      if ((p.stock || 0) === 0) next[p._id] = true;
    });
    setOrderSelection(next);
    setOrderQty({});
  }, [restockCandidates]);

  const selectedForOrder = restockCandidates.filter((p) => orderSelection[p._id]);

  const buildOrderMessage = () => {
    const lines = selectedForOrder.map((p) => {
      const qty = (orderQty[p._id] || '').trim();
      return `• ${p.name}${p.sku ? ` (réf. ${p.sku})` : ''}${qty ? ` × ${qty}` : ' (quantité à confirmer)'}`;
    });
    return [
      `Bonjour ${supplier?.name || supplierName},`,
      '',
      'Nous souhaitons passer la commande suivante :',
      ...lines,
      '',
      `Merci de confirmer la disponibilité et le délai.${shopName ? ` — ${shopName}` : ''}`,
    ].join('\n');
  };

  const phoneDigits = (supplier?.supplierPhone || '').replace(/\D/g, '');

  const sendOrderWhatsApp = () => {
    window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(buildOrderMessage())}`, '_blank', 'noopener,noreferrer');
  };

  const copyOrder = () => {
    navigator.clipboard?.writeText(buildOrderMessage())
      .then(() => toast.success('Commande copiée'))
      .catch(() => toast.error('Copie impossible'));
  };

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

  const tableRef = useRef(null);
  useResponsiveTable(tableRef, [products]);

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
    <Workspace className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Partenaires & approvisionnement"
        title={supplier?.name || supplier?.supplierName || supplierName}
        description="Pilotez la performance, les stocks et les commandes de ce fournisseur."
        meta={metaLabel}
        actions={
          <button onClick={() => navigate('/products/by-supplier')} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5">
            <ArrowLeft size={14} /> Fournisseurs
          </button>
        }
      />

      {/* Identity + period */}
      <section className="fluent-card-filled overflow-hidden">
        <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radiusLarge)] fui-title3"
              style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
              {initials(supplier?.name || supplierName)}
            </div>
            <div className="min-w-0">
              <p className="fui-subtitle1 truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
                {supplier?.name || supplierName}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="ms-status-badge ms-status-neutral flex items-center gap-1"><Building2 size={11} /> {num(supplier?.totalProducts)} produits</span>
                {supplier?.categoryCount > 0 && <span className="ms-status-badge ms-status-neutral">{num(supplier.categoryCount)} catégories</span>}
                {deadCount > 0 && <span className="ms-status-badge ms-status-warning">{num(deadCount)} stock mort</span>}
              </div>
            </div>
          </div>
          {supplier?.supplierPhone && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <a href={`tel:${supplier.supplierPhone}`} className="ms-button ms-button-secondary ms-button-md flex-1 sm:flex-none"><Phone size={16} /> Appeler</a>
              {phoneDigits && (
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="ms-button ms-button-primary ms-button-md flex-1 sm:flex-none"><MessageCircle size={16} /> WhatsApp</a>
              )}
            </div>
          )}
        </div>

        {(outCount > 0 || lowCount > 0) && (
          <button
            type="button"
            onClick={() => setActiveView('restock')}
            className="mt-5 flex w-full items-center justify-between gap-3 rounded-[var(--radiusLarge)] border p-3.5 text-left transition hover:shadow-[var(--ms-shadow-sm)]"
            style={{ background: 'var(--colorStatusWarningBackground1)', borderColor: 'var(--colorStatusWarningStroke1)' }}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-[var(--colorStatusWarningForeground1)]"><AlertTriangle size={18} /></span>
              <span>
                <span className="fui-body1-strong block text-[var(--ms-text-strong)]">Réassort recommandé</span>
                <span className="fui-caption1 text-[var(--ms-text-muted)]">{num(outCount)} rupture(s) et {num(lowCount)} stock(s) bas à traiter.</span>
              </span>
            </span>
            <span className="fui-caption1-strong shrink-0 text-[var(--colorStatusWarningForeground1)]">Préparer →</span>
          </button>
        )}
        </div>

        {/* Period chips */}
        <div className="flex flex-col gap-3 border-t border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="fui-caption1-strong uppercase mr-1" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>Période</span>
          <div className="grid grid-cols-5 gap-1 rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-white p-1" role="group" aria-label="Période d'analyse">
            {RANGE_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setRange(o.value)} aria-pressed={range === o.value} className={`min-h-[36px] rounded-[var(--radiusSmall,4px)] px-2 text-xs font-semibold transition sm:px-3 ${range === o.value ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text-muted)] hover:bg-[var(--ms-bg-subtle)]'}`}>{o.label}</button>
            ))}
          </div>
        </div>
      </section>

      <nav className="grid grid-cols-3 gap-2 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-1.5" aria-label="Sections du fournisseur">
        <SupplierViewButton active={activeView === 'overview'} onClick={() => setActiveView('overview')} icon={<LayoutDashboard size={16} />} label="Aperçu" />
        <SupplierViewButton active={activeView === 'restock'} onClick={() => setActiveView('restock')} icon={<ClipboardList size={16} />} label="Réassort" badge={restockCandidates.length} />
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

      {/* KPI strip */}
      {activeView === 'overview' && (<>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Revenu (période)" value={cfa(supplier?.totalRevenue)} context={`Bénéfice: ${cfa(supplier?.totalProfit)}`} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <KPICard title="Valeur du stock" value={cfa(supplier?.stockValue)} context={`Coût: ${cfa(supplier?.stockCostValue)}`} icon={<Wallet className="h-4 w-4" />} />
        <KPICard title="Marge moyenne" value={pct(supplier?.averageMargin)} context={`Écoulement: ${pct(supplier?.sellThroughRate)}`} icon={<Coins className="h-4 w-4" />} tone="success" />
        <KPICard title="Profit potentiel" value={cfa(supplier?.potentialProfit)} context={`${num(supplier?.totalUnitsSold)} unités vendues`} icon={<Star className="h-4 w-4" />} tone="neutral" />
      </div>
      </>)}

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

      {/* ===== Commande de réassort ===== */}
      {activeView === 'restock' && restockCandidates.length > 0 && (
        <div className="fluent-card-filled p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="fui-subtitle1 flex items-center gap-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                <ClipboardList size={16} /> Commande de réassort
              </p>
              <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                Produits en rupture ou sous {LOW_STOCK_THRESHOLD} unités — cochez, précisez les quantités, envoyez la commande.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {phoneDigits && (
                <button
                  type="button"
                  onClick={sendOrderWhatsApp}
                  disabled={selectedForOrder.length === 0}
                  className="ms-button ms-button-primary ms-button-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <MessageCircle size={14} /> Envoyer sur WhatsApp ({selectedForOrder.length})
                </button>
              )}
              <button
                type="button"
                onClick={copyOrder}
                disabled={selectedForOrder.length === 0}
                className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Copy size={14} /> Copier la commande
              </button>
            </div>
          </div>

          <ul className="mt-4 divide-y" style={{ borderColor: 'var(--colorNeutralStroke3)' }}>
            {restockCandidates.map((p) => {
              const checked = Boolean(orderSelection[p._id]);
              const isOut = (p.stock || 0) === 0;
              return (
                <li key={p._id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setOrderSelection((prev) => ({ ...prev, [p._id]: !prev[p._id] }))}
                      className="h-4 w-4 shrink-0 accent-[var(--ms-blue)]"
                      aria-label={`Inclure ${p.name} dans la commande`}
                    />
                    <span className="min-w-0">
                      <span className="fui-body1-strong block truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{p.name}</span>
                      <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        {num(p.sold)} vendus sur la période{p.sku ? ` · réf. ${p.sku}` : ''}
                      </span>
                    </span>
                  </label>
                  <StatusBadge tone={isOut ? 'danger' : 'warning'}>
                    {isOut ? 'Rupture' : `Stock : ${num(p.stock)}`}
                  </StatusBadge>
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">Quantité à commander pour {p.name}</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder="Qté"
                      value={orderQty[p._id] || ''}
                      onChange={(e) => setOrderQty((prev) => ({ ...prev, [p._id]: e.target.value }))}
                      className="form-control w-20 text-sm"
                      disabled={!checked}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {activeView === 'restock' && restockCandidates.length === 0 && (
        <div className="fluent-card-filled p-6">
          <EmptyState title="Aucun réassort nécessaire" description={`Tous les produits disposent d'au moins ${LOW_STOCK_THRESHOLD} unités en stock.`} />
        </div>
      )}

      {/* ===== Top produits — part du revenu ===== */}
      {activeView === 'overview' && topByRevenue.length > 0 && (supplier?.totalRevenue || 0) > 0 && (
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
          <div className="overflow-x-auto">
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
                    <td className="px-3 py-2 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{p.category || 'Non catégorisé'}</td>
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
        )}
      </div>}
    </Workspace>
  );
};

export default SupplierProfile;
