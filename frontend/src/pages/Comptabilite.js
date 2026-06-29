import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import {
  DataTable,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Workspace,
} from '../components/business';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calculator,
  FileText,
  Landmark,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR')} CFA`;
const fmtSigned = (n) => `${n > 0 ? '+' : ''}${Number(n || 0).toLocaleString('fr-FR')} CFA`;

// Build a [start, end] ISO window from a named preset.
const presetRange = (preset) => {
  const now = new Date();
  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (preset === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
  // current month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const PRESETS = [
  { key: 'month', label: 'Ce mois' },
  { key: 'lastMonth', label: 'Mois dernier' },
  { key: 'year', label: 'Cette année' },
];

const Comptabilite = () => {
  const journalRef = useRef(null);
  const [preset, setPreset] = useState('month');
  const [summary, setSummary] = useState(null);
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => presetRange(preset), [preset]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
      const [summaryRes, journalRes] = await Promise.all([
        api.get(`/comptabilite/summary?${params.toString()}`),
        api.get(`/comptabilite/journal?${params.toString()}`),
      ]);
      setSummary(summaryRes.data?.data || null);
      setJournal(journalRes.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement de la comptabilité');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useResponsiveTable(journalRef, [journal]);

  const cr = summary?.compteResultat;
  const tr = summary?.tresorerie;
  const bilan = summary?.bilan;
  const paie = summary?.paie;

  const periodLabel = useMemo(() => {
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${range.start.toLocaleDateString('fr-FR', opts)} — ${range.end.toLocaleDateString('fr-FR', opts)}`;
  }, [range]);

  const positive = (cr?.resultatNet ?? 0) >= 0;

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Cockpit financier"
        title="Comptabilité"
        description="Compte de résultat, trésorerie et bilan générés automatiquement à partir de vos ventes et dépenses."
        actions={
          <div className="flex items-center gap-2">
            <Segmented value={preset} onChange={setPreset} options={PRESETS} />
            <button
              type="button"
              onClick={() => window.print()}
              className="ms-button ms-button-secondary ms-button-md inline-flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" /> Imprimer
            </button>
          </div>
        }
      />

      {error && (
        <div
          className="rounded-[var(--radiusLarge)] px-4 py-3 fui-body1"
          style={{
            background: 'var(--colorStatusDangerBackground1)',
            color: 'var(--colorStatusDangerForeground1)',
            border: '1px solid var(--colorStatusDangerStroke1)',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : !summary ? (
        <EmptyState title="Aucune donnée" description="Aucune écriture sur la période sélectionnée." />
      ) : (
        <>
          {/* ── Result hero ─────────────────────────────────────────── */}
          <section
            className="ms-surface overflow-hidden"
            style={{
              borderColor: positive ? 'var(--colorStatusSuccessStroke1)' : 'var(--colorStatusDangerStroke1)',
            }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
              {/* Net result */}
              <div
                className="p-6 flex flex-col justify-between gap-4"
                style={{
                  background: positive
                    ? 'var(--colorStatusSuccessBackground1)'
                    : 'var(--colorStatusDangerBackground1)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="fui-caption1 font-semibold uppercase tracking-wide"
                    style={{ color: positive ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}
                  >
                    Résultat net
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{
                      background: 'var(--ms-white)',
                      color: positive ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)',
                    }}
                  >
                    {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {cr.resultatNetPct}% du CA
                  </span>
                </div>
                <div>
                  <p
                    className="fui-display tabular-nums leading-none"
                    style={{ color: positive ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}
                  >
                    {fmt(cr.resultatNet)}
                  </p>
                  <p className="fui-caption1 mt-2" style={{ color: 'var(--ms-text-muted)' }}>
                    {periodLabel} · {cr.nbVentes} vente(s) encaissée(s)
                  </p>
                </div>
              </div>

              {/* Revenue decomposition */}
              <div className="p-6 flex flex-col justify-center gap-4">
                <div className="flex items-center justify-between">
                  <span className="ms-section-title">Où va le chiffre d'affaires encaissé</span>
                  <span className="fui-subtitle2 tabular-nums" style={{ color: 'var(--ms-text-strong)' }}>{fmt(cr.chiffreAffaires)}</span>
                </div>
                <CompositionBar
                  total={cr.chiffreAffaires}
                  segments={[
                    { label: 'Coût marchandises', value: cr.coutMarchandises, color: 'var(--ms-blue)' },
                    { label: 'Dépenses', value: cr.depenses, color: 'var(--ms-warning)' },
                    { label: 'Pertes', value: cr.pertes, color: 'var(--ms-danger)' },
                    {
                      label: 'Résultat net',
                      value: Math.max(cr.resultatNet, 0),
                      color: 'var(--ms-success)',
                    },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* ── KPI strip ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="CA encaissé"
              value={fmt(cr.chiffreAffaires)}
              hint={`${cr.nbVentes} vente(s) encaissée(s)`}
              icon={<Banknote className="h-4 w-4" />}
              tone="brand"
            />
            <StatCard
              label="Marge brute"
              value={fmt(cr.margeBrute)}
              hint={`${cr.margeBrutePct}% du CA`}
              icon={<TrendingUp className="h-4 w-4" />}
              tone="success"
            />
            <StatCard
              label="Trésorerie (flux)"
              value={fmtSigned(tr.flux)}
              hint={`Encaissé ${fmt(tr.encaissements)}`}
              icon={<Wallet className="h-4 w-4" />}
              tone={tr.flux >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              label="Créances clients"
              value={fmt(summary.creances.clients)}
              hint={`${summary.creances.nbFactures} impayée(s)`}
              icon={<Landmark className="h-4 w-4" />}
              tone="warning"
            />
          </div>

          {/* ── Statements ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Compte de résultat */}
            <section className="ms-surface p-5">
              <SectionTitle icon={<Calculator className="h-4 w-4" />}>Compte de résultat</SectionTitle>
              <dl className="mt-4 divide-y divide-[var(--ms-border)]">
                <Row label="Chiffre d'affaires encaissé" value={cr.chiffreAffaires} />
                <Row label="Coût des marchandises vendues" value={-cr.coutMarchandises} muted />
                <Row label="Marge brute" sublabel={`${cr.margeBrutePct}% du CA`} value={cr.margeBrute} subtotal />
                <Row label="Dépenses d'exploitation" value={-cr.depenses} muted />
                <Row label="Pertes & casses" value={-cr.pertes} muted />
                <Row label="Résultat net" value={cr.resultatNet} total />
              </dl>
              <p className="mt-3 fui-caption1" style={{ color: 'var(--ms-text-muted)' }}>
                Base encaissements : seules les sommes réellement reçues sont comptabilisées.
                Une vente partiellement payée ne compte que pour la part encaissée ; le reste figure en créances clients.
              </p>
              {paie.nbBulletins > 0 && (
                <p className="mt-4 fui-caption1" style={{ color: 'var(--ms-text-muted)' }}>
                  Masse salariale (bulletins payés) : {fmt(paie.masseSalariale)} sur {paie.nbBulletins} bulletin(s).
                  Saisissez les salaires en dépense (catégorie « Salaires ») pour les inclure dans le résultat.
                </p>
              )}
            </section>

            <div className="space-y-5">
              {/* Trésorerie */}
              <section className="ms-surface p-5">
                <SectionTitle icon={<Wallet className="h-4 w-4" />}>Trésorerie</SectionTitle>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <FlowTile
                    label="Encaissements"
                    value={tr.encaissements}
                    icon={<ArrowDownRight className="h-4 w-4" />}
                    tone="success"
                  />
                  <FlowTile
                    label="Décaissements"
                    value={tr.decaissements}
                    icon={<ArrowUpRight className="h-4 w-4" />}
                    tone="danger"
                  />
                </div>
                <dl className="mt-3 divide-y divide-[var(--ms-border)]">
                  <Row label="Flux net de trésorerie" value={tr.flux} total />
                </dl>
              </section>

              {/* Bilan */}
              <section className="ms-surface p-5">
                <SectionTitle icon={<Scale className="h-4 w-4" />}>Bilan simplifié</SectionTitle>
                <dl className="mt-4 divide-y divide-[var(--ms-border)]">
                  <Row label="Stock (valeur au coût)" value={bilan.actif.stock} />
                  <Row label="Créances clients" value={bilan.actif.creancesClients} />
                  <Row label="Total actif" value={bilan.actif.total} subtotal />
                  <Row label="Dettes fournisseurs" value={-bilan.passif.total} muted />
                  <Row label="Situation nette" value={bilan.situationNette} total />
                </dl>
                <p className="mt-3 fui-caption1" style={{ color: 'var(--ms-text-muted)' }}>
                  {bilan.nbReferences} référence(s) · valeur de revente {fmt(bilan.valeurStockVente)}
                </p>
              </section>
            </div>
          </div>

          {/* ── Dépenses par catégorie ──────────────────────────────── */}
          <section className="ms-surface p-5">
            <SectionTitle icon={<Banknote className="h-4 w-4" />}>
              Dépenses par catégorie
              <span className="ml-2 fui-caption1 font-normal" style={{ color: 'var(--ms-text-muted)' }}>
                Total {fmt(cr.depenses)}
              </span>
            </SectionTitle>
            {cr.depensesParCategorie.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Aucune dépense" description="Aucune dépense sur la période." />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {cr.depensesParCategorie.map((c) => {
                  const pct = cr.depenses ? Math.round((c.total / cr.depenses) * 100) : 0;
                  return (
                    <li key={c.categorie}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="fui-body1 font-medium" style={{ color: 'var(--ms-text)' }}>
                          {c.categorie}
                          <span className="ml-2 fui-caption2" style={{ color: 'var(--ms-text-muted)' }}>
                            {c.count} · {pct}%
                          </span>
                        </span>
                        <span className="fui-body1 font-semibold tabular-nums" style={{ color: 'var(--ms-text-strong)' }}>
                          {fmt(c.total)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--ms-surface-muted)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, background: 'var(--ms-blue)' }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Journal comptable ───────────────────────────────────── */}
          <section className="ms-surface">
            <div className="ms-command-bar">
              <SectionTitle icon={<FileText className="h-4 w-4" />}>Journal comptable</SectionTitle>
              {journal && (
                <div className="flex items-center gap-2 text-xs">
                  <StatusBadge tone="success">Produits {fmt(journal.totals.credit)}</StatusBadge>
                  <StatusBadge tone="danger">Charges {fmt(journal.totals.debit)}</StatusBadge>
                </div>
              )}
            </div>
            {!journal || journal.entries.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Journal vide" description="Aucune écriture sur la période." />
              </div>
            ) : (
              <DataTable>
                <table ref={journalRef} className="responsive-table w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Libellé</th>
                      <th>Type</th>
                      <th className="text-right">Produit</th>
                      <th className="text-right">Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.entries.map((e, i) => (
                      <tr key={`${e.type}-${i}`}>
                        <td className="text-[var(--ms-text-muted)] text-xs whitespace-nowrap">
                          {new Date(e.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="font-medium">{e.libelle}</td>
                        <td>
                          <StatusBadge tone={e.type === 'vente' ? 'success' : 'danger'}>
                            {e.type === 'vente' ? 'Vente' : 'Dépense'}
                          </StatusBadge>
                        </td>
                        <td className="text-right font-semibold tabular-nums text-[var(--ms-success)]">
                          {e.credit ? fmt(e.credit) : '—'}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-[var(--ms-danger)]">
                          {e.debit ? fmt(e.debit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--ms-border)' }}>
                      <td colSpan={3} className="font-semibold">Totaux</td>
                      <td className="text-right font-bold tabular-nums text-[var(--ms-success)]">{fmt(journal.totals.credit)}</td>
                      <td className="text-right font-bold tabular-nums text-[var(--ms-danger)]">{fmt(journal.totals.debit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </DataTable>
            )}
          </section>
        </>
      )}
    </Workspace>
  );
};

// ── Building blocks ─────────────────────────────────────────────────

// Segmented control for the period presets.
const Segmented = ({ value, onChange, options }) => (
  <div
    className="inline-flex rounded-[var(--radiusMedium)] p-0.5"
    style={{ background: 'var(--ms-surface-muted)', border: '1px solid var(--ms-border)' }}
    role="tablist"
  >
    {options.map((o) => {
      const active = value === o.key;
      return (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(o.key)}
          className="rounded-[var(--radiusSmall,4px)] px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer"
          style={{
            background: active ? 'var(--ms-white)' : 'transparent',
            color: active ? 'var(--ms-text-strong)' : 'var(--ms-text-muted)',
            boxShadow: active ? 'var(--shadow2)' : 'none',
          }}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

const SectionTitle = ({ icon, children }) => (
  <h2 className="ms-section-title flex items-center gap-2">
    {icon}
    {children}
  </h2>
);

const STAT_TONES = {
  brand: { fg: 'var(--colorBrandForeground1)', bg: 'var(--ms-blue-soft)' },
  success: { fg: 'var(--colorStatusSuccessForeground1)', bg: 'var(--colorStatusSuccessBackground1)' },
  danger: { fg: 'var(--colorStatusDangerForeground1)', bg: 'var(--colorStatusDangerBackground1)' },
  warning: { fg: 'var(--colorStatusWarningForeground1)', bg: 'var(--colorStatusWarningBackground1)' },
};

const StatCard = ({ label, value, hint, icon, tone = 'brand' }) => {
  const t = STAT_TONES[tone] || STAT_TONES.brand;
  return (
    <article className="ms-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="fui-caption1 font-medium" style={{ color: 'var(--ms-text-muted)' }}>{label}</span>
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radiusMedium)]"
          style={{ background: t.bg, color: t.fg }}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="fui-title3 tabular-nums leading-tight" style={{ color: 'var(--ms-text-strong)' }}>{value}</p>
        {hint && <p className="fui-caption2 mt-0.5" style={{ color: 'var(--ms-text-muted)' }}>{hint}</p>}
      </div>
    </article>
  );
};

// A single statement line. Emphasis levels: normal / subtotal / total.
const Row = ({ label, sublabel, value, muted, subtotal, total }) => {
  const negative = value < 0;
  const valueColor = total
    ? negative ? 'var(--ms-danger)' : 'var(--ms-success)'
    : negative ? 'var(--ms-danger)' : 'var(--ms-text-strong)';
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-2 ${total ? 'mt-1' : ''}`}
      style={total ? { borderTop: '2px solid var(--ms-border)' } : undefined}
    >
      <dt
        className={`${total ? 'fui-subtitle2' : subtotal ? 'fui-body1 font-semibold' : 'fui-body1'}`}
        style={{ color: muted ? 'var(--ms-text-muted)' : 'var(--ms-text)' }}
      >
        {label}
        {sublabel && <span className="ml-2 fui-caption2" style={{ color: 'var(--ms-text-muted)' }}>{sublabel}</span>}
      </dt>
      <dd
        className={`tabular-nums ${total ? 'fui-subtitle1 font-bold' : subtotal ? 'font-semibold' : 'font-medium'}`}
        style={{ color: valueColor }}
      >
        {fmt(value)}
      </dd>
    </div>
  );
};

// Cash-flow tile (encaissé / décaissé).
const FlowTile = ({ label, value, icon, tone }) => {
  const t = STAT_TONES[tone] || STAT_TONES.success;
  return (
    <div className="rounded-[var(--radiusMedium)] p-3" style={{ background: t.bg }}>
      <span className="inline-flex items-center gap-1.5 fui-caption1 font-semibold" style={{ color: t.fg }}>
        {icon}{label}
      </span>
      <p className="fui-subtitle2 tabular-nums mt-1" style={{ color: t.fg }}>{fmt(value)}</p>
    </div>
  );
};

// Proportional stacked bar showing how the CA is consumed.
const CompositionBar = ({ total, segments }) => {
  const safeTotal = total > 0 ? total : 1;
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--ms-surface-muted)' }}>
        {visible.map((s) => (
          <div
            key={s.label}
            className="h-full transition-all duration-300"
            style={{ width: `${(s.value / safeTotal) * 100}%`, background: s.color }}
            title={`${s.label} : ${fmt(s.value)}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="min-w-0">
              <span className="block fui-caption2 truncate" style={{ color: 'var(--ms-text-muted)' }}>{s.label}</span>
              <span className="block fui-caption1 font-semibold tabular-nums" style={{ color: 'var(--ms-text-strong)' }}>
                {Math.round((s.value / safeTotal) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Comptabilite;
