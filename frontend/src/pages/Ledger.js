import { formatCfa } from '../utils/format';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpen,
  ListOrdered,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import api from '../services/api';

const ACCOUNT_TYPES = {
  asset: 'Actif',
  liability: 'Passif',
  equity: 'Capitaux propres',
  revenue: 'Produits',
  expense: 'Charges',
};

const TABS = [
  { key: 'journal', label: 'Journal', icon: ListOrdered },
  { key: 'accounts', label: 'Plan comptable', icon: BookOpen },
  { key: 'balance', label: 'Balance', icon: Scale },
];

const emptyLine = () => ({ account: '', description: '', debit: '', credit: '' });

const Ledger = () => {
  const [tab, setTab] = useState('journal');
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryForm, setEntryForm] = useState({ date: '', description: '', lines: [emptyLine()] });
  const [savingEntry, setSavingEntry] = useState(false);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'asset' });
  const [savingAccount, setSavingAccount] = useState(false);

  const loadAccounts = useCallback(async () => {
    const { data } = await api.get('/ledger/accounts');
    setAccounts(Array.isArray(data) ? data : []);
  }, []);

  const loadEntries = useCallback(async () => {
    const { data } = await api.get('/ledger/entries');
    setEntries(Array.isArray(data?.entries) ? data.entries : []);
  }, []);

  const loadTrialBalance = useCallback(async () => {
    const { data } = await api.get('/ledger/trial-balance');
    setTrialBalance(data);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadAccounts(), loadEntries(), loadTrialBalance()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger le grand livre');
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, loadEntries, loadTrialBalance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Journal : création d'écriture ────────────────────────────────
  const lineTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    entryForm.lines.forEach((line) => {
      debit += Number(line.debit) || 0;
      credit += Number(line.credit) || 0;
    });
    return { debit, credit };
  }, [entryForm.lines]);
  const entryBalanced = lineTotals.debit > 0 && Math.abs(lineTotals.debit - lineTotals.credit) < 0.005;

  const updateLine = (index, field, value) => {
    setEntryForm((prev) => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setEntryForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  };

  const removeLine = (index) => {
    setEntryForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 2 ? prev.lines.filter((_, i) => i !== index) : prev.lines,
    }));
  };

  const submitEntry = async (e) => {
    e.preventDefault();
    if (!entryBalanced) {
      toast.error('L’écriture doit être équilibrée (débit = crédit)');
      return;
    }
    const lines = entryForm.lines
      .filter((line) => line.account && (Number(line.debit) > 0 || Number(line.credit) > 0))
      .map((line) => ({
        account: line.account,
        description: line.description,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
      }));
    if (lines.length < 2) {
      toast.error('Ajoutez au moins deux lignes');
      return;
    }

    setSavingEntry(true);
    try {
      await api.post('/ledger/entries', {
        date: entryForm.date || undefined,
        description: entryForm.description,
        lines,
      });
      toast.success('Écriture enregistrée');
      setEntryForm({ date: '', description: '', lines: [emptyLine()] });
      setShowEntryForm(false);
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur d’enregistrement');
    } finally {
      setSavingEntry(false);
    }
  };

  const deleteEntry = async (id) => {
    try {
      await api.delete(`/ledger/entries/${id}`);
      toast.success('Écriture supprimée');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression');
    }
  };

  // ── Plan comptable ───────────────────────────────────────────────
  const submitAccount = async (e) => {
    e.preventDefault();
    setSavingAccount(true);
    try {
      await api.post('/ledger/accounts', accountForm);
      toast.success('Compte créé');
      setAccountForm({ code: '', name: '', type: 'asset' });
      setShowAccountForm(false);
      await loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de création');
    } finally {
      setSavingAccount(false);
    }
  };

  const seedChart = async () => {
    try {
      const { data } = await api.post('/ledger/accounts/seed');
      toast.success(`${data.count} comptes créés`);
      await loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Initialisation impossible');
    }
  };

  const inputBase =
    'form-control w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]"
          style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}
        >
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <h1 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>
            Grand livre
          </h1>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Comptabilité en partie double : journal, plan comptable et balance.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="inline-flex rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radiusMedium)] px-3 text-sm font-semibold transition-colors ${
              tab === key ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--ms-danger)]">{error}</p>}
      {loading ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
      ) : (
        <>
          {/* ── JOURNAL ─────────────────────────────────────────────── */}
          {tab === 'journal' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Écritures</h2>
                <button
                  type="button"
                  onClick={() => setShowEntryForm((v) => !v)}
                  className="ms-button ms-button-primary min-h-[44px]"
                >
                  {showEntryForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {showEntryForm ? 'Fermer' : 'Nouvelle écriture'}
                </button>
              </div>

              {showEntryForm && (
                <form onSubmit={submitEntry} className="fluent-card-filled space-y-4 p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Date</label>
                      <input type="date" className={inputBase} value={entryForm.date} onChange={(e) => setEntryForm((p) => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Libellé</label>
                      <input type="text" className={inputBase} placeholder="Ex : Achat de fournitures" value={entryForm.description} onChange={(e) => setEntryForm((p) => ({ ...p, description: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {entryForm.lines.map((line, index) => (
                      <div key={index} className="grid gap-2 rounded-xl border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <select className={inputBase} value={line.account} onChange={(e) => updateLine(index, 'account', e.target.value)}>
                          <option value="">Compte…</option>
                          {accounts.map((a) => (
                            <option key={a._id} value={a._id}>{a.code} · {a.name}</option>
                          ))}
                        </select>
                        <input type="number" min="0" step="0.01" className={inputBase} placeholder="Débit" value={line.debit} onChange={(e) => updateLine(index, 'debit', e.target.value)} />
                        <input type="number" min="0" step="0.01" className={inputBase} placeholder="Crédit" value={line.credit} onChange={(e) => updateLine(index, 'credit', e.target.value)} />
                        <button type="button" onClick={() => removeLine(index)} className="ms-icon-button" aria-label="Retirer la ligne">
                          <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={addLine} className="ms-button ms-button-secondary min-h-[44px]">
                      <Plus className="h-4 w-4" /> Ajouter une ligne
                    </button>
                    <div className="flex items-center gap-4 text-sm">
                      <span>Débit : <strong>{formatCfa(lineTotals.debit)}</strong></span>
                      <span>Crédit : <strong>{formatCfa(lineTotals.credit)}</strong></span>
                      <span className={entryBalanced ? 'text-[var(--ms-success)]' : 'text-[var(--ms-warning)]'}>
                        {entryBalanced ? 'Équilibrée ✓' : 'Non équilibrée'}
                      </span>
                    </div>
                  </div>

                  <button type="submit" disabled={savingEntry} className="ms-button ms-button-primary min-h-[44px] justify-center disabled:opacity-60">
                    {savingEntry ? 'Enregistrement…' : 'Enregistrer l’écriture'}
                  </button>
                </form>
              )}

              {entries.length === 0 ? (
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Aucune écriture. Créez la première pour alimenter le journal.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)]">
                  <table className="min-w-full divide-y divide-[var(--ms-border)]">
                    <thead className="bg-[var(--ms-bg-subtle)]">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">N°</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Libellé</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Débit</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Crédit</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ms-border)]">
                      {entries.map((entry) => {
                        const totals = (entry.lines || []).reduce(
                          (acc, line) => ({
                            debit: acc.debit + (Number(line.debit) || 0),
                            credit: acc.credit + (Number(line.credit) || 0),
                          }),
                          { debit: 0, credit: 0 }
                        );
                        return (
                          <tr key={entry._id}>
                            <td className="px-3 py-2 text-sm font-semibold">{entry.entryNumber || '—'}</td>
                            <td className="px-3 py-2 text-sm whitespace-nowrap">{new Date(entry.date).toLocaleDateString('fr-FR')}</td>
                            <td className="px-3 py-2 text-sm">
                              <span className="block truncate max-w-[260px]">{entry.description || '—'}</span>
                              <span className="block text-xs text-[var(--ms-text-muted)]">
                                {(entry.lines || []).slice(0, 3).map((l) => l.account?.name || '?').join(' · ')}
                                {(entry.lines || []).length > 3 ? ' …' : ''}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(totals.debit)}</td>
                            <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(totals.credit)}</td>
                            <td className="px-3 py-2 text-right">
                              <button type="button" onClick={() => deleteEntry(entry._id)} className="ms-icon-button" aria-label="Supprimer">
                                <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PLAN COMPTABLE ───────────────────────────────────────── */}
          {tab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Plan comptable</h2>
                <div className="flex gap-2">
                  {accounts.length === 0 && (
                    <button type="button" onClick={seedChart} className="ms-button ms-button-secondary min-h-[44px]">
                      <Sparkles className="h-4 w-4" /> Initialiser le plan comptable
                    </button>
                  )}
                  <button type="button" onClick={() => setShowAccountForm((v) => !v)} className="ms-button ms-button-primary min-h-[44px]">
                    {showAccountForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showAccountForm ? 'Fermer' : 'Nouveau compte'}
                  </button>
                </div>
              </div>

              {showAccountForm && (
                <form onSubmit={submitAccount} className="fluent-card-filled grid gap-3 p-4 sm:grid-cols-4">
                  <div>
                    <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Code</label>
                    <input type="text" className={inputBase} value={accountForm.code} onChange={(e) => setAccountForm((p) => ({ ...p, code: e.target.value }))} placeholder="701" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Libellé</label>
                    <input type="text" className={inputBase} value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ventes de marchandises" required />
                  </div>
                  <div>
                    <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Type</label>
                    <select className={inputBase} value={accountForm.type} onChange={(e) => setAccountForm((p) => ({ ...p, type: e.target.value }))}>
                      {Object.entries(ACCOUNT_TYPES).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={savingAccount} className="ms-button ms-button-primary min-h-[44px] justify-center disabled:opacity-60 sm:col-span-4">
                    {savingAccount ? 'Création…' : 'Créer le compte'}
                  </button>
                </form>
              )}

              {accounts.length === 0 ? (
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Aucun compte. Initialisez le plan comptable standard ou créez un compte manuellement.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)]">
                  <table className="min-w-full divide-y divide-[var(--ms-border)]">
                    <thead className="bg-[var(--ms-bg-subtle)]">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Code</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Libellé</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Type</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ms-border)]">
                      {accounts.map((account) => {
                        const row = (trialBalance?.rows || []).find((r) => String(r.accountId) === String(account._id));
                        const balance = row ? row.balance : 0;
                        return (
                          <tr key={account._id}>
                            <td className="px-3 py-2 text-sm font-semibold tabular-nums">{account.code}</td>
                            <td className="px-3 py-2 text-sm">{account.name}</td>
                            <td className="px-3 py-2 text-sm text-[var(--ms-text-muted)]">{account.typeLabel}</td>
                            <td className={`px-3 py-2 text-right text-sm tabular-nums ${balance < 0 ? 'text-[var(--ms-danger)]' : ''}`}>{formatCfa(balance)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── BALANCE ──────────────────────────────────────────────── */}
          {tab === 'balance' && (
            <div className="space-y-4">
              <h2 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Balance comptable</h2>

              {!trialBalance || (trialBalance.rows || []).length === 0 ? (
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Aucun mouvement. Enregistrez des écritures pour voir la balance.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)]">
                  <table className="min-w-full divide-y divide-[var(--ms-border)]">
                    <thead className="bg-[var(--ms-bg-subtle)]">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Compte</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Débit</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Crédit</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ms-border)]">
                      {(trialBalance.rows || []).map((row) => (
                        <tr key={row.accountId}>
                          <td className="px-3 py-2 text-sm">
                            <span className="font-semibold">{row.code}</span>
                            <span className="ml-2 text-[var(--ms-text-muted)]">{row.name}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">{row.debit ? formatCfa(row.debit) : '—'}</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">{row.credit ? formatCfa(row.credit) : '—'}</td>
                          <td className={`px-3 py-2 text-right text-sm font-semibold tabular-nums ${row.balance < 0 ? 'text-[var(--ms-danger)]' : ''}`}>{formatCfa(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[var(--ms-bg-subtle)]">
                      <tr>
                        <td className="px-3 py-2 text-sm font-bold">Total</td>
                        <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">{formatCfa(trialBalance.totals.debit)}</td>
                        <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">{formatCfa(trialBalance.totals.credit)}</td>
                        <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">
                          {trialBalance.totals.balanced ? 'Équilibrée ✓' : 'Non équilibrée ✗'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Ledger;
