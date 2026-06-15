import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Send, ArrowLeft, Lightbulb, AlertTriangle, HelpCircle, Tag, CheckCircle2,
} from 'lucide-react';
import { PageHeader, Workspace, EmptyState, LoadingSkeleton } from '../components/business';

const CATEGORIES = [
  { key: 'suggestion', label: 'Suggestion', icon: Lightbulb },
  { key: 'reclamation', label: 'Réclamation', icon: AlertTriangle },
  { key: 'question', label: 'Question', icon: HelpCircle },
  { key: 'autre', label: 'Autre', icon: Tag },
];
const catMeta = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[2];

const fmtWhen = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

const StatusChip = ({ status }) => (
  <span className={`ms-status-badge ${status === 'resolved' ? 'ms-status-success' : 'ms-status-warning'}`}>
    {status === 'resolved' ? 'Résolu' : 'Ouvert'}
  </span>
);

/* ─── Liste + création ─────────────────────────────────── */
const TicketList = ({ tickets, loading, onOpen, onNew }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>
        Échangez avec le support : suggestions, réclamations, questions.
      </p>
      <button type="button" onClick={onNew} className="ms-button ms-button-primary ms-button-md shrink-0">
        <Plus size={16} /> Nouveau message
      </button>
    </div>

    {loading ? (
      <LoadingSkeleton rows={4} />
    ) : tickets.length === 0 ? (
      <EmptyState
        title="Aucun message"
        description="Vous n'avez pas encore contacté le support. Cliquez sur « Nouveau message » pour commencer."
      />
    ) : (
      <div className="space-y-2">
        {tickets.map((t) => {
          const Cm = catMeta(t.category);
          const CatIcon = Cm.icon;
          return (
            <button
              key={t._id}
              type="button"
              onClick={() => onOpen(t._id)}
              className="fluent-card-filled flex w-full items-center gap-3 p-4 text-left transition hover:brightness-[0.98]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                <CatIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{t.subject}</p>
                  {t.unreadForShop > 0 && (
                    <span className="shrink-0 rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--colorStatusDangerForeground1)' }}>
                      {t.unreadForShop}
                    </span>
                  )}
                </div>
                <p className="fui-caption1 mt-0.5 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {Cm.label} · {t.lastMessage ? `${t.lastMessage.sender === 'support' ? 'Support : ' : ''}${t.lastMessage.body}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusChip status={t.status} />
                <span className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{fmtWhen(t.lastMessageAt)}</span>
              </div>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

/* ─── Formulaire de création ───────────────────────────── */
const NewTicket = ({ onCancel, onCreated }) => {
  const [category, setCategory] = useState('question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { toast.error('Sujet et message requis.'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/support', { category, subject: subject.trim(), message: message.trim() });
      toast.success('Message envoyé au support.');
      onCreated(data._id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi.");
    } finally { setSending(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onCancel} className="ms-button ms-button-secondary ms-button-sm">
        <ArrowLeft size={15} /> Retour
      </button>
      <div className="fluent-card-filled space-y-4 p-4 sm:p-6">
        <div>
          <label className="form-label mb-1.5 block">Catégorie</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              const CatIcon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className="flex items-center gap-2 rounded-[var(--radiusMedium)] px-3 py-2 text-sm font-medium transition"
                  style={{
                    border: `1.5px solid ${active ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralStroke2)'}`,
                    background: active ? 'var(--ms-blue-soft)' : 'var(--colorNeutralBackground1)',
                    color: active ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground2)',
                  }}
                >
                  <CatIcon size={15} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="form-label mb-1 block">Sujet</label>
          <input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Résumé en quelques mots" />
        </div>
        <div>
          <label className="form-label mb-1 block">Message</label>
          <textarea className="form-control" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} placeholder="Décrivez votre demande…" />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={sending} className="ms-button ms-button-primary ms-button-md disabled:opacity-60">
            <Send size={16} /> {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </form>
  );
};

/* ─── Fil de discussion ────────────────────────────────── */
const TicketThread = ({ id, onBack, onChanged }) => {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/support/${id}`);
      setTicket(data);
    } catch {
      toast.error('Message introuvable.');
      onBack();
    } finally { setLoading(false); }
  }, [id, onBack]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/support/${id}/reply`, { message: reply.trim() });
      setTicket(data);
      setReply('');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi.");
    } finally { setSending(false); }
  };

  if (loading || !ticket) return <LoadingSkeleton rows={5} />;
  const Cm = catMeta(ticket.category);
  const CatIcon = Cm.icon;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="ms-button ms-button-secondary ms-button-sm">
        <ArrowLeft size={15} /> Tous les messages
      </button>

      <div className="fluent-card-filled p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <CatIcon size={16} style={{ color: 'var(--colorBrandForeground1)' }} />
          <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>{ticket.subject}</h2>
          <StatusChip status={ticket.status} />
        </div>
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{Cm.label}</p>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m, i) => {
          const mine = m.sender === 'shop';
          return (
            <div key={m._id || i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] rounded-[var(--radiusLarge)] px-3.5 py-2.5"
                style={{
                  background: mine ? 'var(--ms-blue-soft)' : 'var(--colorNeutralBackground3)',
                  border: '1px solid var(--colorNeutralStroke2)',
                }}
              >
                <p className="fui-caption2 mb-0.5 font-semibold" style={{ color: mine ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground2)' }}>
                  {mine ? (m.authorName || 'Vous') : 'Support'}
                </p>
                <p className="fui-body1 whitespace-pre-wrap" style={{ color: 'var(--colorNeutralForeground1)' }}>{m.body}</p>
                <p className="fui-caption2 mt-1 text-right" style={{ color: 'var(--colorNeutralForeground3)' }}>{fmtWhen(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {ticket.status === 'resolved' && (
        <div className="flex items-center gap-2 rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}>
          <CheckCircle2 size={16} /> <span className="fui-caption1">Ce message a été marqué comme résolu par le support. Répondez pour le rouvrir.</span>
        </div>
      )}

      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          className="form-control flex-1"
          rows={2}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={5000}
          placeholder="Écrire une réponse…"
        />
        <button type="submit" disabled={sending || !reply.trim()} className="ms-button ms-button-primary ms-button-md shrink-0 disabled:opacity-60">
          <Send size={16} /> Envoyer
        </button>
      </form>
    </div>
  );
};

/* ─── Page ─────────────────────────────────────────────── */
const Support = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ mode: 'list', id: null }); // list | new | thread

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/support');
      setTickets(data || []);
    } catch {
      setTickets([]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Support"
        title="Assistance"
        description="Contactez l'équipe HD Gestion pour toute suggestion, réclamation ou question."
      />

      {view.mode === 'list' && (
        <TicketList
          tickets={tickets}
          loading={loading}
          onOpen={(id) => setView({ mode: 'thread', id })}
          onNew={() => setView({ mode: 'new', id: null })}
        />
      )}
      {view.mode === 'new' && (
        <NewTicket
          onCancel={() => setView({ mode: 'list', id: null })}
          onCreated={(id) => { fetchTickets(); setView({ mode: 'thread', id }); }}
        />
      )}
      {view.mode === 'thread' && (
        <TicketThread
          id={view.id}
          onBack={() => { fetchTickets(); setView({ mode: 'list', id: null }); }}
          onChanged={fetchTickets}
        />
      )}
    </Workspace>
  );
};

export default Support;
