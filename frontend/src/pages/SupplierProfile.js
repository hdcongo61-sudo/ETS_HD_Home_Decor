import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import {
  KPICard, PageHeader, Workspace, EmptyState, LoadingSkeleton,
} from '../components/business';
import {
  ArrowLeft, Phone, MessageCircle, Building2, Search, ChevronDown,
  TrendingUp, Wallet, Coins, PackageX, Star, Boxes, AlertTriangle,
} from 'lucide-react';

const RANGE_OPTIONS = [
  { value: 'day', label: '24 h' },
  { value: 'week', label: '7 j' },
  { value: 'month', label: '30 j' },
  { value: 'year', label: '12 mois' },
  { value: 'all', label: 'Tout' },
];

const cfa = (v) => `${Number(v || 0).toLocaleString('fr-FR')} CFA`;
const num = (v) => Number(v || 0).toLocaleString('fr-FR');
const pct = (v) => `${Number(v || 0).toFixed(1)} %`;
const initials = (s) => (s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

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

  const products = useMemo(() => {
    const list = supplier?.products || [];
    const q = search.trim().toLowerCase();
    const filtered = q ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)) : list;
    const acc = {
      revenue: (p) => p.revenue, profit: (p) => p.profit, stock: (p) => p.stock,
      sold: (p) => p.sold, margin: (p) => p.margin,
    }[sortKey] || ((p) => p.revenue);
    return [...filtered].sort((a, b) => acc(b) - acc(a));
  }, [supplier, search, sortKey]);

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

  const phoneDigits = (supplier?.supplierPhone || '').replace(/\D/g, '');
  const topProduct = supplier?.topProduct;

  return (
    <Workspace>
      <PageHeader
        eyebrow="Profil fournisseur"
        title={supplier?.name || supplier?.supplierName || supplierName}
        description="Performance, rentabilité et état du stock pour ce fournisseur."
        meta={metaLabel}
        actions={
          <button onClick={() => navigate('/products/by-supplier')} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5">
            <ArrowLeft size={14} /> Fournisseurs
          </button>
        }
      />

      {/* Identity + period */}
      <div className="fluent-card-filled p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radiusLarge)] fui-subtitle1"
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
                {supplier?.deadStockCount > 0 && <span className="ms-status-badge ms-status-warning">{num(supplier.deadStockCount)} stock mort</span>}
              </div>
            </div>
          </div>
          {supplier?.supplierPhone && (
            <div className="flex items-center gap-2">
              <a href={`tel:${supplier.supplierPhone}`} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"><Phone size={14} /> Appeler</a>
              {phoneDigits && (
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="ms-button ms-button-primary ms-button-sm flex items-center gap-1.5"><MessageCircle size={14} /> WhatsApp</a>
              )}
            </div>
          )}
        </div>

        {/* Period chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="fui-caption1-strong uppercase mr-1" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>Période</span>
          {RANGE_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setRange(o.value)} className={`ms-button ms-button-sm ${range === o.value ? 'ms-button-primary' : 'ms-button-secondary'}`}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Revenu (période)" value={cfa(supplier?.totalRevenue)} context={`Bénéfice: ${cfa(supplier?.totalProfit)}`} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <KPICard title="Valeur du stock" value={cfa(supplier?.stockValue)} context={`Coût: ${cfa(supplier?.stockCostValue)}`} icon={<Wallet className="h-4 w-4" />} />
        <KPICard title="Marge moyenne" value={pct(supplier?.averageMargin)} context={`Écoulement: ${pct(supplier?.sellThroughRate)}`} icon={<Coins className="h-4 w-4" />} tone="success" />
        <KPICard title="Profit potentiel" value={cfa(supplier?.potentialProfit)} context={`${num(supplier?.totalUnitsSold)} unités vendues`} icon={<Star className="h-4 w-4" />} tone="neutral" />
      </div>

      {/* Health + top product */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="fluent-card-filled p-4 flex items-center gap-3">
          <span className="ms-kpi-icon shrink-0" style={{ background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' }}><AlertTriangle size={16} /></span>
          <div><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Stock bas</p><p className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>{num(supplier?.lowStockCount)}</p></div>
        </div>
        <div className="fluent-card-filled p-4 flex items-center gap-3">
          <span className="ms-kpi-icon shrink-0" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)' }}><PackageX size={16} /></span>
          <div><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Ruptures</p><p className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>{num(supplier?.outOfStockCount)}</p></div>
        </div>
        <div className="fluent-card-filled p-4 flex items-center gap-3">
          <span className="ms-kpi-icon shrink-0" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}><Star size={16} /></span>
          <div className="min-w-0"><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Top produit</p><p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{topProduct?.name || '—'}</p></div>
        </div>
      </div>

      {/* Products table */}
      <div className="fluent-card-filled overflow-hidden">
        <div className="ms-command-bar flex-wrap gap-y-2" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
          <p className="fui-subtitle2 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground1)' }}>
            <Boxes size={15} /> Produits ({num(products.length)})
          </p>
          <div className="flex items-center gap-2 ml-auto">
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

        {products.length === 0 ? (
          <EmptyState title="Aucun produit" description="Aucun produit pour ce fournisseur sur la période." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
      </div>
    </Workspace>
  );
};

export default SupplierProfile;
