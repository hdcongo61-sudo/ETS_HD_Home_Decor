import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reportingApi } from '../features/reporting/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { useModal } from '../context/ModalContext';
import { MODAL_IDS } from '../config/modals';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
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
  AlertTriangle,
  Banknote,
  CalendarDays,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
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

// ── Export Excel du rapport comptable ───────────────────────────────
// Construit un classeur Excel (.xlsx) multi-feuilles à partir des données
// réelles chargées dans la page (synthèse + journal) pour la période
// sélectionnée.
const num = (v) => Number(v || 0);

const appendSheet = (workbook, name, rows, cols = []) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(workbook, ws, name);
  return ws;
};

const buildAccountingWorkbook = ({ summary, journal, periodLabel }) => {
  const cr = summary.compteResultat || {};
  const tr = summary.tresorerie || {};
  const bilan = summary.bilan || {};
  const paie = summary.paie || {};
  const creances = summary.creances || {};
  const bilanActif = bilan.actif || {};
  const bilanPassif = bilan.passif || {};
  const totals = journal?.totals || { credit: 0, debit: 0, solde: 0 };
  const entries = journal?.entries || [];
  const cats = cr.depensesParCategorie || [];

  const wb = XLSX.utils.book_new();

  appendSheet(
    wb,
    'Synthèse',
    [
      ['Rapport comptable'],
      ['Période', periodLabel],
      ['Généré le', new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })],
      [],
      ['Indicateur', 'Montant (CFA)'],
      ['Résultat net', num(cr.resultatNet)],
      ['Résultat net (% du CA)', num(cr.resultatNetPct)],
      ['CA encaissé', num(cr.chiffreAffaires)],
      ['Ventes encaissées', num(cr.nbVentes)],
      ['Marge brute', num(cr.margeBrute)],
      ['Marge brute (% du CA)', num(cr.margeBrutePct)],
      ['Dépenses', num(cr.depenses)],
      ['Pertes & casses', num(cr.pertes)],
      ['Flux de trésorerie', num(tr.flux)],
      ['Encaissements', num(tr.encaissements)],
      ['Décaissements', num(tr.decaissements)],
      ['Créances clients', num(creances.clients)],
      ['Factures impayées', num(creances.nbFactures)],
      ['Masse salariale (payée)', num(paie.masseSalariale)],
      ['Bulletins payés', num(paie.nbBulletins)],
    ],
    [{ wch: 32 }, { wch: 18 }],
  );

  appendSheet(
    wb,
    'Compte de résultat',
    [
      ['Libellé', 'Montant (CFA)'],
      ["Chiffre d'affaires encaissé", num(cr.chiffreAffaires)],
      ['Coût des marchandises vendues', -num(cr.coutMarchandises)],
      ['Marge brute', num(cr.margeBrute)],
      ["Dépenses d'exploitation", -num(cr.depenses)],
      ['Pertes & casses', -num(cr.pertes)],
      ['Résultat net', num(cr.resultatNet)],
    ],
    [{ wch: 34 }, { wch: 18 }],
  );

  appendSheet(
    wb,
    'Trésorerie',
    [
      ['Libellé', 'Montant (CFA)'],
      ['Encaissements', num(tr.encaissements)],
      ['Décaissements', -num(tr.decaissements)],
      ['Flux net de trésorerie', num(tr.flux)],
    ],
    [{ wch: 28 }, { wch: 18 }],
  );

  appendSheet(
    wb,
    'Bilan',
    [
      ['Libellé', 'Montant (CFA)'],
      ['Stock (valeur au coût)', num(bilanActif.stock)],
      ['Créances clients', num(bilanActif.creancesClients)],
      ['Total actif', num(bilanActif.total)],
      ['Dettes fournisseurs', -num(bilanPassif.total)],
      ['Situation nette', num(bilan.situationNette)],
      [],
      ['Références en stock', num(bilan.nbReferences)],
      ['Valeur de revente du stock', num(bilan.valeurStockVente)],
    ],
    [{ wch: 34 }, { wch: 18 }],
  );

  const depRows = cats.length
    ? [
        ...cats.map((c) => [
          c.categorie || 'Non catégorisé',
          num(c.count),
          num(c.total),
          cr.depenses ? Math.round((c.total / cr.depenses) * 100) : 0,
        ]),
        ['Total dépenses', cats.reduce((s, c) => s + (c.count || 0), 0), num(cr.depenses), 100],
      ]
    : [['Aucune dépense sur la période', '', '', '']];

  appendSheet(
    wb,
    'Dépenses',
    [
      ['Catégorie', 'Nombre', 'Total (CFA)', 'Part (%)'],
      ...depRows,
    ],
    [{ wch: 32 }, { wch: 10 }, { wch: 16 }, { wch: 10 }],
  );

  const jRows = entries.length
    ? [
        ...entries.map((e) => [
          e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '',
          e.libelle || '',
          e.type === 'vente' ? 'Produit' : 'Charge',
          num(e.credit) || '',
          num(e.debit) || '',
        ]),
        [],
        ['Totaux de la période', '', '', num(totals.credit), num(totals.debit)],
        ['Balance nette', '', '', '', num(totals.solde ?? (totals.credit - totals.debit))],
      ]
    : [['Aucune écriture sur la période', '', '', '', '']];

  appendSheet(
    wb,
    'Journal',
    [
      ['Date', 'Libellé', 'Type', 'Produit (CFA)', 'Charge (CFA)'],
      ...jRows,
    ],
    [{ wch: 12 }, { wch: 46 }, { wch: 12 }, { wch: 16 }, { wch: 16 }],
  );

  return wb;
};

