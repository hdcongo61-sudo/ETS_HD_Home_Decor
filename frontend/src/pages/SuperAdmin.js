import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import {
  Building2, Users, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Clock, Search, Plus, Download, LogIn, Trash2, X,
  Package, TrendingUp, Wallet, Receipt,
  CreditCard, History, BadgeDollarSign, Activity, ArrowRight, Zap,
  Layers, Save, Pencil, BarChart3, TrendingDown, Boxes, AlertCircle,
  RotateCcw, BookOpen, LifeBuoy,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, PieChart, Pie, Cell } from 'recharts';
import { EmptyState, LoadingSkeleton, PageHeader, RightDetailPanel, Workspace } from '../components/business';
import { FEATURE_LABELS } from '../config/features';

const PLAN_COLORS = { trial: '#F59E0B', basic: '#0EA5E9', pro: '#0F6CBD', enterprise: '#7C3AED' };

/* ─── Helpers ─────────────────────────────────────────── */
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const money = (n) => `${fmt(Math.round(n || 0))} CFA`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const daysLeft = (d) => (d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null);
const relativeDays = (d) => {
  if (!d) return 'jamais';
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days}j`;
};

const STATUS_META = {
  active:    { label: 'Actif',    tone: 'success', icon: CheckCircle2 },
  trial:     { label: 'Essai',    tone: 'warning', icon: Clock },
  suspended: { label: 'Suspendu', tone: 'danger',  icon: XCircle },
  expired:   { label: 'Expiré',   tone: 'danger',  icon: AlertTriangle },
};
const PLAN_LABELS = { trial: 'Essai', basic: 'Basique', pro: 'Pro', enterprise: 'Entreprise' };
const PLAN_PRICES = { trial: 0, basic: 5000, pro: 15000, enterprise: 40000 };
const PLAN_OPTIONS = Object.entries(PLAN_LABELS);

const AUDIT_META = {
  'tenant.create':      { label: 'Boutique créée',     tone: 'success', icon: Plus },
  'tenant.suspend':     { label: 'Suspendue',          tone: 'danger',  icon: XCircle },
  'tenant.reactivate':  { label: 'Réactivée',          tone: 'success', icon: CheckCircle2 },
  'tenant.plan_change': { label: 'Changement de plan', tone: 'warning', icon: BadgeDollarSign },
  'tenant.update':      { label: 'Mise à jour',        tone: 'neutral', icon: Activity },
  'tenant.delete':      { label: 'Supprimée',          tone: 'danger',  icon: Trash2 },
  'tenant.impersonate': { label: 'Accès supervision',  tone: 'warning', icon: LogIn },
  'tenant.payment':     { label: 'Paiement',           tone: 'success', icon: Receipt },
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.active;
  return <span className={`ms-status-badge ms-status-${m.tone}`}>{m.label}</span>;
};

const Kpi = ({ label, value, sub, accent = 'var(--colorBrandForeground1)', icon: Icon, trend }) => (
  <div className="ms-kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
    <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="ms-kpi-title">{label}</p>
        <p className="ms-kpi-value tabular-nums" style={{ fontSize: 24 }}>{value}</p>
        {sub && <p className="ms-kpi-context">{sub}</p>}
      </div>
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radiusMedium)]" style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}>
          <Icon size={18} />
        </span>
      )}
    </div>
    {trend != null && Number.isFinite(trend) && (
      <span className="mt-2 inline-flex items-center gap-1 fui-caption1-strong" style={{ color: trend >= 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        <span style={{ color: 'var(--colorNeutralForeground3)', fontWeight: 400 }}>vs mois préc.</span>
      </span>
    )}
  </div>
);

/* ─── Documents éditeur (PDF) ─────────────────────────── */
const DOC_LABELS = {
  flyer: 'Flyer (prospection)',
  guide: 'Guide de gestion',
  formation: 'Guide de formation',
};

// Generates the branded PDF for a doc type and triggers a download.
const downloadDocPdf = async (type) => {
  const res = await api.get(`/export/doc/${type}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HD_Gestion_${type}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const EditorDocs = () => {
  const [busy, setBusy] = useState('');
  const download = async (type) => {
    try { setBusy(type); await downloadDocPdf(type); }
    catch { toast.error('Erreur lors de la génération du PDF.'); }
    finally { setBusy(''); }
  };
  return (
    <div className="fluent-card-filled p-5">
      <p className="fui-subtitle2 mb-1" style={{ color: 'var(--colorNeutralForeground1)' }}>Télécharger les documents (PDF)</p>
      <p className="fui-caption1 mb-4" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Supports prêts à partager pour la prospection et la formation des commerçants.
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(DOC_LABELS).map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => download(type)}
            disabled={busy === type}
            className="ms-button ms-button-secondary ms-button-md disabled:opacity-60"
          >
            <Download size={15} /> {busy === type ? 'Génération…' : label}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ─── Éditeur de contenu des documents ────────────────── */
const DocEditor = () => {
  const [type, setType] = useState('formation');
  const [spec, setSpec] = useState(null);
  const [edited, setEdited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async (t) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/export/doc/${t}/content`);
      setSpec(data.spec || { title: '', subtitle: '', sections: [] });
      setEdited(!!data.edited);
      setDirty(false);
    } catch {
      setSpec(null);
      toast.error('Impossible de charger le document.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(type); }, [type, load]);

  const touch = (updater) => { setSpec(updater); setDirty(true); };
  const setSections = (fn) => touch((s) => ({ ...s, sections: fn(s.sections || []) }));
  const setBullets = (si, fn) => setSections((secs) => secs.map((sec, i) => (i === si ? { ...sec, bullets: fn(sec.bullets || []) } : sec)));

  const save = async () => {
    if (!spec?.title?.trim()) { toast.error('Le titre est requis.'); return; }
    setSaving(true);
    try {
      const { data } = await api.put(`/export/doc/${type}/content`, { spec });
      setSpec(data.spec); setEdited(true); setDirty(false);
      toast.success('Document enregistré.');
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm('Restaurer le contenu par défaut ? Vos modifications seront perdues.')) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/export/doc/${type}/content`, { reset: true });
      setSpec(data.spec); setEdited(false); setDirty(false);
      toast.success('Contenu par défaut restauré.');
    } catch {
      toast.error('Erreur lors de la réinitialisation.');
    } finally { setSaving(false); }
  };

  const fieldStyle = { color: 'var(--colorNeutralForeground1)' };

  return (
    <div className="fluent-card-filled p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="fui-subtitle2 flex items-center gap-2" style={fieldStyle}>
            <Pencil size={15} /> Modifier le contenu
            {edited && <span className="ms-status-badge ms-status-success">Personnalisé</span>}
          </p>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Le texte est enregistré et utilisé lors de la génération du PDF.
          </p>
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="form-control" style={{ maxWidth: 240 }}>
          {Object.entries(DOC_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {loading || !spec ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label mb-1 block">Titre</label>
              <input className="form-control" value={spec.title || ''} onChange={(e) => touch((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div>
              <label className="form-label mb-1 block">Sous-titre</label>
              <input className="form-control" value={spec.subtitle || ''} onChange={(e) => touch((s) => ({ ...s, subtitle: e.target.value }))} />
            </div>
          </div>

          {(spec.sections || []).map((sec, si) => (
            <div key={si} className="rounded-[var(--radiusLarge)] p-3.5" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
              <div className="mb-2 flex items-center gap-2">
                <span className="fui-caption1 font-semibold" style={{ color: 'var(--colorNeutralForeground3)' }}>Section {si + 1}</span>
                <button type="button" onClick={() => setSections((secs) => secs.filter((_, i) => i !== si))} className="ms-icon-button ms-icon-button-sm ml-auto" title="Supprimer la section">
                  <Trash2 size={14} style={{ color: 'var(--colorStatusDangerForeground1)' }} />
                </button>
              </div>
              <input className="form-control mb-2" placeholder="Titre de la section" value={sec.heading || ''} onChange={(e) => setSections((secs) => secs.map((x, i) => (i === si ? { ...x, heading: e.target.value } : x)))} />
              <textarea className="form-control mb-2" rows={2} placeholder="Paragraphe (optionnel)" value={sec.body || ''} onChange={(e) => setSections((secs) => secs.map((x, i) => (i === si ? { ...x, body: e.target.value } : x)))} />
              <div className="space-y-1.5">
                {(sec.bullets || []).map((b, bi) => (
                  <div key={bi} className="flex items-center gap-2">
                    <span style={{ color: 'var(--colorBrandForeground1)' }}>•</span>
                    <input className="form-control" value={b} onChange={(e) => setBullets(si, (bs) => bs.map((x, i) => (i === bi ? e.target.value : x)))} />
                    <button type="button" onClick={() => setBullets(si, (bs) => bs.filter((_, i) => i !== bi))} className="ms-icon-button ms-icon-button-sm" title="Supprimer la puce">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setBullets(si, (bs) => [...bs, ''])} className="ms-button ms-button-secondary ms-button-sm">
                  <Plus size={13} /> Ajouter une puce
                </button>
              </div>
            </div>
          ))}

          <button type="button" onClick={() => setSections((secs) => [...secs, { heading: '', body: '', bullets: [] }])} className="ms-button ms-button-secondary ms-button-md w-full justify-center">
            <Plus size={15} /> Ajouter une section
          </button>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
            <button type="button" onClick={save} disabled={saving || !dirty} className="ms-button ms-button-primary ms-button-md disabled:opacity-60">
              <Save size={15} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => downloadDocPdf(type).catch(() => toast.error('Erreur PDF.'))} className="ms-button ms-button-secondary ms-button-md">
              <Download size={15} /> Aperçu PDF
            </button>
            {edited && (
              <button type="button" onClick={reset} disabled={saving} className="ms-button ms-button-secondary ms-button-md ml-auto disabled:opacity-60">
                <RotateCcw size={15} /> Restaurer par défaut
              </button>
            )}
          </div>
          {dirty && <p className="fui-caption1" style={{ color: 'var(--colorStatusWarningForeground1)' }}>Modifications non enregistrées.</p>}
        </div>
      )}
    </div>
  );
};

/* ─── TAB: Ressources ─────────────────────────────────── */
const ResourcesTab = () => (
  <div className="space-y-4">
    <EditorDocs />
    <DocEditor />
  </div>
);

/* ─── TAB: Messages (assistance boutiques) ────────────── */
const SUPPORT_CATS = { suggestion: 'Suggestion', reclamation: 'Réclamation', question: 'Question', autre: 'Autre' };

const AdminTicketThread = ({ id, onBack, onChanged }) => {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get(`/support/admin/${id}`); setTicket(data); onChanged?.(); }
    catch { toast.error('Message introuvable.'); onBack(); }
    finally { setLoading(false); }
  }, [id, onBack, onChanged]);
  useEffect(() => { load(); }, [load]);

  const send = async (resolve) => {
    if (!reply.trim()) { toast.error('Le message est requis.'); return; }
    setSending(true);
    try {
      const { data } = await api.post(`/support/admin/${id}/reply`, { message: reply.trim(), resolve });
      setTicket(data); setReply(''); onChanged?.();
      toast.success(resolve ? 'Réponse envoyée et marqué résolu.' : 'Réponse envoyée.');
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur.'); }
    finally { setSending(false); }
  };

  const setStatus = async (status) => {
    try { const { data } = await api.put(`/support/admin/${id}`, { status }); setTicket(data); onChanged?.(); }
    catch { toast.error('Erreur.'); }
  };

  if (loading || !ticket) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="ms-button ms-button-secondary ms-button-sm">
        <ArrowRight size={15} style={{ transform: 'rotate(180deg)' }} /> Tous les messages
      </button>

      <div className="fluent-card-filled p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="fui-subtitle1 truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{ticket.subject}</h2>
            <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
              {ticket.tenantName || 'Boutique'} · {SUPPORT_CATS[ticket.category] || ticket.category}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`ms-status-badge ${ticket.status === 'resolved' ? 'ms-status-success' : 'ms-status-warning'}`}>
              {ticket.status === 'resolved' ? 'Résolu' : 'Ouvert'}
            </span>
            <button type="button" onClick={() => setStatus(ticket.status === 'resolved' ? 'open' : 'resolved')} className="ms-button ms-button-secondary ms-button-sm">
              {ticket.status === 'resolved' ? 'Rouvrir' : 'Marquer résolu'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m, i) => {
          const fromSupport = m.sender === 'support';
          return (
            <div key={m._id || i} className={`flex ${fromSupport ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] rounded-[var(--radiusLarge)] px-3.5 py-2.5" style={{ background: fromSupport ? 'var(--ms-blue-soft)' : 'var(--colorNeutralBackground3)', border: '1px solid var(--colorNeutralStroke2)' }}>
                <p className="fui-caption2 mb-0.5 font-semibold" style={{ color: fromSupport ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground2)' }}>
                  {fromSupport ? (m.authorName || 'Support') : `${ticket.tenantName || 'Boutique'}${m.authorName ? ' · ' + m.authorName : ''}`}
                </p>
                <p className="fui-body1 whitespace-pre-wrap" style={{ color: 'var(--colorNeutralForeground1)' }}>{m.body}</p>
                <p className="fui-caption2 mt-1 text-right" style={{ color: 'var(--colorNeutralForeground3)' }}>{fmtDateTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fluent-card-filled space-y-2 p-3">
        <textarea className="form-control" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} placeholder="Répondre à la boutique…" />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => send(false)} disabled={sending || !reply.trim()} className="ms-button ms-button-primary ms-button-md disabled:opacity-60">
            {sending ? 'Envoi…' : 'Répondre'}
          </button>
          <button type="button" onClick={() => send(true)} disabled={sending || !reply.trim()} className="ms-button ms-button-secondary ms-button-md disabled:opacity-60">
            Répondre & résoudre
          </button>
        </div>
      </div>
    </div>
  );
};

const SupportTab = ({ onCountChange }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [status, setStatusFilter] = useState('');
  const [category, setCategoryFilter] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (category) params.category = category;
      if (q.trim()) params.q = q.trim();
      const { data } = await api.get('/support/admin/all', { params });
      setTickets(data || []);
      onCountChange?.();
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, [status, category, q, onCountChange]);
  useEffect(() => { load(); }, [load]);

  // Unread first, then open before resolved, then most recent.
  const sorted = useMemo(() => [...tickets].sort((a, b) => {
    const au = a.unreadForSupport > 0 ? 1 : 0, bu = b.unreadForSupport > 0 ? 1 : 0;
    if (au !== bu) return bu - au;
    const ao = a.status !== 'resolved' ? 1 : 0, bo = b.status !== 'resolved' ? 1 : 0;
    if (ao !== bo) return bo - ao;
    return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
  }), [tickets]);
  const unreadCount = tickets.reduce((n, t) => n + (t.unreadForSupport > 0 ? 1 : 0), 0);

  if (openId) return <AdminTicketThread id={openId} onBack={() => { setOpenId(null); load(); }} onChanged={onCountChange} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className="form-control" style={{ maxWidth: 220 }} placeholder="Rechercher (boutique, sujet)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="open">Ouverts</option>
          <option value="resolved">Résolus</option>
        </select>
        <select className="form-control" style={{ maxWidth: 160 }} value={category} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Toutes catégories</option>
          {Object.entries(SUPPORT_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : tickets.length === 0 ? (
        <EmptyState title="Aucun message" description="Aucune boutique n'a contacté le support pour ces filtres." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
              <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(tickets.length)}</span> conversation{tickets.length > 1 ? 's' : ''}
            </p>
            {unreadCount > 0 && <span className="ms-status-badge ms-status-danger">{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</span>}
          </div>
          <div className="space-y-2">
            {sorted.map((t) => {
              const unread = t.unreadForSupport > 0;
              return (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => setOpenId(t._id)}
                  className="fluent-card-filled flex w-full items-center gap-3 p-4 text-left transition hover:brightness-[0.98]"
                  style={unread ? { borderLeft: '3px solid var(--colorStatusDangerForeground1)', background: 'var(--colorStatusDangerBackground1)' } : undefined}
                >
                  {unread && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--colorStatusDangerForeground1)' }} aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate ${unread ? 'fui-body1-strong' : 'fui-body1'}`} style={{ color: 'var(--colorNeutralForeground1)' }}>{t.subject}</p>
                      {unread && (
                        <span className="shrink-0 rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--colorStatusDangerForeground1)' }}>{t.unreadForSupport}</span>
                      )}
                    </div>
                    <p className="fui-caption1 mt-0.5 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--colorNeutralBackground3)', color: 'var(--colorNeutralForeground2)' }}>{SUPPORT_CATS[t.category] || t.category}</span>
                      {' · '}{t.tenantName || 'Boutique'}{t.lastMessage ? ` · ${t.lastMessage.sender === 'support' ? 'Vous : ' : ''}${t.lastMessage.body}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`ms-status-badge ${t.status === 'resolved' ? 'ms-status-success' : 'ms-status-warning'}`}>{t.status === 'resolved' ? 'Résolu' : 'Ouvert'}</span>
                    <span className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{fmtDateTime(t.lastMessageAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Demandes de changement de plan ──────────────────── */
const PlanRequests = () => {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/tenants');
      setRows((data || []).filter((t) => t.planRequest && t.planRequest.status === 'pending'));
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    setBusy(id + action);
    try {
      await api.put(`/tenants/${id}/plan-request`, { action });
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy('');
    }
  };

  if (!rows.length) return null;

  return (
    <div className="fluent-card-filled p-5">
      <p className="fui-subtitle2 mb-1" style={{ color: 'var(--colorNeutralForeground1)' }}>
        Demandes de changement de plan ({rows.length})
      </p>
      <p className="fui-caption1 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Validez (applique le plan) ou refusez les demandes des boutiques.
      </p>
      <div className="space-y-2">
        {rows.map((t) => (
          <div key={t._id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radiusMedium)] p-3" style={{ background: 'var(--colorNeutralBackground2)' }}>
            <div className="min-w-0">
              <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{t.name}</p>
              <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                {t.plan} → <strong style={{ color: 'var(--colorBrandForeground1)' }}>{t.planRequest.requestedPlan}</strong>
                {t.planRequest.note ? ` · ${t.planRequest.note}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => resolve(t._id, 'approve')} disabled={!!busy} className="ms-button ms-button-primary ms-button-sm disabled:opacity-60">Approuver</button>
              <button type="button" onClick={() => resolve(t._id, 'reject')} disabled={!!busy} className="ms-button ms-button-secondary ms-button-sm disabled:opacity-60">Refuser</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Confirm Dialog ──────────────────────────────────── */
const ConfirmDialog = ({ open, title, description, confirmLabel = 'Confirmer', danger = false, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="fluent-card-filled p-6 w-full max-w-sm" style={{ boxShadow: 'var(--shadow28)' }}>
        <h3 className="fui-subtitle1 mb-2" style={{ color: 'var(--colorNeutralForeground1)' }}>{title}</h3>
        <p className="fui-body1 mb-5" style={{ color: 'var(--colorNeutralForeground3)' }}>{description}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="ms-button ms-button-secondary ms-button-md">Annuler</button>
          <button onClick={onConfirm} className={`ms-button ms-button-md ${danger ? 'ms-button-danger' : 'ms-button-primary'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

/* ─── Create Tenant Modal ─────────────────────────────── */
const CreateTenantModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ shopName: '', ownerName: '', ownerEmail: '', ownerPhone: '', password: '', plan: 'trial', status: 'trial' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const handleChange = (e) => { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); setError(''); };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.shopName || !form.ownerName || !form.ownerEmail || !form.password) { setError('Tous les champs obligatoires doivent être remplis.'); return; }
    try {
      setSubmitting(true);
      const { data } = await api.post('/tenants', form);
      onCreated(data.tenant);
      setForm({ shopName: '', ownerName: '', ownerEmail: '', ownerPhone: '', password: '', plan: 'trial', status: 'trial' });
      onClose();
    } catch (err) { setError(err.response?.data?.message || 'Erreur lors de la création.'); }
    finally { setSubmitting(false); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="fluent-card-filled w-full max-w-lg" style={{ boxShadow: 'var(--shadow28)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Nouvelle boutique</h2>
          <button onClick={onClose} className="ms-icon-button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="rounded-[var(--radiusLarge)] px-3 py-2 fui-caption1" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block"><span className="form-label block mb-1">Nom boutique *</span><input type="text" name="shopName" value={form.shopName} onChange={handleChange} className="form-control" required /></label>
            <label className="block"><span className="form-label block mb-1">Propriétaire *</span><input type="text" name="ownerName" value={form.ownerName} onChange={handleChange} className="form-control" required /></label>
            <label className="block"><span className="form-label block mb-1">Email *</span><input type="email" name="ownerEmail" value={form.ownerEmail} onChange={handleChange} className="form-control" required /></label>
            <label className="block"><span className="form-label block mb-1">Téléphone</span><input type="tel" name="ownerPhone" value={form.ownerPhone} onChange={handleChange} className="form-control" /></label>
            <label className="block"><span className="form-label block mb-1">Mot de passe *</span><input type="password" name="password" value={form.password} onChange={handleChange} className="form-control" required /></label>
            <label className="block"><span className="form-label block mb-1">Plan</span>
              <select name="plan" value={form.plan} onChange={handleChange} className="form-control">
                {PLAN_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v} — {money(PLAN_PRICES[k])}/mois</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="ms-button ms-button-secondary ms-button-md">Annuler</button>
            <button type="submit" disabled={submitting} className="ms-button ms-button-primary ms-button-md">{submitting ? 'Création...' : 'Créer la boutique'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Payment Modal ───────────────────────────────────── */
const PaymentModal = ({ tenant, onClose, onRecorded }) => {
  const [form, setForm] = useState({ amount: tenant?.monthlyPrice || '', method: 'cash', note: '', nextPaymentDue: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  if (!tenant) return null;
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const { data } = await api.post(`/tenants/${tenant._id}/payment`, form);
      onRecorded(data);
      onClose();
    } catch (err) { setError(err.response?.data?.message || 'Erreur.'); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="fluent-card-filled w-full max-w-md" style={{ boxShadow: 'var(--shadow28)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Paiement — {tenant.name}</h2>
          <button onClick={onClose} className="ms-icon-button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="rounded-[var(--radiusLarge)] px-3 py-2 fui-caption1" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>{error}</div>}
          <label className="block"><span className="form-label block mb-1">Montant (CFA) *</span><input type="number" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="form-control" required autoFocus /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className="form-label block mb-1">Méthode</span>
              <select value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))} className="form-control">
                <option value="cash">Espèces</option><option value="mobile_money">Mobile Money</option><option value="transfer">Virement</option>
              </select>
            </label>
            <label className="block"><span className="form-label block mb-1">Prochaine échéance</span><input type="date" value={form.nextPaymentDue} onChange={(e) => setForm((p) => ({ ...p, nextPaymentDue: e.target.value }))} className="form-control" /></label>
          </div>
          <label className="block"><span className="form-label block mb-1">Note</span><input type="text" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} className="form-control" placeholder="Réf. transaction, mois couvert..." /></label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="ms-button ms-button-secondary ms-button-md">Annuler</button>
            <button type="submit" disabled={submitting} className="ms-button ms-button-primary ms-button-md">{submitting ? '...' : 'Enregistrer le paiement'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════ */
/*  MAIN                                                    */
/* ═══════════════════════════════════════════════════════ */
const TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: TrendingUp },
  { id: 'tenants',  label: 'Boutiques',      icon: Building2 },
  { id: 'plans',    label: 'Forfaits',       icon: Layers },
  { id: 'billing',  label: 'Facturation',    icon: Wallet },
  { id: 'support',  label: 'Messages',       icon: LifeBuoy },
  { id: 'resources', label: 'Ressources',    icon: BookOpen },
  { id: 'audit',    label: 'Journal',        icon: History },
];

const SuperAdmin = () => {
  const navigate = useNavigate();
  const { auth, setAuth } = useContext(AuthContext);
  const [tab, setTab] = useState('overview');

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);
  const [supportUnread, setSupportUnread] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchSupportUnread = useCallback(() => {
    api.get('/support/admin/unread').then(({ data }) => setSupportUnread(data?.unread || 0)).catch(() => {});
  }, []);
  useEffect(() => {
    fetchSupportUnread();
    const id = setInterval(fetchSupportUnread, 60000); // live unread badge
    return () => clearInterval(id);
  }, [fetchSupportUnread]);

  useEffect(() => { if (!auth.isLoading && !auth.isSuperAdmin) navigate('/', { replace: true }); }, [auth, navigate]);

  const fetchTenants = useCallback(async () => {
    try { setLoading(true); const { data } = await api.get('/tenants'); setTenants(data); setLastRefresh(Date.now()); }
    catch (err) { setError(err.response?.data?.message || 'Erreur de chargement.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const patchTenant = (id, patch) => setTenants((prev) => prev.map((t) => (t._id === id ? { ...t, ...patch } : t)));

  const handleStatusChange = async (id, status) => {
    try { setUpdating(id); const { data } = await api.put(`/tenants/${id}`, { status }); patchTenant(id, { status: data.status }); }
    catch (err) { alert(err.response?.data?.message || 'Erreur.'); } finally { setUpdating(null); }
  };
  const handlePlanChange = async (id, plan) => {
    try { setUpdating(id); const { data } = await api.put(`/tenants/${id}`, { plan }); patchTenant(id, { plan: data.plan, monthlyPrice: data.monthlyPrice, maxUsers: data.maxUsers, maxProducts: data.maxProducts }); }
    catch (err) { alert(err.response?.data?.message || 'Erreur.'); } finally { setUpdating(null); }
  };

  const handleImpersonate = async (id) => {
    try {
      setUpdating(id);
      const { data } = await api.post(`/tenants/${id}/impersonate`);
      sessionStorage.setItem('superAdminToken', localStorage.getItem('token') || '');
      sessionStorage.setItem('superAdminTenantId', localStorage.getItem('tenantId') || '');
      sessionStorage.setItem('impersonating', '1');
      sessionStorage.setItem('impersonatingTenantName', data.tenant?.name || '');
      localStorage.setItem('token', data.token);
      localStorage.setItem('tenantId', data.tenant._id);
      setAuth({ isAuthenticated: true, user: { ...data.user, isAdmin: true }, isAdmin: true, isSuperAdmin: false, tenantId: data.tenant._id, isLoading: false });
      navigate('/', { replace: true });
    } catch (err) { alert(err.response?.data?.message || 'Impossible.'); setUpdating(null); }
  };

  if (!auth.isSuperAdmin) return null;

  return (
    <Workspace>
      <PageHeader
        eyebrow="Console Plateforme"
        title="Super Admin"
        description="Pilotez l'ensemble des boutiques : revenus, abonnements, supervision et journal."
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 fui-caption1 sm:inline-flex" style={{ color: 'var(--colorNeutralForeground3)' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--colorStatusSuccessForeground1)' }} />
              {lastRefresh ? `Mis à jour à ${new Date(lastRefresh).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'En direct'}
            </span>
            <button onClick={fetchTenants} disabled={loading} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5 disabled:opacity-60">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="fui-pivot">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`fui-pivot__tab ${tab === id ? 'fui-pivot__tab--active' : ''}`}>
            <Icon size={15} /> {label}
            {id === 'support' && supportUnread > 0 && (
              <span className="ml-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ height: 16, background: 'var(--colorStatusDangerForeground1)' }}>
                {supportUnread > 9 ? '9+' : supportUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-[var(--radiusLarge)] px-4 py-3 fui-body1" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>{error}</div>
      )}

      {tab === 'overview' && <OverviewTab onJump={setTab} />}
      {tab === 'tenants'  && <TenantsTab tenants={tenants} loading={loading} updating={updating} onReload={fetchTenants} onStatus={handleStatusChange} onPlan={handlePlanChange} onImpersonate={handleImpersonate} setTenants={setTenants} />}
      {tab === 'plans'    && <PlansTab />}
      {tab === 'billing'  && <BillingTab tenants={tenants} loading={loading} onReload={fetchTenants} />}
      {tab === 'support'  && <SupportTab onCountChange={fetchSupportUnread} />}
      {tab === 'resources' && <ResourcesTab />}
      {tab === 'audit'    && <AuditTab />}
    </Workspace>
  );
};

/* ─── TAB: Overview ───────────────────────────────────── */
const OverviewTab = ({ onJump }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (initial) => {
    try { const { data } = await api.get('/tenants/stats/overview'); setStats(data); }
    catch { /* ignore */ } finally { if (initial) setLoading(false); }
  }, []);
  useEffect(() => {
    load(true);
    const id = setInterval(() => load(false), 60000); // silent background refresh
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (!stats) return <EmptyState title="Statistiques indisponibles" />;

  const { revenue, funnel, signups, planDist, attention, growth = {}, churnRate = 0 } = stats;
  const attentionTotal = attention.trialsExpiring.length + attention.paymentsOverdue.length + attention.dormant.length + attention.nearLimit.length;

  const growthData = Object.entries(growth).map(([m, v]) => ({ month: m.slice(5), Nouvelles: v.new || 0, Perdues: v.lost || 0 }));
  const totalNew = growthData.reduce((s, d) => s + d.Nouvelles, 0);
  const totalLost = growthData.reduce((s, d) => s + d.Perdues, 0);

  const signupEntries = Object.entries(signups);
  const signupData = signupEntries.map(([month, count]) => ({ month: month.slice(5), count }));
  const lastSignup = signupEntries.length ? signupEntries[signupEntries.length - 1][1] : 0;
  const prevSignup = signupEntries.length > 1 ? signupEntries[signupEntries.length - 2][1] : 0;
  const signupTrend = prevSignup > 0 ? Math.round(((lastSignup - prevSignup) / prevSignup) * 100) : null;
  const planTotal = Object.values(planDist).reduce((a, b) => a + b, 0) || 1;
  const planData = PLAN_OPTIONS.map(([k]) => ({ key: k, name: PLAN_LABELS[k], value: planDist[k] || 0 }));

  const tooltipStyle = { background: 'var(--ms-white)', border: '1px solid var(--colorNeutralStroke2)', borderRadius: 8, fontSize: 12, boxShadow: 'var(--ms-shadow-sm)' };

  const exportCsv = () => {
    const rows = [['Section', 'Métrique', 'Valeur']];
    rows.push(['Revenu', 'MRR (CFA)', Math.round(revenue.mrr || 0)]);
    rows.push(['Revenu', 'ARR (CFA)', Math.round(revenue.arr || 0)]);
    rows.push(['Revenu', 'Encaissé ce mois (CFA)', Math.round(revenue.revenueThisMonth || 0)]);
    rows.push(['Boutiques', 'Total', funnel.total]);
    rows.push(['Boutiques', 'Payantes', funnel.paying]);
    rows.push(['Boutiques', 'Essais', funnel.trials]);
    rows.push(['Boutiques', 'Suspendues', funnel.suspended]);
    rows.push(['Boutiques', 'Perdues', funnel.churned]);
    PLAN_OPTIONS.forEach(([k, v]) => {
      const count = planDist[k] || 0;
      rows.push([`Plan ${v}`, 'Nombre', count]);
      rows.push([`Plan ${v}`, 'Revenu mensuel (CFA)', count * PLAN_PRICES[k]]);
    });
    signupEntries.forEach(([month, count]) => rows.push(['Inscriptions', month, count]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plateforme-apercu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      {/* Section header + export */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Vue d'ensemble de la plateforme</p>
          <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Revenus, abonnements et signaux d'attention</p>
        </div>
        <button onClick={exportCsv} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5">
          <Download size={14} /> Exporter
        </button>
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="MRR (revenu mensuel)" value={money(revenue.mrr)} sub="Boutiques actives" accent="var(--colorStatusSuccessForeground1)" icon={Wallet} />
        <Kpi label="ARR (annualisé)" value={money(revenue.arr)} sub="MRR × 12" accent="#7C3AED" icon={TrendingUp} />
        <Kpi label="Encaissé ce mois" value={money(revenue.revenueThisMonth)} sub="Paiements enregistrés" accent="var(--colorBrandForeground1)" icon={Receipt} />
        <Kpi label="Boutiques payantes" value={fmt(funnel.paying)} sub={`sur ${fmt(funnel.total)} au total`} accent="var(--colorStatusWarningForeground1)" icon={Building2} />
      </div>

      <PlanRequests />

      {/* Funnel */}
      <div className="fluent-card-filled p-5">
        <p className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Répartition des boutiques</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: funnel.total, color: 'var(--colorNeutralForeground1)' },
            { label: 'Payantes', value: funnel.paying, color: 'var(--colorStatusSuccessForeground1)' },
            { label: 'Essais', value: funnel.trials, color: 'var(--colorStatusWarningForeground1)' },
            { label: 'Suspendues', value: funnel.suspended, color: 'var(--colorStatusDangerForeground1)' },
            { label: 'Perdues', value: funnel.churned, color: 'var(--colorNeutralForeground3)' },
          ].map((f) => (
            <div key={f.label} className="rounded-[var(--radiusLarge)] p-3 text-center" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)', borderTop: `3px solid ${f.color}` }}>
              <p className="fui-title2 tabular-nums" style={{ color: f.color }}>{fmt(f.value)}</p>
              <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{f.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Signups */}
        <div className="fluent-card-filled p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Inscriptions (6 derniers mois)</p>
            {signupTrend != null && (
              <span className="inline-flex items-center gap-1 fui-caption1-strong" style={{ color: signupTrend >= 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
                {signupTrend >= 0 ? '↑' : '↓'} {Math.abs(signupTrend)}%
              </span>
            )}
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signupData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="sa-signups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F6CBD" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#0F6CBD" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Inscriptions']} labelFormatter={(l) => `Mois ${l}`} />
                <Area type="monotone" dataKey="count" stroke="#0F6CBD" strokeWidth={2.5} fill="url(#sa-signups)" dot={{ r: 2.5, fill: '#0F6CBD' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan distribution */}
        <div className="fluent-card-filled p-5">
          <p className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Répartition par plan</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                    {planData.map((d) => <Cell key={d.key} fill={PLAN_COLORS[d.key]} />)}
                  </Pie>
                  <RTooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="fui-title2 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(planTotal)}</span>
                <span className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>boutiques</span>
              </div>
            </div>
            <div className="w-full flex-1 space-y-2">
              {PLAN_OPTIONS.map(([k, v]) => {
                const count = planDist[k] || 0;
                const pct = Math.round((count / planTotal) * 100);
                return (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAN_COLORS[k] }} />
                    <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--colorNeutralForeground2)' }}>{v}</span>
                    <span className="tabular-nums" style={{ color: 'var(--colorNeutralForeground3)' }}>{money(count * PLAN_PRICES[k])}/m</span>
                    <span className="w-10 text-right tabular-nums font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>{count} <span className="font-normal" style={{ color: 'var(--colorNeutralForeground3)' }}>({pct}%)</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Growth & retention */}
      <div className="fluent-card-filled p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Croissance & rétention</p>
            <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Nouvelles boutiques contre boutiques suspendues (6 mois)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Taux d'attrition (mois)</p>
              <p className="fui-subtitle2 tabular-nums" style={{ color: churnRate > 5 ? 'var(--colorStatusDangerForeground1)' : 'var(--colorStatusSuccessForeground1)' }}>{churnRate}%</p>
            </div>
            <div className="text-right">
              <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Net (6 mois)</p>
              <p className="fui-subtitle2 tabular-nums" style={{ color: totalNew - totalLost >= 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>{totalNew - totalLost >= 0 ? '+' : ''}{fmt(totalNew - totalLost)}</p>
            </div>
          </div>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--colorNeutralForeground3)' }} axisLine={false} tickLine={false} />
              <RTooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--colorNeutralBackground2)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar dataKey="Nouvelles" fill="#107C10" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Perdues" fill="#D13438" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {totalLost === 0 && totalNew === 0 && (
          <p className="mt-2 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Pas encore de mouvement enregistré sur la période.</p>
        )}
      </div>

      {/* Attention queue */}
      <div className="fluent-card-filled p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} style={{ color: 'var(--colorStatusWarningForeground1)' }} />
          <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>À surveiller</p>
          {attentionTotal > 0 && <span className="ms-status-badge ms-status-warning">{attentionTotal}</span>}
        </div>
        {attentionTotal === 0 ? (
          <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>Rien à signaler — tout est en ordre. ✅</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <AttentionList title="Essais expirant (≤3j)" tone="warning" items={attention.trialsExpiring} render={(t) => `${t.name} — ${daysLeft(t.trialEndsAt)}j`} onClick={() => onJump('tenants')} />
            <AttentionList title="Paiements en retard" tone="danger" items={attention.paymentsOverdue} render={(t) => `${t.name} — ${money(t.amount)} dû le ${fmtDate(t.nextPaymentDue)}`} onClick={() => onJump('billing')} />
            <AttentionList title="Boutiques dormantes (>14j)" tone="neutral" items={attention.dormant} render={(t) => `${t.name} — actif ${relativeDays(t.lastActiveAt)}`} onClick={() => onJump('tenants')} />
            <AttentionList title="Proches de la limite (≥80%)" tone="warning" items={attention.nearLimit} render={(t) => `${t.name} — ${t.userCount}/${t.maxUsers} users, ${t.productCount}/${t.maxProducts} prod.`} onClick={() => onJump('tenants')} />
          </div>
        )}
      </div>
    </div>
  );
};

const AttentionList = ({ title, tone, items, render, onClick }) => (
  <div className="rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
    <div className="flex items-center justify-between mb-2">
      <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{title}</span>
      <span className={`ms-status-badge ms-status-${tone}`}>{items.length}</span>
    </div>
    {items.length === 0 ? (
      <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>—</p>
    ) : (
      <ul className="space-y-1">
        {items.slice(0, 5).map((t) => (
          <li key={t._id} className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground2)' }}>• {render(t)}</li>
        ))}
        {items.length > 5 && <li className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>+{items.length - 5} autres</li>}
      </ul>
    )}
  </div>
);

/* Aligned column template shared by header + rows (desktop) */
const COLS = 'grid-cols-[minmax(0,1fr)_116px_132px_64px_64px_132px]';

const usagePct = (used, max) => (max ? Math.min(100, Math.round((used / max) * 100)) : 0);

/* ─── TAB: Tenants (realigned) ────────────────────────── */
const FEATURE_OVERRIDE_OPTIONS = [
  { value: 'inherit', label: 'Hérité' },
  { value: 'on', label: 'Activé' },
  { value: 'off', label: 'Désactivé' },
];

// Per-shop feature overrides editor (super-admin): force a feature on/off for
// one boutique independently of its forfait.
const TenantFeatureOverrides = ({ tenant, onSaved }) => {
  const overridesKey = JSON.stringify(tenant.featureOverrides || {});
  const initial = useMemo(() => {
    const o = tenant.featureOverrides || {};
    const map = {};
    Object.keys(FEATURE_LABELS).forEach((k) => {
      map[k] = o[k] === true ? 'on' : o[k] === false ? 'off' : 'inherit';
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overridesKey]);

  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(initial); }, [initial]);

  const dirty = Object.keys(FEATURE_LABELS).some((k) => draft[k] !== initial[k]);

  const save = async () => {
    try {
      setSaving(true);
      const featureOverrides = {};
      Object.entries(draft).forEach(([k, v]) => {
        if (v === 'on') featureOverrides[k] = true;
        else if (v === 'off') featureOverrides[k] = false;
      });
      const { data } = await api.put(`/tenants/${tenant._id}`, { featureOverrides });
      onSaved?.(data.featureOverrides || featureOverrides);
      toast.success('Dérogations enregistrées.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground1)', border: '1px solid var(--colorNeutralStroke2)' }}>
      <p className="fui-subtitle2 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground1)' }}>
        <span aria-hidden>🧩</span> Dérogations de fonctionnalités
      </p>
      <p className="fui-caption2 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Forcer l'activation ou la désactivation pour cette boutique, indépendamment de son forfait.
      </p>
      <div className="mt-3 space-y-2">
        {Object.entries(FEATURE_LABELS).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="text-sm" style={{ color: 'var(--colorNeutralForeground2)' }}>{label}</span>
            <div className="inline-flex shrink-0 rounded-[var(--radiusMedium)] border p-0.5" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
              {FEATURE_OVERRIDE_OPTIONS.map((opt) => {
                const active = draft[k] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, [k]: opt.value }))}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${active ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--colorNeutralForeground3)] hover:bg-[var(--colorNeutralBackground2)]'}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={!dirty || saving} className="ms-button ms-button-primary ms-button-sm flex items-center gap-1 disabled:opacity-50">
          <Save size={13} /> {saving ? '...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

/* ─── Tenant detail drawer (config, limits, overrides, danger zone) ─── */
const TenantDetailDrawer = ({ tenant, onClose, onPatch, onStatus, onRequestDelete, onImpersonate, updating }) => {
  const [edit, setEdit] = useState(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [dial, setDial] = useState('');
  const [savingDial, setSavingDial] = useState(false);

  const tenantId = tenant?._id;
  useEffect(() => { setEdit(null); setDial(tenant?.dialCode || ''); }, [tenantId, tenant?.dialCode]);

  if (!tenant) return null;
  const t = tenant;
  const isUpdating = updating === t._id;

  const saveLimits = async () => {
    if (!edit) return;
    try {
      setSavingLimits(true);
      const { data } = await api.put(`/tenants/${t._id}`, edit);
      onPatch(t._id, { maxUsers: data.maxUsers, maxProducts: data.maxProducts, monthlyPrice: data.monthlyPrice });
      setEdit(null);
    } catch (err) { alert(err.response?.data?.message || 'Erreur.'); }
    finally { setSavingLimits(false); }
  };

  const saveDial = async () => {
    try {
      setSavingDial(true);
      const { data } = await api.put(`/tenants/${t._id}`, { dialCode: dial });
      onPatch(t._id, { dialCode: data.dialCode });
      setDial(data.dialCode || '');
    } catch (err) { alert(err.response?.data?.message || 'Erreur.'); }
    finally { setSavingDial(false); }
  };

  return (
    <RightDetailPanel
      isOpen={Boolean(tenant)}
      onClose={onClose}
      title={t.name}
      subtitle={`${t.code} · ${t.ownerEmail}`}
      footer={
        <button onClick={() => onImpersonate(t._id)} disabled={isUpdating} className="ms-button ms-button-secondary ms-button-md flex items-center gap-1.5 disabled:opacity-60">
          <LogIn size={14} /> Superviser la boutique
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={t.status} />
          <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Plan : <strong style={{ color: 'var(--colorNeutralForeground1)' }}>{PLAN_LABELS[t.plan]}</strong></span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Propriétaire', value: t.ownerName },
            { label: 'Téléphone', value: t.ownerPhone || '—' },
            { label: 'Créée le', value: fmtDate(t.createdAt) },
            { label: 'Dernière activité', value: relativeDays(t.stats?.lastActiveAt) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
              <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
              <p className="fui-body1-strong mt-0.5 truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Editable limits */}
        <div className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="fui-subtitle2 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground1)' }}><BadgeDollarSign size={15} /> Limites & tarif</p>
            {!edit
              ? <button onClick={() => setEdit({ maxUsers: t.maxUsers, maxProducts: t.maxProducts, monthlyPrice: t.monthlyPrice })} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1"><Pencil size={13} /> Modifier</button>
              : (
                <div className="flex gap-2">
                  <button onClick={() => setEdit(null)} className="ms-button ms-button-secondary ms-button-sm">Annuler</button>
                  <button onClick={saveLimits} disabled={savingLimits} className="ms-button ms-button-primary ms-button-sm flex items-center gap-1"><Save size={13} /> {savingLimits ? '...' : 'Enregistrer'}</button>
                </div>
              )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <LimitField label="Max utilisateurs" used={t.stats?.userCount} editing={Boolean(edit)} value={edit ? edit.maxUsers : t.maxUsers} onChange={(v) => setEdit((p) => ({ ...p, maxUsers: v }))} />
            <LimitField label="Max produits" used={t.stats?.productCount} editing={Boolean(edit)} value={edit ? edit.maxProducts : t.maxProducts} onChange={(v) => setEdit((p) => ({ ...p, maxProducts: v }))} />
            <LimitField label="Prix mensuel (CFA)" editing={Boolean(edit)} value={edit ? edit.monthlyPrice : t.monthlyPrice} onChange={(v) => setEdit((p) => ({ ...p, monthlyPrice: v }))} />
          </div>
        </div>

        {/* WhatsApp dial code */}
        <div className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
          <p className="fui-subtitle2 flex items-center gap-1.5 mb-2" style={{ color: 'var(--colorNeutralForeground1)' }}><span aria-hidden>💬</span> Indicatif pays (WhatsApp)</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" value={dial} onChange={(e) => setDial(e.target.value)} placeholder="+242" className="form-control text-sm" style={{ maxWidth: 140 }} />
            <button onClick={saveDial} disabled={savingDial || dial === (t.dialCode || '')} className="ms-button ms-button-primary ms-button-sm flex items-center gap-1 disabled:opacity-50"><Save size={13} /> {savingDial ? '...' : 'Enregistrer'}</button>
          </div>
          <p className="fui-caption2 mt-2" style={{ color: 'var(--colorNeutralForeground3)' }}>Préfixe ajouté aux numéros pour les rappels WhatsApp clients (ex. +242 pour le Congo).</p>
        </div>

        {/* Feature overrides */}
        <TenantFeatureOverrides tenant={t} onSaved={(fo) => onPatch(t._id, { featureOverrides: fo })} />

        {/* Danger zone */}
        <div className="rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--colorStatusDangerBackground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>
          <p className="fui-caption1 mb-2" style={{ color: 'var(--colorStatusDangerForeground1)' }}>Actions sensibles</p>
          <div className="flex flex-wrap gap-2">
            {t.status !== 'suspended'
              ? <button onClick={() => onStatus(t._id, 'suspended')} disabled={isUpdating} className="ms-button ms-button-danger ms-button-sm">Suspendre</button>
              : <button onClick={() => onStatus(t._id, 'active')} disabled={isUpdating} className="ms-button ms-button-secondary ms-button-sm">Réactiver</button>}
            <button onClick={() => onRequestDelete(t._id)} disabled={isUpdating} className="ms-button ms-button-danger ms-button-sm flex items-center gap-1"><Trash2 size={13} /> Supprimer</button>
          </div>
        </div>
      </div>
    </RightDetailPanel>
  );
};

const TenantsTab = ({ tenants, loading, updating, onStatus, onPlan, onImpersonate, setTenants }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailId, setDetailId] = useState(null); // tenant open in the config drawer
  const [statsTenant, setStatsTenant] = useState(null); // tenant whose stats profile is open
  const [selected, setSelected] = useState(() => new Set()); // bulk selection
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPlan, setBulkPlan] = useState('');
  const [confirmPlan, setConfirmPlan] = useState(false);

  const patch = (id, p) => setTenants((prev) => prev.map((t) => (t._id === id ? { ...t, ...p } : t)));
  const detailTenant = detailId ? tenants.find((t) => t._id === detailId) || null : null;

  const filtered = tenants.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPlan && t.plan !== filterPlan) return false;
    if (search) {
      const q = search.toLowerCase();
      return [t.name, t.ownerEmail, t.code].some((v) => String(v || '').toLowerCase().includes(q));
    }
    return true;
  });

  const hasFilters = Boolean(search || filterStatus || filterPlan);

  // Bulk selection (acts on the filtered set).
  const toggleSelect = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t._id));
  const toggleSelectAll = () => setSelected(() => (allSelected ? new Set() : new Set(filtered.map((t) => t._id))));
  // Drop selections that are no longer visible when filters change.
  useEffect(() => {
    setSelected((prev) => { const visible = new Set(filtered.map((t) => t._id)); const n = new Set([...prev].filter((id) => visible.has(id))); return n.size === prev.size ? prev : n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterStatus, filterPlan, tenants]);

  const bulkUpdate = async (status) => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      setBulkBusy(true);
      await Promise.all(ids.map((id) => api.put(`/tenants/${id}`, { status }).then(({ data }) => patch(id, { status: data.status }))));
      setSelected(new Set());
    } catch (err) { alert(err.response?.data?.message || "Erreur lors de l'action groupée."); }
    finally { setBulkBusy(false); }
  };

  const bulkUpdatePlan = async () => {
    const ids = [...selected];
    if (!ids.length || !bulkPlan) return;
    try {
      setBulkBusy(true);
      await Promise.all(ids.map((id) => api.put(`/tenants/${id}`, { plan: bulkPlan }).then(({ data }) =>
        patch(id, { plan: data.plan, monthlyPrice: data.monthlyPrice, maxUsers: data.maxUsers, maxProducts: data.maxProducts })
      )));
      setSelected(new Set());
      setBulkPlan('');
      setConfirmPlan(false);
    } catch (err) { alert(err.response?.data?.message || 'Erreur lors du changement de plan.'); }
    finally { setBulkBusy(false); }
  };
  const summary = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'active').length,
    trials: tenants.filter((t) => t.status === 'trial').length,
    suspended: tenants.filter((t) => t.status === 'suspended' || t.status === 'expired').length,
    mrr: tenants.filter((t) => t.status === 'active').reduce((s, t) => s + (Number(t.monthlyPrice) || 0), 0),
  }), [tenants]);

  const handleDelete = async () => {
    try {
      await api.delete(`/tenants/${deleteTarget}`);
      setTenants((prev) => prev.filter((t) => t._id !== deleteTarget));
      if (detailId === deleteTarget) setDetailId(null);
      setDeleteTarget(null);
    }
    catch (err) { alert(err.response?.data?.message || 'Erreur.'); }
  };
  const handleExportCsv = () => {
    fetch(`${api.defaults.baseURL}/tenants/export/csv`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.blob()).then((blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `boutiques-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href); })
      .catch(() => alert('Erreur export.'));
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Boutiques" value={fmt(summary.total)} sub="Au total" accent="var(--colorBrandForeground1)" icon={Building2} />
        <Kpi label="Actives" value={fmt(summary.active)} sub={`${money(summary.mrr)} MRR`} accent="var(--colorStatusSuccessForeground1)" icon={CheckCircle2} />
        <Kpi label="Essais" value={fmt(summary.trials)} sub="En période d'essai" accent="var(--colorStatusWarningForeground1)" icon={Clock} />
        <Kpi label="Suspendues / expirées" value={fmt(summary.suspended)} sub="Inactives" accent={summary.suspended ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground3)'} icon={XCircle} />
      </div>

      {/* Filters */}
      <div className="ms-command-bar flex-wrap gap-y-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
          <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="ms-search-box" style={{ paddingLeft: 32 }} />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-control w-auto text-sm min-h-[36px]">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_META).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className="form-control w-auto text-sm min-h-[36px]">
          <option value="">Tous plans</option>
          {PLAN_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={handleExportCsv} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"><Download size={14} /> CSV</button>
        <button onClick={() => setShowCreate(true)} className="ms-button ms-button-primary ms-button-sm flex items-center gap-1.5"><Plus size={14} /> Nouvelle</button>
      </div>

      {/* Result count */}
      {!loading && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
            <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(filtered.length)}</span> boutique{filtered.length > 1 ? 's' : ''}{hasFilters ? ' (filtrées)' : ''}
          </p>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPlan(''); }} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5">
              <RotateCcw size={13} /> Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--ms-blue-soft)', border: '1px solid var(--ms-blue)' }}>
          <span className="fui-body1-strong" style={{ color: 'var(--colorBrandForeground1)' }}>{selected.size} boutique{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select value={bulkPlan} onChange={(e) => setBulkPlan(e.target.value)} disabled={bulkBusy} className="form-control w-auto text-sm min-h-[34px]">
              <option value="">Changer le plan…</option>
              {PLAN_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => setConfirmPlan(true)} disabled={bulkBusy || !bulkPlan} className="ms-button ms-button-secondary ms-button-sm disabled:opacity-60">Appliquer</button>
            <span aria-hidden style={{ color: 'var(--ms-blue)', opacity: 0.4 }}>|</span>
            <button onClick={() => bulkUpdate('active')} disabled={bulkBusy} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1 disabled:opacity-60"><CheckCircle2 size={13} /> Réactiver</button>
            <button onClick={() => bulkUpdate('suspended')} disabled={bulkBusy} className="ms-button ms-button-danger ms-button-sm flex items-center gap-1 disabled:opacity-60"><XCircle size={13} /> Suspendre</button>
            <button onClick={() => setSelected(new Set())} disabled={bulkBusy} className="ms-button ms-button-secondary ms-button-sm">Annuler</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSkeleton rows={6} /> : filtered.length === 0 ? <EmptyState title="Aucune boutique correspondante" description={hasFilters ? 'Aucune boutique ne correspond à vos filtres.' : undefined} /> : (
        <div className="fluent-card-filled overflow-hidden">
          {/* Desktop column headers — aligned to COLS template */}
          <div className={`hidden lg:grid ${COLS} gap-3 px-4 py-2.5 items-center fui-caption1-strong uppercase border-b`} style={{ background: 'var(--colorNeutralBackground2)', borderColor: 'var(--colorNeutralStroke2)', color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>
            <span className="flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="form-check" title="Tout sélectionner" /> Boutique</span>
            <span>Statut</span>
            <span>Plan</span>
            <span className="flex items-center justify-center gap-1" title="Utilisateurs"><Users size={12} /></span>
            <span className="flex items-center justify-center gap-1" title="Produits"><Package size={12} /></span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
            {filtered.map((t) => {
              const isUpdating = updating === t._id;
              const trialDays = t.status === 'trial' ? daysLeft(t.trialEndsAt) : null;

              return (
                <div key={t._id}>
                  {/* ── Desktop row ── */}
                  <div className={`hidden lg:grid ${COLS} gap-3 px-4 py-3 items-center hover:bg-[var(--colorNeutralBackground2)] transition-colors`}>
                    {/* Boutique */}
                    <div className="flex items-start gap-2 min-w-0">
                      <input type="checkbox" checked={selected.has(t._id)} onChange={() => toggleSelect(t._id)} className="form-check mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{t.name}</span>
                          <span className="fui-caption2 shrink-0 rounded px-1.5 py-0.5" style={{ background: 'var(--colorNeutralBackground3)', color: 'var(--colorNeutralForeground3)' }}>{t.code}</span>
                        </div>
                        <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>{t.ownerEmail}</p>
                        {trialDays !== null && <p className="fui-caption2" style={{ color: trialDays <= 3 ? 'var(--colorStatusDangerForeground1)' : 'var(--colorStatusWarningForeground1)' }}>{trialDays > 0 ? `${trialDays}j restants` : 'Expiré'}</p>}
                      </div>
                    </div>
                    {/* Statut */}
                    <div><StatusBadge status={t.status} /></div>
                    {/* Plan */}
                    <div>
                      <select value={t.plan} onChange={(ev) => onPlan(t._id, ev.target.value)} disabled={isUpdating} className="form-control text-sm py-1 min-h-[32px] w-full">
                        {PLAN_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    {/* Users with usage */}
                    <div className="text-center">
                      <span className="fui-body1-strong tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(t.stats?.userCount)}</span>
                      <span className="fui-caption2 block" style={{ color: 'var(--colorNeutralForeground3)' }}>/{fmt(t.maxUsers)}</span>
                    </div>
                    {/* Products with usage */}
                    <div className="text-center">
                      <span className="fui-body1-strong tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(t.stats?.productCount)}</span>
                      <span className="fui-caption2 block" style={{ color: 'var(--colorNeutralForeground3)' }}>/{fmt(t.maxProducts)}</span>
                    </div>
                    {/* Actions — compact, fixed width, no wrap */}
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setStatsTenant(t)} className="ms-icon-button" title="Profil statistique"><BarChart3 size={14} /></button>
                      <button onClick={() => onImpersonate(t._id)} disabled={isUpdating} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1" title="Superviser"><LogIn size={13} /> Accéder</button>
                      <button onClick={() => setDetailId(t._id)} className="ms-icon-button" title="Configurer la boutique"><Pencil size={14} /></button>
                    </div>
                  </div>

                  {/* ── Mobile card ── */}
                  <div className="lg:hidden p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <input type="checkbox" checked={selected.has(t._id)} onChange={() => toggleSelect(t._id)} className="form-check mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{t.name}</span>
                            <span className="fui-caption2 shrink-0 rounded px-1.5 py-0.5" style={{ background: 'var(--colorNeutralBackground3)', color: 'var(--colorNeutralForeground3)' }}>{t.code}</span>
                          </div>
                          <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>{t.ownerEmail}</p>
                        </div>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-[var(--radiusMedium)] py-1.5" style={{ background: 'var(--colorNeutralBackground2)' }}>
                        <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Users</p>
                        <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(t.stats?.userCount)}/{fmt(t.maxUsers)}</p>
                      </div>
                      <div className="rounded-[var(--radiusMedium)] py-1.5" style={{ background: 'var(--colorNeutralBackground2)' }}>
                        <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Produits</p>
                        <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(t.stats?.productCount)}/{fmt(t.maxProducts)}</p>
                      </div>
                      <div className="rounded-[var(--radiusMedium)] py-1.5" style={{ background: 'var(--colorNeutralBackground2)' }}>
                        <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>Prix</p>
                        <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(t.monthlyPrice)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={t.plan} onChange={(ev) => onPlan(t._id, ev.target.value)} disabled={isUpdating} className="form-control text-sm py-1 min-h-[34px] flex-1">
                        {PLAN_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button onClick={() => setStatsTenant(t)} className="ms-icon-button" title="Statistiques"><BarChart3 size={14} /></button>
                      <button onClick={() => onImpersonate(t._id)} disabled={isUpdating} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1"><LogIn size={13} /> Accéder</button>
                      <button onClick={() => setDetailId(t._id)} className="ms-icon-button" title="Configurer"><Pencil size={14} /></button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      <TenantDetailDrawer
        tenant={detailTenant}
        onClose={() => setDetailId(null)}
        onPatch={patch}
        onStatus={onStatus}
        onRequestDelete={(id) => setDeleteTarget(id)}
        onImpersonate={onImpersonate}
        updating={updating}
      />
      <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={(nt) => setTenants((prev) => [{ ...nt, stats: { userCount: 1, productCount: 0, saleCount: 0 } }, ...prev])} />
      <ConfirmDialog open={Boolean(deleteTarget)} title="Supprimer cette boutique ?" description="Toutes ses données seront définitivement supprimées. Action irréversible." confirmLabel="Supprimer définitivement" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog
        open={confirmPlan}
        title="Changer le plan en lot ?"
        description={`${selected.size} boutique${selected.size > 1 ? 's' : ''} passeront au plan « ${PLAN_LABELS[bulkPlan] || bulkPlan} ». Leur tarif et leurs limites seront ajustés au catalogue de ce forfait.`}
        confirmLabel="Changer le plan"
        onConfirm={bulkUpdatePlan}
        onCancel={() => setConfirmPlan(false)}
      />
      {statsTenant && <TenantStatsModal tenant={statsTenant} onClose={() => setStatsTenant(null)} />}
    </div>
  );
};

/* Limit field — read-only display or editable input */
const LimitField = ({ label, used, editing, value, onChange }) => (
  <div>
    <p className="fui-caption1 mb-1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
    {editing ? (
      <input type="number" min="0" value={value ?? ''} onChange={(ev) => onChange(Number(ev.target.value))} className="form-control text-sm" />
    ) : (
      <p className="fui-subtitle2 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>
        {fmt(value)}
        {used !== undefined && <span className="fui-caption1 ml-1" style={{ color: usagePct(used, value) >= 80 ? 'var(--colorStatusWarningForeground1)' : 'var(--colorNeutralForeground3)' }}>· {usagePct(used, value)}% utilisé</span>}
      </p>
    )}
  </div>
);

/* ─── TAB: Billing ────────────────────────────────────── */
const BillingTab = ({ tenants, loading, onReload }) => {
  const [payTarget, setPayTarget] = useState(null);
  const now = Date.now();

  const totalMRR = tenants.filter((t) => t.status === 'active').reduce((s, t) => s + (t.monthlyPrice || 0), 0);
  const overdue = tenants.filter((t) => t.status === 'active' && t.nextPaymentDue && new Date(t.nextPaymentDue) < now);

  // Aging of overdue receivables (days past the due date).
  const aging = { d30: { count: 0, amount: 0 }, d60: { count: 0, amount: 0 }, d60plus: { count: 0, amount: 0 } };
  overdue.forEach((t) => {
    const days = Math.floor((now - new Date(t.nextPaymentDue)) / 86400000);
    const amt = Number(t.monthlyPrice) || 0;
    const bucket = days <= 30 ? aging.d30 : days <= 60 ? aging.d60 : aging.d60plus;
    bucket.count += 1; bucket.amount += amt;
  });
  const agingTotal = aging.d30.amount + aging.d60.amount + aging.d60plus.amount;

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi label="MRR" value={money(totalMRR)} sub="Revenu mensuel récurrent" accent="var(--colorStatusSuccessForeground1)" icon={Wallet} />
        <Kpi label="Paiements en retard" value={fmt(overdue.length)} sub="Boutiques actives échues" accent={overdue.length ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground3)'} icon={AlertCircle} />
        <Kpi label="Boutiques facturables" value={fmt(tenants.filter((t) => t.monthlyPrice > 0).length)} accent="var(--colorBrandForeground1)" icon={Receipt} />
      </div>

      {/* Aging of overdue receivables */}
      {overdue.length > 0 && (
        <div className="fluent-card-filled p-4">
          <p className="fui-subtitle2 mb-3 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground1)' }}>
            <AlertCircle size={15} style={{ color: 'var(--colorStatusDangerForeground1)' }} /> Encours en retard — <span className="tabular-nums">{money(agingTotal)}</span>
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '≤ 30 jours', ...aging.d30, color: 'var(--colorStatusWarningForeground1)' },
              { label: '31 – 60 jours', ...aging.d60, color: '#C2410C' },
              { label: '> 60 jours', ...aging.d60plus, color: 'var(--colorStatusDangerForeground1)' },
            ].map((b) => (
              <div key={b.label} className="rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--colorNeutralBackground2)', borderLeft: `3px solid ${b.color}` }}>
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{b.label}</p>
                <p className="fui-subtitle2 tabular-nums" style={{ color: b.color }}>{money(b.amount)}</p>
                <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{b.count} boutique{b.count > 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fluent-card-filled overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2.5 fui-caption1-strong uppercase border-b" style={{ background: 'var(--colorNeutralBackground2)', borderColor: 'var(--colorNeutralStroke2)', color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>
          <span>Boutique</span><span>Plan</span><span>Prix/mois</span><span>Prochaine échéance</span><span>Dernier paiement</span><span>Action</span>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          {tenants.map((t) => {
            const isOverdue = t.nextPaymentDue && new Date(t.nextPaymentDue) < now && t.status === 'active';
            return (
              <div key={t._id} className="grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3 items-center hover:bg-[var(--colorNeutralBackground2)]">
                <div className="min-w-0">
                  <span className="fui-body1-strong truncate block" style={{ color: 'var(--colorNeutralForeground1)' }}>{t.name}</span>
                  <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{t.ownerEmail}</span>
                </div>
                <span className="fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>{PLAN_LABELS[t.plan]}</span>
                <span className="fui-body1-strong tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{money(t.monthlyPrice)}</span>
                <span className="fui-caption1" style={{ color: isOverdue ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground3)' }}>
                  {isOverdue && '⚠ '}{fmtDate(t.nextPaymentDue)}
                </span>
                <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{fmtDate(t.lastPaymentAt)}</span>
                <button onClick={() => setPayTarget(t)} className="ms-button ms-button-primary ms-button-sm flex items-center gap-1"><CreditCard size={13} /> Paiement</button>
              </div>
            );
          })}
        </div>
      </div>

      {payTarget && <PaymentModal tenant={payTarget} onClose={() => setPayTarget(null)} onRecorded={() => onReload()} />}
    </div>
  );
};

/* ─── TAB: Audit ──────────────────────────────────────── */
const AuditTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get('/tenants/audit?limit=200'); setLogs(data); }
      catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <LoadingSkeleton rows={8} />;
  if (logs.length === 0) return <EmptyState title="Journal vide" description="Les actions super-admin apparaîtront ici." />;

  const filtered = filter ? logs.filter((l) => l.action === filter) : logs;

  return (
    <div className="space-y-3">
      <div className="ms-command-bar flex-wrap gap-y-2">
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
          <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(filtered.length)}</span> entrée{filtered.length > 1 ? 's' : ''}
        </p>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="form-control w-auto text-sm min-h-[36px] ml-auto">
          <option value="">Toutes les actions</option>
          {Object.entries(AUDIT_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>
      <div className="fluent-card-filled overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucune action de ce type.</div>
        ) : (
        <div className="divide-y" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          {filtered.map((log) => {
          const meta = AUDIT_META[log.action] || { label: log.action, tone: 'neutral', icon: Activity };
          const Icon = meta.icon;
          return (
            <div key={log._id} className="flex items-start gap-3 px-4 py-3">
              <span className="ms-kpi-icon shrink-0" style={{ width: 32, height: 32 }}><Icon size={15} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`ms-status-badge ms-status-${meta.tone}`}>{meta.label}</span>
                  {log.targetTenantName && <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{log.targetTenantName}</span>}
                </div>
                <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Par {log.actorName || 'système'}
                  {log.meta?.from && ` · ${log.meta.from} → ${log.meta.to}`}
                  {log.meta?.amount && ` · ${money(log.meta.amount)}`}
                  {log.meta?.asUser && ` · ${log.meta.asUser}`}
                  {' · '}{fmtDateTime(log.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        </div>
        )}
      </div>
    </div>
  );
};

/* ─── TAB: Plans (editable catalog) ───────────────────── */
const PLAN_KEYS = ['trial', 'basic', 'pro', 'enterprise'];

const PlansTab = () => {
  const [plans, setPlans] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/tenants/plans');
        setPlans(data);
        setDraft(JSON.parse(JSON.stringify(data)));
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const dirty = plans && draft && JSON.stringify(plans) !== JSON.stringify(draft);

  const setField = (key, field, value) => setDraft((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));

  const toggleFeature = (key, featureKey) => setDraft((p) => {
    const current = Array.isArray(p[key]?.features) ? p[key].features : [];
    const next = current.includes(featureKey)
      ? current.filter((f) => f !== featureKey)
      : [...current, featureKey];
    return { ...p, [key]: { ...p[key], features: next } };
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data } = await api.put('/tenants/plans', { plans: draft });
      setPlans(data);
      setDraft(JSON.parse(JSON.stringify(data)));
      setSavedAt(Date.now());
    } catch (err) { alert(err.response?.data?.message || 'Erreur.'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSkeleton rows={5} />;
  if (!draft) return <EmptyState title="Forfaits indisponibles" />;

  return (
    <div className="space-y-3">
      <div className="ms-command-bar flex-wrap gap-y-2">
        <div>
          <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Catalogue des forfaits</p>
          <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Tarifs et limites appliqués aux nouvelles boutiques et aux changements de plan.</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {savedAt && !dirty && <span className="fui-caption1" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>✓ Enregistré</span>}
          <button onClick={handleSave} disabled={!dirty || saving} className="ms-button ms-button-primary ms-button-sm flex items-center gap-1.5">
            <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer les forfaits'}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {PLAN_KEYS.map((key) => {
          const p = draft[key] || {};
          const isTrial = key === 'trial';
          return (
            <div key={key} className="fluent-card-filled p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="ms-status-badge ms-status-neutral">{PLAN_LABELS[key]}</span>
                {isTrial && <span className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>par défaut</span>}
              </div>

              <label className="block">
                <span className="form-label block mb-1">Nom affiché</span>
                <input type="text" value={p.label || ''} onChange={(e) => setField(key, 'label', e.target.value)} className="form-control text-sm" placeholder={PLAN_LABELS[key]} />
              </label>

              <label className="block">
                <span className="form-label block mb-1">Prix / mois (CFA)</span>
                <input type="number" min="0" value={p.price ?? 0} onChange={(e) => setField(key, 'price', Number(e.target.value))} className="form-control text-sm" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="form-label block mb-1">Max users</span>
                  <input type="number" min="1" value={p.maxUsers ?? 1} onChange={(e) => setField(key, 'maxUsers', Number(e.target.value))} className="form-control text-sm" />
                </label>
                <label className="block">
                  <span className="form-label block mb-1">Max produits</span>
                  <input type="number" min="1" value={p.maxProducts ?? 1} onChange={(e) => setField(key, 'maxProducts', Number(e.target.value))} className="form-control text-sm" />
                </label>
              </div>

              <div>
                <span className="form-label block mb-1.5">Fonctionnalités incluses</span>
                <div className="space-y-1.5">
                  {Object.entries(FEATURE_LABELS).map(([fKey, fLabel]) => {
                    const checked = Array.isArray(p.features) && p.features.includes(fKey);
                    return (
                      <label key={fKey} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--colorNeutralForeground2)' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFeature(key, fKey)}
                          className="form-check"
                        />
                        <span>{fLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[var(--radiusLarge)] p-2.5 text-center" style={{ background: 'var(--colorNeutralBackground2)' }}>
                <span className="fui-subtitle1" style={{ color: 'var(--colorBrandForeground1)' }}>{money(p.price)}</span>
                <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}> /mois</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Le prix et les limites changent au prochain changement de plan d'une boutique (ou manuellement depuis l'onglet Boutiques).
        Les <strong>fonctionnalités</strong>, elles, s'appliquent immédiatement à toutes les boutiques du forfait concerné.
      </p>
    </div>
  );
};

/* ─── Per-shop statistics profile modal ───────────────── */
const SALE_STATUS_LABELS = {
  completed: 'Payées', partially_paid: 'Partielles', pending: 'En attente', cancelled: 'Annulées',
};

const TenantStatsModal = ({ tenant, onClose }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/tenants/${tenant._id}/stats`);
        if (active) setStats(data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Erreur de chargement.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [tenant._id]);

  const maxTrend = stats ? Math.max(1, ...stats.trend.map((t) => t.revenue)) : 1;
  const growthUp = stats && stats.sales.growthPct >= 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="fluent-card-filled w-full max-w-3xl my-4" style={{ boxShadow: 'var(--shadow28)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="ms-kpi-icon shrink-0" style={{ width: 34, height: 34 }}><BarChart3 size={16} /></span>
            <div className="min-w-0">
              <h2 className="fui-subtitle1 truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{tenant.name}</h2>
              <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Profil statistique · {tenant.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="ms-icon-button"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <LoadingSkeleton rows={6} />
          ) : error ? (
            <div className="rounded-[var(--radiusLarge)] px-4 py-3 fui-body1" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>{error}</div>
          ) : stats && (
            <>
              {/* Top KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatBox label="Revenu total" value={money(stats.sales.revenue)} icon={TrendingUp} tone="success" />
                <StatBox label="Bénéfice" value={money(stats.sales.profit)} icon={BadgeDollarSign} tone="brand" />
                <StatBox label="Résultat net" value={money(stats.netResult)} icon={Wallet} tone={stats.netResult >= 0 ? 'success' : 'danger'} sub="Bénéfice − dépenses" />
                <StatBox label="Reste à encaisser" value={money(stats.outstanding.amount)} icon={AlertCircle} tone={stats.outstanding.amount > 0 ? 'warning' : 'neutral'} sub={`${fmt(stats.outstanding.count)} vente(s)`} />
              </div>

              {/* Growth + month */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="fluent-card-filled p-4">
                  <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Ce mois-ci</p>
                  <p className="fui-title3 mt-1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{money(stats.sales.thisMonthRevenue)}</p>
                  <p className="fui-caption1 mt-1 flex items-center gap-1" style={{ color: growthUp ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
                    {growthUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {stats.sales.growthPct >= 0 ? '+' : ''}{stats.sales.growthPct}% vs mois dernier
                  </p>
                </div>
                <div className="fluent-card-filled p-4">
                  <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Ventes totales</p>
                  <p className="fui-title3 mt-1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(stats.sales.total)}</p>
                  <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>Panier moyen: {money(stats.sales.avgTicket)}</p>
                </div>
                <div className="fluent-card-filled p-4">
                  <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Dépenses</p>
                  <p className="fui-title3 mt-1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{money(stats.expenses.total)}</p>
                  <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>{fmt(stats.expenses.count)} enregistrée(s)</p>
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Produits', value: stats.counts.products, icon: Package },
                  { label: 'Clients', value: stats.counts.clients, icon: Users },
                  { label: 'Employés', value: stats.counts.employees, icon: Users },
                  { label: 'Utilisateurs', value: stats.counts.users, icon: Users },
                  { label: 'Actifs (7j)', value: stats.counts.activeUsers, icon: Activity },
                ].map((c) => (
                  <div key={c.label} className="rounded-[var(--radiusLarge)] p-3 text-center" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
                    <c.icon size={14} style={{ color: 'var(--colorNeutralForeground3)', margin: '0 auto' }} />
                    <p className="fui-subtitle2 mt-1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(c.value)}</p>
                    <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{c.label}</p>
                  </div>
                ))}
              </div>

              {/* Revenue trend */}
              <div className="fluent-card-filled p-4">
                <p className="fui-subtitle2 mb-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Revenu — 6 derniers mois</p>
                <div className="flex items-end justify-between gap-2 h-28">
                  {stats.trend.map((t) => (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-[var(--radiusMedium)]" style={{ height: `${(t.revenue / maxTrend) * 100}%`, minHeight: t.revenue ? 4 : 0, background: 'var(--colorBrandBackground)' }} />
                      <span className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{t.month.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {/* Stock */}
                <div className="fluent-card-filled p-4">
                  <p className="fui-subtitle2 mb-3 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground1)' }}><Boxes size={15} /> Stock</p>
                  <div className="space-y-2">
                    <Row label="Valeur du stock" value={money(stats.stock.value)} />
                    <Row label="Unités en stock" value={fmt(stats.stock.units)} />
                    <Row label="Stock bas" value={fmt(stats.stock.lowStock)} tone={stats.stock.lowStock > 0 ? 'warning' : null} />
                    <Row label="Ruptures" value={fmt(stats.stock.outOfStock)} tone={stats.stock.outOfStock > 0 ? 'danger' : null} />
                  </div>
                </div>

                {/* Sales status */}
                <div className="fluent-card-filled p-4">
                  <p className="fui-subtitle2 mb-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Statut des ventes</p>
                  <div className="space-y-2">
                    {Object.entries(SALE_STATUS_LABELS).map(([key, label]) => (
                      <Row key={key} label={label} value={fmt(stats.sales.statusBreakdown[key] || 0)} />
                    ))}
                    <Row label="Dernière vente" value={stats.sales.lastSaleDate ? fmtDate(stats.sales.lastSaleDate) : '—'} />
                  </div>
                </div>
              </div>

              {/* Top products */}
              <div className="fluent-card-filled p-4">
                <p className="fui-subtitle2 mb-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Top produits</p>
                {stats.topProducts.length === 0 ? (
                  <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucune vente sur la période.</p>
                ) : (
                  <div className="space-y-1.5">
                    {stats.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="fui-body1 truncate" style={{ color: 'var(--colorNeutralForeground2)' }}>
                          <span className="fui-caption1-strong mr-2" style={{ color: 'var(--colorNeutralForeground3)' }}>#{i + 1}</span>{p.name}
                        </span>
                        <span className="fui-body1-strong shrink-0 tabular-nums" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{money(p.revenue)} · {fmt(p.units)}u</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon: Icon, tone, sub }) => {
  const colors = {
    success: 'var(--colorStatusSuccessForeground1)',
    danger: 'var(--colorStatusDangerForeground1)',
    warning: 'var(--colorStatusWarningForeground1)',
    brand: 'var(--colorBrandForeground1)',
    neutral: 'var(--colorNeutralForeground1)',
  };
  return (
    <div className="fluent-card-filled p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={13} style={{ color: 'var(--colorNeutralForeground3)' }} />}
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
      </div>
      <p className="fui-subtitle1 tabular-nums" style={{ color: colors[tone] || colors.neutral }}>{value}</p>
      {sub && <p className="fui-caption2 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>{sub}</p>}
    </div>
  );
};

const Row = ({ label, value, tone }) => {
  const colors = { warning: 'var(--colorStatusWarningForeground1)', danger: 'var(--colorStatusDangerForeground1)' };
  return (
    <div className="flex items-center justify-between">
      <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</span>
      <span className="fui-body1-strong tabular-nums" style={{ color: colors[tone] || 'var(--colorNeutralForeground1)' }}>{value}</span>
    </div>
  );
};

export default SuperAdmin;
