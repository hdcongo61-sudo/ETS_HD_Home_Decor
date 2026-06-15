import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { LoadingSkeleton, EmptyState } from '../components/business';
import {
  ProductPageShell, ProductHero, ProductMetricCard, ProductSection,
} from '../components/ProductAnalyticsUI';
import { PackageMinus, Coins, Hammer, Gift, Boxes } from 'lucide-react';

const fmtCFA = (v) => `${Number(v || 0).toLocaleString('fr-FR')} CFA`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const REASON = {
  casse: { label: 'Casse / abîmé', badge: 'ms-status-danger', icon: Hammer },
  cadeau: { label: 'Cadeau / échantillon', badge: 'ms-status-warning', icon: Gift },
  vol: { label: 'Vol / perte', badge: 'ms-status-danger', icon: PackageMinus },
  peremption: { label: 'Péremption', badge: 'ms-status-warning', icon: PackageMinus },
  usage_personnel: { label: 'Usage personnel', badge: 'ms-status-neutral', icon: PackageMinus },
  correction: { label: 'Correction', badge: 'ms-status-neutral', icon: PackageMinus },
  autre: { label: 'Autre', badge: 'ms-status-neutral', icon: PackageMinus },
};

const PERIODS = [
  { key: 'all', label: 'Tout', days: null },
  { key: '30', label: '30 j', days: 30 },
  { key: '90', label: '90 j', days: 90 },
];

const StockLossReport = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30');
  const [reason, setReason] = useState('all');
  const [data, setData] = useState({ movements: [], summary: {} });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      const p = PERIODS.find((x) => x.key === period);
      if (p?.days) params.startDate = new Date(Date.now() - p.days * 86400000).toISOString();
      if (reason !== 'all') params.reason = reason;
      const { data: res } = await api.get('/products/stock-movements', { params });
      setData(res);
    } catch {
      setData({ movements: [], summary: {} });
    } finally {
      setLoading(false);
    }
  }, [period, reason]);

  useEffect(() => { load(); }, [load]);

  const s = data.summary || {};
  const byReason = s.byReason || [];
  const movements = data.movements || [];

  return (
    <ProductPageShell>
      <ProductHero
        eyebrow="Inventaire"
        title="Pertes & cadeaux"
        description="Suivi du stock retiré hors vente (casse, cadeaux) et du capital que cela représente."
        onBack={() => navigate('/')}
        backLabel="Accueil"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <ProductMetricCard title="Capital perdu" value={loading ? '…' : fmtCFA(s.totalCost)} icon={Coins} tone="rose" helper="coût du stock retiré" />
        <ProductMetricCard title="Unités retirées" value={loading ? '…' : (s.totalQuantity ?? 0)} icon={Boxes} tone="amber" />
        <ProductMetricCard title="Mouvements" value={loading ? '…' : (s.count ?? 0)} icon={PackageMinus} tone="slate" />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setReason('all')} className={`ms-button ms-button-sm ${reason === 'all' ? 'ms-button-primary' : 'ms-button-secondary'}`}>Tous</button>
          <button type="button" onClick={() => setReason('casse')} className={`ms-button ms-button-sm ${reason === 'casse' ? 'ms-button-primary' : 'ms-button-secondary'}`}>Casse</button>
          <button type="button" onClick={() => setReason('cadeau')} className={`ms-button ms-button-sm ${reason === 'cadeau' ? 'ms-button-primary' : 'ms-button-secondary'}`}>Cadeaux</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Période&nbsp;:</span>
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`ms-button ms-button-sm ${period === p.key ? 'ms-button-primary' : 'ms-button-secondary'}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Breakdown by reason */}
      {!loading && byReason.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {byReason.map((r) => {
            const meta = REASON[r.reason] || REASON.autre;
            const Icon = meta.icon;
            return (
              <div key={r.reason} className="fluent-card-filled flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radiusMedium)]" style={{ background: 'var(--colorNeutralBackground3)', color: 'var(--colorNeutralForeground2)' }}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{meta.label}</p>
                    <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{r.quantity} unité(s) · {r.count} mouvement(s)</p>
                  </div>
                </div>
                <span className="fui-subtitle2" style={{ color: 'var(--colorStatusDangerForeground1)' }}>{fmtCFA(r.cost)}</span>
              </div>
            );
          })}
        </div>
      )}

      <ProductSection title="Historique des sorties" description="Les 500 mouvements les plus récents.">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : movements.length === 0 ? (
          <EmptyState title="Aucune sortie enregistrée" description="Enregistrez une casse ou un cadeau depuis la fiche d'un produit (bouton « Perte / Cadeau »)." />
        ) : (
          <div className="space-y-2">
            {movements.map((m) => {
              const meta = REASON[m.reason] || REASON.autre;
              return (
                <div key={m._id} className="fluent-card-filled flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{m.productName || 'Produit'}</p>
                      <span className={`ms-status-badge ${meta.badge}`}>{meta.label}</span>
                    </div>
                    <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      {fmtDate(m.createdAt)}{m.container ? ` · ${m.container}` : ''}{m.user?.name ? ` · ${m.user.name}` : ''}{m.note ? ` · ${m.note}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>-{m.quantity}</p>
                    <p className="fui-caption1" style={{ color: 'var(--colorStatusDangerForeground1)' }}>{fmtCFA(m.costImpact)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ProductSection>
    </ProductPageShell>
  );
};

export default StockLossReport;