const Comptabilite = () => {
  const journalRef = useRef(null);
  const { openModal } = useModal();
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
        reportingApi.comptabiliteSummary(params),
        reportingApi.comptabiliteJournal(params),
      ]);
      setSummary(summaryRes.data?.data || null);
      setJournal(journalRes.data?.data || null);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement de la comptabilité');
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
  const hasReceivables = (summary?.creances?.clients ?? 0) > 0;

  // Génère un classeur Excel multi-feuilles à partir des données réelles
  // chargées (synthèse + journal) puis déclenche le téléchargement.
  const handleExport = useCallback(() => {
    if (!summary || !journal) return;
    try {
      const workbook = buildAccountingWorkbook({ summary, journal, periodLabel });
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const iso = (d) => d.toISOString().slice(0, 10);
      saveAs(blob, `Comptabilite_${iso(range.start)}_${iso(range.end)}.xlsx`);
      toast.success('Export Excel généré avec succès');
    } catch (err) {
      toast.error("Erreur lors de la génération de l'export Excel");
    }
  }, [summary, journal, periodLabel, range]);

  return (
    <Workspace className="space-y-6">
      <PageHeader
        eyebrow="Finance & pilotage"
        title="Comptabilité"
        description="Suivez ce que l'entreprise gagne, dépense et doit encore encaisser."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openModal(MODAL_IDS.PAYMENT)}
              className="ms-button ms-button-secondary ms-button-md"
            >
              <CreditCard className="h-4 w-4" /> Encaisser
            </button>
            <button
              type="button"
              onClick={() => openModal(MODAL_IDS.EXPENSE)}
              className="ms-button ms-button-primary ms-button-md"
            >
              <Plus className="h-4 w-4" /> Dépense
            </button>
          </div>
        }
      />

      <section className="ms-surface p-3 sm:p-4" aria-label="Période et actions du rapport">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusMedium)] bg-[var(--ms-blue-soft)] text-[var(--ms-blue)]">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="fui-caption1 font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Période analysée</p>
              <p className="truncate fui-body1-strong text-[var(--ms-text-strong)]">{periodLabel}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented value={preset} onChange={setPreset} options={PRESETS} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="ms-button ms-button-secondary ms-button-md flex-1 sm:flex-none"
                aria-label="Actualiser les données"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
              </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || !summary}
              className="ms-button ms-button-secondary ms-button-md flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="h-4 w-4" /> Exporter
            </button>
            </div>
          </div>
        </div>
      </section>

      <nav className="no-print -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Sections comptables">
        <SectionLink href="#synthese" icon={<TrendingUp className="h-4 w-4" />} label="Synthèse" />
        <SectionLink href="#resultats" icon={<Calculator className="h-4 w-4" />} label="Résultats" />
        <SectionLink href="#depenses" icon={<Banknote className="h-4 w-4" />} label="Dépenses" />
        <SectionLink href="#journal" icon={<FileText className="h-4 w-4" />} label="Journal" />
      </nav>

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
            id="synthese"
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

          <section
            className="rounded-[var(--radiusLarge)] border p-4 sm:p-5"
            style={{
              background: positive ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorStatusWarningBackground1)',
              borderColor: positive ? 'var(--colorStatusSuccessStroke1)' : 'var(--colorStatusWarningStroke1)',
            }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70"
                  style={{ color: positive ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusWarningForeground1)' }}
                >
                  {positive ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </span>
                <div>
                  <h2 className="fui-subtitle2 text-[var(--ms-text-strong)]">
                    {positive ? 'La période est bénéficiaire' : 'La période demande votre attention'}
                  </h2>
                  <p className="mt-1 fui-body1 text-[var(--ms-text)]">
                    {positive
                      ? `Chaque 100 CFA encaissés génère environ ${Math.max(0, Number(cr.resultatNetPct || 0))} CFA de résultat net.`
                      : 'Les coûts et charges dépassent les encaissements sur la période sélectionnée.'}
                    {hasReceivables ? ` ${fmt(summary.creances.clients)} restent à encaisser auprès des clients.` : ' Aucun impayé client à signaler.'}
                  </p>
                </div>
              </div>
              {hasReceivables && (
                <button type="button" onClick={() => openModal(MODAL_IDS.PAYMENT)} className="ms-button ms-button-secondary ms-button-md shrink-0">
                  <CreditCard className="h-4 w-4" /> Enregistrer un paiement
                </button>
              )}
            </div>
          </section>

          {/* ── Statements ──────────────────────────────────────────── */}
          <div id="resultats" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
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
          <section id="depenses" className="ms-surface scroll-mt-24 p-5">
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
          <section id="journal" className="ms-surface scroll-mt-24 overflow-hidden">
            <div
              className="ms-command-bar border-b"
              style={{ borderColor: 'var(--ms-border)', position: 'static', top: 'auto', zIndex: 'auto' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--ms-blue)]">
                  <FileText className="h-4 w-4" />
                </span>
                <h2 className="ms-section-title">Journal comptable</h2>
                {journal && (
                  <span className="fui-caption1 font-medium text-[var(--ms-text-muted)]">
                    {journal.entries.length} écriture(s)
                  </span>
                )}
              </div>
              {journal && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: 'var(--colorStatusSuccessForeground1)' }} />
                    <span className="fui-caption1 font-medium tabular-nums text-[var(--ms-text)]">
                      {fmt(journal.totals.credit)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: 'var(--colorStatusDangerForeground1)' }} />
                    <span className="fui-caption1 font-medium tabular-nums text-[var(--ms-text)]">
                      {fmt(journal.totals.debit)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {!journal || journal.entries.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Journal vide" description="Aucune écriture sur la période." />
              </div>
            ) : (
              <>
                {/* Mobile timeline layout */}
                <div className="lg:hidden">
                  <div className="divide-y" style={{ borderColor: 'var(--ms-border)' }}>
                    {journal.entries.map((e, i) => (
                      <div key={`${e.type}-${i}`} className="p-4 hover:bg-[var(--ms-bg-subtle)] transition-colors">
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            style={{
                              background: e.type === 'vente' ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorStatusDangerBackground1)',
                              color: e.type === 'vente' ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)',
                            }}
                          >
                            {e.type === 'vente' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <p className="fui-body1-strong text-[var(--ms-text-strong)]">{e.libelle}</p>
                              <p
                                className="fui-subtitle2 tabular-nums shrink-0"
                                style={{
                                  color: e.type === 'vente' ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)',
                                }}
                              >
                                {e.type === 'vente' ? '+' : '−'}{fmt(e.credit || e.debit)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <time className="fui-caption1 text-[var(--ms-text-muted)]">
                                {new Date(e.date).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </time>
                              <span className="fui-caption1 text-[var(--ms-text-muted)]">•</span>
                              <span className="fui-caption1 font-medium" style={{
                                color: e.type === 'vente' ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)',
                              }}>
                                {e.type === 'vente' ? 'Produit' : 'Charge'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile balance footer */}
                  <div className="border-t-2 p-4" style={{ borderColor: 'var(--ms-border)', background: 'var(--ms-bg-subtle)' }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="fui-caption1 mb-1 text-[var(--ms-text-muted)]">Total produits</p>
                        <p className="fui-title3 tabular-nums" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
                          {fmt(journal.totals.credit)}
                        </p>
                      </div>
                      <div>
                        <p className="fui-caption1 mb-1 text-[var(--ms-text-muted)]">Total charges</p>
                        <p className="fui-title3 tabular-nums" style={{ color: 'var(--colorStatusDangerForeground1)' }}>
                          {fmt(journal.totals.debit)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ms-border)' }}>
                      <div className="flex items-center justify-between">
                        <p className="fui-subtitle2 text-[var(--ms-text-strong)]">Balance</p>
                        <p
                          className="fui-title2 tabular-nums font-bold"
                          style={{
                            color: (journal.totals.credit - journal.totals.debit) >= 0
                              ? 'var(--colorStatusSuccessForeground1)'
                              : 'var(--colorStatusDangerForeground1)',
                          }}
                        >
                          {fmtSigned(journal.totals.credit - journal.totals.debit)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block">
                  <DataTable>
                    <table ref={journalRef} className="responsive-table w-full">
                      <thead>
                        <tr>
                          <th className="w-[120px]">Date</th>
                          <th>Libellé</th>
                          <th className="w-[100px]">Type</th>
                          <th className="w-[140px] text-right">Produit</th>
                          <th className="w-[140px] text-right">Charge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journal.entries.map((e, i) => (
                          <tr key={`${e.type}-${i}`} className="hover:bg-[var(--ms-bg-subtle)] transition-colors">
                            <td>
                              <time className="fui-caption1 font-medium text-[var(--ms-text-muted)]">
                                {new Date(e.date).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </time>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radiusSmall)]"
                                  style={{
                                    background: e.type === 'vente' ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorStatusDangerBackground1)',
                                    color: e.type === 'vente' ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)',
                                  }}
                                >
                                  {e.type === 'vente' ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                                </div>
                                <span className="fui-body1 font-medium text-[var(--ms-text)]">{e.libelle}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 fui-caption1 font-semibold"
                                style={{
                                  background: e.type === 'vente' ? 'var(--colorStatusSuccessBackground2)' : 'var(--colorStatusDangerBackground2)',
                                  color: e.type === 'vente' ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)',
                                }}
                              >
                                {e.type === 'vente' ? 'Produit' : 'Charge'}
                              </span>
                            </td>
                            <td className="text-right">
                              <span
                                className="fui-body1-strong tabular-nums"
                                style={{ color: e.credit ? 'var(--colorStatusSuccessForeground1)' : 'var(--ms-text-muted)' }}
                              >
                                {e.credit ? fmt(e.credit) : '—'}
                              </span>
                            </td>
                            <td className="text-right">
                              <span
                                className="fui-body1-strong tabular-nums"
                                style={{ color: e.debit ? 'var(--colorStatusDangerForeground1)' : 'var(--ms-text-muted)' }}
                              >
                                {e.debit ? fmt(e.debit) : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid var(--ms-border)', background: 'var(--ms-bg-subtle)' }}>
                          <td colSpan={3} className="fui-subtitle2">Totaux de la période</td>
                          <td className="text-right">
                            <span className="fui-subtitle1 font-bold tabular-nums" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
                              {fmt(journal.totals.credit)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="fui-subtitle1 font-bold tabular-nums" style={{ color: 'var(--colorStatusDangerForeground1)' }}>
                              {fmt(journal.totals.debit)}
                            </span>
                          </td>
                        </tr>
                        <tr style={{ background: 'var(--colorNeutralBackground2)' }}>
                          <td colSpan={3} className="fui-subtitle2 text-[var(--ms-text-strong)]">Balance nette</td>
                          <td colSpan={2} className="text-right">
                            <span
                              className="fui-title2 font-bold tabular-nums"
                              style={{
                                color: (journal.totals.credit - journal.totals.debit) >= 0
                                  ? 'var(--colorStatusSuccessForeground1)'
                                  : 'var(--colorStatusDangerForeground1)',
                              }}
                            >
                              {fmtSigned(journal.totals.credit - journal.totals.debit)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </DataTable>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </Workspace>
  );
};

// ── Building blocks ─────────────────────────────────────────────────

const SectionLink = ({ href, icon, label }) => (
  <a
    href={href}
    className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3.5 py-2 fui-body1-strong text-[var(--ms-text)] shadow-[var(--ms-shadow-sm)] transition hover:border-[var(--ms-border-strong)] hover:bg-[var(--ms-bg-subtle)]"
  >
    <span className="text-[var(--ms-blue)]">{icon}</span>
    {label}
  </a>
);

// Segmented control for the period presets.
const Segmented = ({ value, onChange, options }) => (
  <div
    className="grid grid-cols-3 rounded-[var(--radiusMedium)] p-0.5"
    style={{ background: 'var(--ms-surface-muted)', border: '1px solid var(--ms-border)' }}
    role="group"
    aria-label="Choisir la période"
  >
    {options.map((o) => {
      const active = value === o.key;
      return (
        <button
          key={o.key}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(o.key)}
          className="min-h-[38px] whitespace-nowrap rounded-[var(--radiusSmall,4px)] px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer"
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
