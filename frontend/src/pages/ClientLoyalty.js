import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Award, Crown, Gift, Users, Coins, Sparkles, ArrowLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';
import { clientPath } from '../utils/paths';
import {
  Button,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  SearchBox,
  Surface,
  Workspace,
} from '../components/business';

const cfa = (v) => `${Number(v || 0).toLocaleString('fr-FR')} CFA`;
const pts = (v) => `${Number(v || 0).toLocaleString('fr-FR')} pts`;
const formatDate = (v) => (v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const TierBadge = ({ label, color }) => (
  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${color}1f`, color }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    {label}
  </span>
);

/* ── Adjust modal: redeem points or grant a bonus ── */
const AdjustModal = ({ client, onClose, onDone }) => {
  const [mode, setMode] = useState('redeem');
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!client) return null;
  const n = Math.max(0, Math.trunc(Number(points) || 0));
  const tooMany = mode === 'redeem' && n > client.available;

  const submit = async (e) => {
    e.preventDefault();
    if (n <= 0) { toast.error('Entrez un nombre de points.'); return; }
    if (tooMany) { toast.error('Points insuffisants.'); return; }
    try {
      setSaving(true);
      await api.post(`/clients/${client._id}/loyalty`, {
        delta: mode === 'redeem' ? -n : n,
        reason: mode,
        note: note.trim(),
      });
      toast.success(mode === 'redeem' ? 'Points utilisés.' : 'Bonus ajouté.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(client)}
      onClose={onClose}
      title="Ajuster les points"
      subtitle={`${client.name} · ${pts(client.available)} disponibles`}
      size="sm"
      icon={<Gift size={20} />}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] p-1">
          {[
            { key: 'redeem', label: 'Utiliser (récompense)' },
            { key: 'bonus', label: 'Offrir un bonus' },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`min-h-[40px] rounded-[var(--radiusMedium)] text-sm font-semibold transition-colors ${mode === m.key ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div>
          <label className="form-label mb-1 block">Points</label>
          <input type="number" min="1" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} className="form-control" placeholder="0" autoFocus />
          {tooMany && <p className="mt-1 text-sm text-[var(--ms-danger)]">Le client n'a que {pts(client.available)}.</p>}
        </div>

        <div>
          <label className="form-label mb-1 block">Note (optionnel)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="form-control" placeholder="Ex. Réduction sur achat, cadeau anniversaire…" />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--ms-border)] pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={saving || n <= 0 || tooMany}>
            {saving ? 'Enregistrement…' : mode === 'redeem' ? `Utiliser ${n || 0} pts` : `Ajouter ${n || 0} pts`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const ClientLoyalty = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [adjustClient, setAdjustClient] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/clients/loyalty');
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de chargement du programme de fidélité.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tiers = data?.config?.tiers || [];
  const kpis = data?.kpis || {};
  const clients = useMemo(() => data?.clients || [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (tierFilter && c.tier !== tierFilter) return false;
      if (!q) return true;
      return `${c.name} ${c.phone}`.toLowerCase().includes(q);
    });
  }, [clients, search, tierFilter]);

  return (
    <Workspace>
      <PageHeader
        eyebrow="Clients"
        title="Programme de fidélité"
        description={`Points, paliers et récompenses${data ? ` — 1 point pour ${cfa(data.config.cfaPerPoint)} d'achats` : ''}.`}
        actions={
          <Link to="/clients" className="ms-button ms-button-secondary ms-button-md">
            <ArrowLeft className="h-4 w-4" /> Clients
          </Link>
        }
      />

      {error && <EmptyState title="Erreur" description={error} action={<Button onClick={load}>Réessayer</Button>} />}

      {loading ? (
        <LoadingSkeleton rows={8} />
      ) : !error && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KPICard title="Membres" value={Number(kpis.members || 0).toLocaleString('fr-FR')} context="Clients avec achats" icon={<Users className="h-4 w-4" />} tone="brand" />
            <KPICard title="Points en circulation" value={pts(kpis.pointsAvailable)} context="Disponibles chez les clients" icon={<Coins className="h-4 w-4" />} tone="success" />
            <KPICard title="Points utilisés" value={pts(kpis.pointsRedeemed)} context="Récompenses accordées" icon={<Gift className="h-4 w-4" />} tone="warning" />
            <KPICard title="Bonus offerts" value={pts(kpis.pointsBonus)} context="Points ajoutés manuellement" icon={<Sparkles className="h-4 w-4" />} tone="neutral" />
          </div>

          {/* Tier legend / filter */}
          <Surface className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchBox label="Rechercher un client" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou téléphone…" className="flex-1" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTierFilter('')}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!tierFilter ? 'border-transparent bg-[var(--ms-blue)] text-white' : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:bg-[var(--ms-surface-muted)]'}`}
              >
                Tous <span className={`rounded-full px-1.5 text-xs font-semibold ${!tierFilter ? 'bg-white/20' : 'bg-[var(--ms-white)] text-[var(--ms-text-muted)]'}`}>{clients.length}</span>
              </button>
              {tiers.map((t) => {
                const active = tierFilter === t.key;
                const count = kpis.tierCounts?.[t.key] || 0;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTierFilter(active ? '' : t.key)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                    style={active
                      ? { background: t.color, borderColor: 'transparent', color: '#fff' }
                      : { background: `${t.color}14`, borderColor: `${t.color}40`, color: t.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? '#fff' : t.color }} />
                    {t.label} <span className="rounded-full bg-black/10 px-1.5 text-xs font-semibold" style={{ background: active ? 'rgba(255,255,255,0.2)' : '#0000000f' }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </Surface>

          {/* Leaderboard */}
          {filtered.length === 0 ? (
            <EmptyState title="Aucun client" description="Aucun client ne correspond à ce filtre." />
          ) : (
            <Surface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--colorNeutralBackground2)' }}>
                    <tr>
                      {['#', 'Client', 'Palier', 'Dépensé', 'Points dispo.', 'Progression', ''].map((h, i) => (
                        <th key={h || i} className={`px-3 py-2.5 fui-caption1-strong uppercase ${i >= 3 && i <= 4 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--colorNeutralForeground3)', borderBottom: '1px solid var(--colorNeutralStroke2)', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => (
                      <tr key={c._id} style={{ borderBottom: '1px solid var(--colorNeutralStroke3)' }}>
                        <td className="px-3 py-3 tabular-nums" style={{ color: 'var(--colorNeutralForeground3)' }}>{idx + 1}</td>
                        <td className="px-3 py-3">
                          <Link to={clientPath(c)} className="font-semibold text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)]">{c.name}</Link>
                          <p className="text-xs text-[var(--ms-text-muted)]">{c.phone || '—'} · {c.salesCount} achat{c.salesCount > 1 ? 's' : ''} · {formatDate(c.lastPurchase)}</p>
                        </td>
                        <td className="px-3 py-3"><TierBadge label={c.tierLabel} color={c.tierColor} /></td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{cfa(c.totalSpent)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-semibold tabular-nums text-[var(--ms-text-strong)]">{pts(c.available)}</span>
                          <span className="block text-xs text-[var(--ms-text-muted)]">{c.earned} gagnés{c.redeemed ? ` · ${c.redeemed} utilisés` : ''}</span>
                        </td>
                        <td className="px-3 py-3" style={{ minWidth: 150 }}>
                          {c.nextTier ? (
                            <>
                              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--colorNeutralBackground3)' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((c.earned / c.nextTier.minPoints) * 100))}%`, background: c.tierColor }} />
                              </div>
                              <span className="mt-1 block text-[11px] text-[var(--ms-text-muted)]">{c.nextTier.remaining} pts → {c.nextTier.label}</span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: c.tierColor }}><Crown size={12} /> Palier max</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => setAdjustClient(c)} className="ms-button ms-button-secondary ms-button-sm inline-flex items-center gap-1">
                            <Award size={13} /> Ajuster <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}
        </>
      )}

      <AdjustModal client={adjustClient} onClose={() => setAdjustClient(null)} onDone={() => { setAdjustClient(null); load(); }} />
    </Workspace>
  );
};

export default ClientLoyalty;
