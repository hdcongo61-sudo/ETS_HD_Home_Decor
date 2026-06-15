import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { productPath } from '../utils/paths';
import { LoadingSkeleton, EmptyState } from '../components/business';
import {
  ProductPageShell, ProductHero, ProductMetricCard, ProductSection,
} from '../components/ProductAnalyticsUI';
import {
  Lightbulb, Coins, PackageX, Moon, Snail, ArrowRight, Tag, Boxes, Clock, Sparkles,
} from 'lucide-react';

const fmtCFA = (v) => `${Number(v || 0).toLocaleString('fr-FR')} CFA`;

const SEVERITY = {
  critical: { label: 'Jamais vendu', badge: 'ms-status-danger', tone: 'rose', icon: PackageX },
  high: { label: 'Dormant', badge: 'ms-status-warning', tone: 'amber', icon: Moon },
  medium: { label: 'Lent', badge: 'ms-status-neutral', tone: 'slate', icon: Snail },
};

const PERIODS = [
  { value: 30, label: '30 j' },
  { value: 90, label: '90 j' },
  { value: 180, label: '6 mois' },
];

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'critical', label: 'Jamais vendus' },
  { key: 'high', label: 'Dormants' },
  { key: 'medium', label: 'Lents' },
];

const SlowProductSuggestions = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(90);
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState({ summary: {}, products: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/products/slow-movers', { params: { days } });
      setData(res);
    } catch {
      setData({ summary: {}, products: [] });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const s = data.summary || {};
  const rows = (data.products || []).filter((p) => filter === 'all' || p.severity === filter);

  return (
    <ProductPageShell>
      <ProductHero
        eyebrow="Plan d'action"
        title="Suggestions — produits lents"
        description="Identifiez le stock qui dort et appliquez des actions concrètes pour le vendre."
        onBack={() => navigate('/')}
        backLabel="Accueil"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <ProductMetricCard title="Produits lents" value={loading ? '…' : (s.count ?? 0)} icon={Snail} tone="amber" helper={`sur ${s.totalInStock ?? 0} en stock`} />
        <ProductMetricCard title="Capital immobilisé" value={loading ? '…' : fmtCFA(s.immobilizedValue)} icon={Coins} tone="rose" helper="valeur du stock concerné" />
        <ProductMetricCard title="Jamais vendus" value={loading ? '…' : (s.neverSold ?? 0)} icon={PackageX} tone="rose" />
        <ProductMetricCard title="Dormants" value={loading ? '…' : (s.dormant ?? 0)} icon={Moon} tone="slate" />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`ms-button ms-button-sm ${filter === f.key ? 'ms-button-primary' : 'ms-button-secondary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Période&nbsp;:</span>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setDays(p.value)}
              className={`ms-button ms-button-sm ${days === p.value ? 'ms-button-primary' : 'ms-button-secondary'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ProductSection
        title="Produits à activer"
        description="Triés par capital immobilisé — commencez par le haut pour le plus d'impact."
      >
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Rien à signaler 🎉"
            description="Aucun produit lent sur cette période. Votre stock tourne bien."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((p) => {
              const sev = SEVERITY[p.severity] || SEVERITY.medium;
              const SevIcon = sev.icon;
              return (
                <div key={p._id} className="fluent-card-filled p-3.5 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    {/* Thumb */}
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radiusMedium)]" style={{ border: '1px solid var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground2)' }}>
                      <img src={p.image || '/placeholder.png'} alt="" className="h-full w-full object-cover" />
                    </div>

                    {/* Main */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={productPath(p)} className="fui-body1-strong hover:underline" style={{ color: 'var(--colorNeutralForeground1)' }}>
                          {p.name}
                        </Link>
                        <span className={`ms-status-badge ${sev.badge}`}>
                          <SevIcon size={11} className="mr-1 inline" />{sev.label}
                        </span>
                      </div>
                      <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        {p.reason}
                      </p>

                      {/* Metrics */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                        <span className="inline-flex items-center gap-1"><Boxes size={12} /> {p.stock} en stock</span>
                        <span className="inline-flex items-center gap-1"><Coins size={12} /> {fmtCFA(p.stockValue)} immobilisés</span>
                        {p.daysSinceLastSale != null && <span className="inline-flex items-center gap-1"><Clock size={12} /> vendu il y a {p.daysSinceLastSale} j</span>}
                        {p.container && <span className="inline-flex items-center gap-1"><Tag size={12} /> {p.container}</span>}
                      </div>

                      {/* Suggested actions */}
                      <div className="mt-2.5 rounded-[var(--radiusMedium)] p-2.5" style={{ background: 'var(--ms-blue-soft)' }}>
                        <p className="fui-caption1-strong inline-flex items-center gap-1.5" style={{ color: 'var(--colorBrandForeground1)' }}>
                          <Lightbulb size={13} /> Actions suggérées
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {p.actions.map((a, i) => (
                            <li key={i} className="fui-caption1 flex items-start gap-1.5" style={{ color: 'var(--colorNeutralForeground2)' }}>
                              <ArrowRight size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--colorBrandForeground1)' }} />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="shrink-0">
                      <Link to={productPath(p)} className="ms-button ms-button-secondary ms-button-sm w-full justify-center sm:w-auto">
                        Voir la fiche <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ProductSection>

      {!loading && rows.length > 0 && (
        <p className="fui-caption1 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
          <Sparkles size={13} /> Astuce : appliquez une remise via la fiche produit, puis suivez l'effet sur la même période.
        </p>
      )}
    </ProductPageShell>
  );
};

export default SlowProductSuggestions;
