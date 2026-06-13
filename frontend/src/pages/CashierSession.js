import React, { useEffect, useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import {
  KPICard, PageHeader, Workspace, EmptyState, LoadingSkeleton,
} from '../components/business';
import {
  Lock, Unlock, Banknote, Coins, Smartphone, CreditCard, Receipt,
  Calculator, X, RefreshCw, History, CheckCircle2, AlertTriangle, Printer,
} from 'lucide-react';

const cfa = (v) => `${Number(v || 0).toLocaleString('fr-FR')} CFA`;
const num = (v) => Number(v || 0).toLocaleString('fr-FR');
const dt = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/* ─── Open-session form ─── */
const OpenSessionCard = ({ onOpen, opening }) => {
  const [float, setFloat] = useState('');
  const [note, setNote] = useState('');
  return (
    <div className="fluent-card-filled p-6 max-w-md mx-auto text-center">
      <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
        <Unlock size={22} />
      </div>
      <h2 className="fui-subtitle1 mt-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Ouvrir la caisse</h2>
      <p className="fui-body1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Comptez l'argent présent dans le tiroir avant d'ouvrir la journée.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); onOpen({ openingFloat: Number(float) || 0, openingNote: note.trim() }); }} className="mt-5 space-y-4 text-left">
        <label className="block">
          <span className="form-label block mb-1">Fond de caisse (CFA) *</span>
          <input type="number" min="0" value={float} onChange={(e) => setFloat(e.target.value)} className="form-control" placeholder="Ex : 50000" required autoFocus />
        </label>
        <label className="block">
          <span className="form-label block mb-1">Note (optionnel)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="form-control" placeholder="Remarque d'ouverture..." />
        </label>
        <button type="submit" disabled={opening} className="ms-button ms-button-primary ms-button-md w-full flex items-center justify-center gap-2">
          <Unlock size={16} /> {opening ? 'Ouverture...' : 'Ouvrir la caisse'}
        </button>
      </form>
    </div>
  );
};

/* ─── Close-session modal ─── */
const CloseModal = ({ session, onClose, onConfirm, closing }) => {
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const expected = session.expectedCash || 0;
  const discrepancy = counted === '' ? null : Number(counted) - expected;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="fluent-card-filled w-full max-w-md" style={{ boxShadow: 'var(--shadow28)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          <h2 className="fui-subtitle1 flex items-center gap-2" style={{ color: 'var(--colorNeutralForeground1)' }}><Calculator size={16} /> Clôturer la caisse</h2>
          <button onClick={onClose} className="ms-icon-button"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-[var(--radiusLarge)] p-3 flex items-center justify-between" style={{ background: 'var(--colorNeutralBackground2)' }}>
            <span className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>Espèces attendues</span>
            <span className="fui-subtitle1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{cfa(expected)}</span>
          </div>
          <label className="block">
            <span className="form-label block mb-1">Espèces comptées (CFA) *</span>
            <input type="number" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} className="form-control" placeholder="Montant réel dans le tiroir" autoFocus />
          </label>
          {discrepancy !== null && (
            <div className="rounded-[var(--radiusLarge)] px-4 py-3 flex items-center justify-between"
              style={{
                background: discrepancy === 0 ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorStatusDangerBackground1)',
                border: `1px solid ${discrepancy === 0 ? 'var(--colorStatusSuccessStroke1)' : 'var(--colorStatusDangerStroke1)'}`,
              }}>
              <span className="fui-body1-strong flex items-center gap-1.5" style={{ color: discrepancy === 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
                {discrepancy === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                {discrepancy === 0 ? 'Caisse juste' : discrepancy > 0 ? 'Excédent' : 'Manquant'}
              </span>
              <span className="fui-subtitle1 tabular-nums" style={{ color: discrepancy === 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
                {discrepancy > 0 ? '+' : ''}{cfa(discrepancy)}
              </span>
            </div>
          )}
          <label className="block">
            <span className="form-label block mb-1">Note de clôture (optionnel)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="form-control" placeholder="Justification d'un écart..." />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="ms-button ms-button-secondary ms-button-md">Annuler</button>
            <button onClick={() => onConfirm({ countedCash: Number(counted) || 0, closingNote: note.trim() })} disabled={counted === '' || closing} className="ms-button ms-button-primary ms-button-md">
              {closing ? 'Clôture...' : 'Confirmer la clôture'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Z-report (printable) ─── */
const ZReport = ({ session, onClose }) => {
  const t = session.totals || {};
  const disc = session.discrepancy || 0;
  const Line = ({ label, value, strong, color }) => (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px dashed var(--colorNeutralStroke2)' }}>
      <span className={strong ? 'fui-body1-strong' : 'fui-body1'} style={{ color: color || (strong ? 'var(--colorNeutralForeground1)' : 'var(--colorNeutralForeground3)') }}>{label}</span>
      <span className={`tabular-nums ${strong ? 'fui-body1-strong' : 'fui-body1'}`} style={{ color: color || 'var(--colorNeutralForeground1)' }}>{value}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="fluent-card-filled w-full max-w-sm my-4" style={{ boxShadow: 'var(--shadow28)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          <h2 className="fui-subtitle1 flex items-center gap-2" style={{ color: 'var(--colorNeutralForeground1)' }}><Receipt size={16} /> Rapport Z</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => window.print()} className="ms-icon-button" title="Imprimer"><Printer size={15} /></button>
            <button onClick={onClose} className="ms-icon-button"><X size={16} /></button>
          </div>
        </div>
        <div className="p-5">
          <div className="text-center mb-3">
            <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Session du</p>
            <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{dt(session.openedAt)}</p>
            <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>au {dt(session.closedAt)}</p>
          </div>
          <Line label="Ouvert par" value={session.openedByName || '—'} />
          <Line label="Clôturé par" value={session.closedByName || '—'} />
          <div className="h-2" />
          <Line label="Fond de caisse" value={cfa(session.openingFloat)} />
          <Line label="Espèces encaissées" value={cfa(t.cashCollected)} />
          <Line label="Mobile Money" value={cfa(t.mobileMoneyCollected)} />
          <Line label="Crédit" value={cfa(t.creditCollected)} />
          <Line label="Dépenses espèces" value={`− ${cfa(t.cashExpenses)}`} color="var(--colorStatusDangerForeground1)" />
          <div className="h-2" />
          <Line label="Total encaissé" value={cfa(t.totalCollected)} strong />
          <Line label="Espèces attendues" value={cfa(session.expectedCash)} strong />
          <Line label="Espèces comptées" value={cfa(session.countedCash)} strong />
          <div className="mt-3 rounded-[var(--radiusLarge)] px-4 py-3 flex items-center justify-between"
            style={{ background: disc === 0 ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorStatusDangerBackground1)' }}>
            <span className="fui-body1-strong" style={{ color: disc === 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
              {disc === 0 ? 'Caisse juste' : disc > 0 ? 'Excédent' : 'Manquant'}
            </span>
            <span className="fui-subtitle1 tabular-nums" style={{ color: disc === 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
              {disc > 0 ? '+' : ''}{cfa(disc)}
            </span>
          </div>
          {session.closingNote && <p className="fui-caption1 mt-3" style={{ color: 'var(--colorNeutralForeground3)' }}>Note : {session.closingNote}</p>}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════ Main page ═══════════════════════ */
const CashierSession = () => {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [zReport, setZReport] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cur, hist] = await Promise.all([
        api.get('/cash-sessions/current'),
        api.get('/cash-sessions?limit=50'),
      ]);
      setCurrent(cur.data);
      setHistory(hist.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh live totals every 30s while a session is open
  useEffect(() => {
    if (!current) return undefined;
    const id = setInterval(async () => {
      try { const { data } = await api.get('/cash-sessions/current'); setCurrent(data); } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(id);
  }, [current]);

  const handleOpen = async (payload) => {
    try {
      setOpening(true);
      await api.post('/cash-sessions/open', payload);
      toast.success('Caisse ouverte');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    } finally { setOpening(false); }
  };

  const handleClose = async (payload) => {
    try {
      setClosing(true);
      const { data } = await api.post(`/cash-sessions/${current._id}/close`, payload);
      setShowClose(false);
      setCurrent(null);
      setZReport(data);
      toast.success('Caisse clôturée');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    } finally { setClosing(false); }
  };

  return (
    <Workspace>
      <Toaster position="top-right" />
      <PageHeader
        eyebrow="Caisse"
        title="Session de caisse"
        description="Ouvrez la journée avec un fond de caisse, suivez les encaissements en direct, puis clôturez avec le comptage réel."
        actions={
          <button onClick={load} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Actualiser
          </button>
        }
      />

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : !current ? (
        <OpenSessionCard onOpen={handleOpen} opening={opening} />
      ) : (
        <>
          {/* Open banner */}
          <div className="ms-command-bar flex-wrap gap-y-2">
            <span className="fui-body1-strong flex items-center gap-2" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--colorStatusSuccessForeground1)' }} />
              Caisse ouverte
            </span>
            <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Depuis {dt(current.openedAt)} · par {current.openedByName || '—'}
            </span>
            <button onClick={() => setShowClose(true)} className="ms-button ms-button-primary ms-button-sm flex items-center gap-1.5 ml-auto">
              <Lock size={14} /> Clôturer la caisse
            </button>
          </div>

          {/* Live KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard title="Fond de caisse" value={cfa(current.openingFloat)} context="Ouverture" icon={<Banknote className="h-4 w-4" />} />
            <KPICard title="Espèces encaissées" value={cfa(current.totals?.cashCollected)} context={`${num(current.totals?.paymentsCount)} paiement(s)`} icon={<Coins className="h-4 w-4" />} tone="success" />
            <KPICard title="Dépenses espèces" value={cfa(current.totals?.cashExpenses)} context={`${num(current.totals?.expensesCount)} dépense(s)`} icon={<Receipt className="h-4 w-4" />} tone="danger" />
            <KPICard title="Espèces attendues" value={cfa(current.expectedCash)} context="Fond + encaissé − dépenses" icon={<Calculator className="h-4 w-4" />} tone="brand" />
          </div>

          {/* Payment method breakdown */}
          <div className="fluent-card-filled p-5">
            <p className="fui-subtitle2 mb-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Encaissements par méthode</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Espèces', value: current.totals?.cashCollected, icon: Coins, color: 'var(--colorStatusSuccessForeground1)' },
                { label: 'Mobile Money', value: current.totals?.mobileMoneyCollected, icon: Smartphone, color: 'var(--colorBrandForeground1)' },
                { label: 'Crédit', value: current.totals?.creditCollected, icon: CreditCard, color: 'var(--colorStatusWarningForeground1)' },
              ].map((m) => (
                <div key={m.label} className="rounded-[var(--radiusLarge)] p-3 text-center" style={{ background: 'var(--colorNeutralBackground2)' }}>
                  <m.icon size={16} style={{ color: m.color, margin: '0 auto' }} />
                  <p className="fui-subtitle2 mt-1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>{cfa(m.value)}</p>
                  <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{m.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[var(--radiusLarge)] px-4 py-2.5" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>Total encaissé</span>
              <span className="fui-subtitle1 tabular-nums" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{cfa(current.totals?.totalCollected)}</span>
            </div>
          </div>
        </>
      )}

      {/* History */}
      {!loading && history.length > 0 && (
        <div className="fluent-card-filled overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
            <History size={15} style={{ color: 'var(--colorNeutralForeground3)' }} />
            <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Historique des sessions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--colorNeutralBackground2)' }}>
                <tr>
                  {['Clôturée le', 'Caissier', 'Encaissé', 'Attendu', 'Compté', 'Écart', ''].map((h, i) => (
                    <th key={h} className={`px-3 py-2 fui-caption1-strong ${i >= 2 && i <= 5 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--colorNeutralForeground3)', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s._id} style={{ borderBottom: '1px solid var(--colorNeutralStroke3)' }}>
                    <td className="px-3 py-2 fui-body1" style={{ color: 'var(--colorNeutralForeground1)' }}>{dt(s.closedAt)}</td>
                    <td className="px-3 py-2 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{s.closedByName || s.openedByName || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{cfa(s.totals?.totalCollected)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{cfa(s.expectedCash)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{cfa(s.countedCash)}</td>
                    <td className="px-3 py-2 text-right tabular-nums fui-body1-strong" style={{ color: s.discrepancy === 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
                      {s.discrepancy > 0 ? '+' : ''}{cfa(s.discrepancy)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setZReport(s)} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1 ml-auto">
                        <Receipt size={12} /> Z
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !current && history.length === 0 && (
        <EmptyState title="Aucune session" description="Ouvrez votre première session de caisse pour démarrer le suivi quotidien." />
      )}

      {showClose && current && <CloseModal session={current} onClose={() => setShowClose(false)} onConfirm={handleClose} closing={closing} />}
      {zReport && <ZReport session={zReport} onClose={() => setZReport(null)} />}
    </Workspace>
  );
};

export default CashierSession;
