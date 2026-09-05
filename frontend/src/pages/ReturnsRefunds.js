import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Undo2, Wallet, Plus, X, Check, Ban, RefreshCw, PackageX,
} from 'lucide-react';
import {
  Workspace, PageHeader, Surface, StatusBadge, KPICard, EmptyState,
  LoadingSkeleton, DataTable,
} from '../components/business';
import { confirmDialog } from '../components/ConfirmProvider';
import { salesApi } from '../features/sales/api';
import { formatCfa as cfa } from '../utils/format';
import { formatDate } from '../utils/saleUtils';

const RETURN_STATUS = {
  pending: { label: 'En attente', tone: 'info' },
  posted: { label: 'Passé', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

const REFUND_STATUS = {
  pending: { label: 'En attente', tone: 'info' },
  completed: { label: 'Effectué', tone: 'success' },
  failed: { label: 'Échoué', tone: 'danger' },
  reversed: { label: 'Annulé', tone: 'danger' },
};

const DISPOSITIONS = [
  { value: 'restocked', label: 'Remise en stock' },
  { value: 'damaged', label: 'Endommagé' },
  { value: 'discarded', label: 'Jeté' },
];

const asList = (data, field) => (Array.isArray(data) ? data : (Array.isArray(data?.[field]) ? data[field] : []));

const ReturnsRefunds = () => {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [sales, setSales] = useState([]);
  const [sale, setSale] = useState(null);
  const [returns, setReturns] = useState([]);
  const [allReturns, setAllReturns] = useState([]);
  const [refunds, setRefunds] = useState([]);

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [returnForm, setReturnForm] = useState({
    note: '', lines: [{ product: '', quantity: 1, disposition: 'restocked' }],
  });
  const [refundForm, setRefundForm] = useState({ amount: '', method: 'cash', reason: '' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sRes, rRes, aRes] = await Promise.all([
        salesApi.list({ limit: 50 }),
        salesApi.listRefunds({ limit: 50 }),
        salesApi.allReturns({ limit: 200 }),
      ]);
      setSales(asList(sRes.data, 'sales'));
      setRefunds(asList(rRes.data, 'refunds'));
      setAllReturns(asList(aRes.data, 'returns'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de charger retours et remboursements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectSale = async (saleId) => {
    if (!saleId) { setSale(null); setReturns([]); return; }
    try {
      const [saleRes, retRes] = await Promise.all([
        salesApi.get(saleId),
        salesApi.listReturns(saleId),
      ]);
      setSale(saleRes.data);
      setReturns(asList(retRes.data, 'returns'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Vente introuvable.');
    }
  };

  const saleProductLabel = (id) => {
    const line = (sale?.products || []).find((p) => {
      const productId = p.product?._id || p.product;
      return String(productId) === String(id);
    });
    const name = line?.name || line?.productName || (line?.product && line.product.name) || String(id).slice(-6);
    return `${name}${line?.sku ? ` (${line.sku})` : ''}`;
  };

  const createReturn = async (e) => {
    e.preventDefault();
    if (!sale || returnForm.lines.some((l) => !l.product || Number(l.quantity) <= 0)) {
      toast.error('Vente sélectionnée et lignes valides requises.');
      return;
    }
    try {
      await salesApi.returns(sale._id, {
        note: returnForm.note,
        lines: returnForm.lines.map((l) => ({
          product: l.product,
          quantity: Number(l.quantity),
          disposition: l.disposition,
        })),
      });
      toast.success('Retour enregistré.');
      setReturnForm({ note: '', lines: [{ product: '', quantity: 1, disposition: 'restocked' }] });
      setShowReturnForm(false);
      selectSale(sale._id);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Retour impossible.');
    }
  };

  const returnAction = async (ret, action) => {
    try {
      setBusyId(ret._id);
      if (action === 'post') {
        if (!(await confirmDialog('Passer ce retour en stock ?', { confirmLabel: 'Passer' }))) return;
        await salesApi.postReturn(sale._id, ret._id, {});
      } else if (action === 'cancel') {
        if (!(await confirmDialog('Annuler ce retour ?', { danger: true, confirmLabel: 'Annuler' }))) return;
        await salesApi.cancelReturn(sale._id, ret._id);
      }
      toast.success('Action effectuée.');
      selectSale(sale._id);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const createRefund = async (e) => {
    e.preventDefault();
    const amount = Number(refundForm.amount);
    if (!sale || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Vente sélectionnée et montant valide requis.');
      return;
    }
    try {
      await salesApi.refunds({
        saleId: sale._id,
        amount,
        method: refundForm.method,
        reason: refundForm.reason,
      });
      toast.success('Remboursement enregistré.');
      setRefundForm({ amount: '', method: 'cash', reason: '' });
      setShowRefundForm(false);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Remboursement impossible.');
    }
  };

  const returnableTotal = useMemo(() => {
    if (!sale) return 0;
    return (sale.products || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  }, [sale]);

  const refundedTotal = useMemo(
    () => refunds.reduce((sum, r) => sum + (r.status === 'completed' || r.status === 'pending' ? (Number(r.amount) || 0) : 0), 0),
    [refunds],
  );

  if (loading) {
    return (
      <Workspace>
        <PageHeader eyebrow="Retours v2" title="Retours & remboursements" description="Gestion des retours de vente et des remboursements clients." />
        <LoadingSkeleton rows={6} />
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PageHeader
        eyebrow="Retours v2"
        title="Retours & remboursements"
        description="Sélectionnez une vente, enregistrez des retours (remise en stock, casse, perte) et des remboursements."
        actions={
          <button type="button" className="ms-button ms-button-secondary ms-button-md" onClick={() => load(true)}>
            <RefreshCw size={16} /> Actualiser
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard title="Ventes récentes" value={sales.length} context="Chargées pour sélection" />
        <KPICard title="Retours" value={sale ? returns.length : allReturns.length} context={sale ? 'Sur la vente sélectionnée' : 'Tous les retours'} tone="info" />
        <KPICard title="Quantité retournable" value={returnableTotal} context="Unités sur la vente" />
        <KPICard title="Remboursements" value={cfa(refundedTotal)} context={`${refunds.length} enregistrés`} tone="warning" />
      </div>

      {/* Sélecteur de vente */}
      <Surface className="p-4">
        <label className="form-control max-w-xl">
          <span className="fui-caption1 mb-1">Vente concernée</span>
          <select className="form-control" value={sale?._id || ''} onChange={(e) => selectSale(e.target.value)}>
            <option value="">— Choisir une vente —</option>
            {sales.map((s) => (
              <option key={s._id} value={s._id}>
                {String(s._id).slice(-6).toUpperCase()} · {formatDate(s.saleDate || s.createdAt)} · {cfa(s.totalAmount)}
              </option>
            ))}
          </select>
        </label>
        {sale && (
          <p className="fui-caption1 mt-2">
            Client : {sale.client?.name || sale.clientName || '—'} · Total {cfa(sale.totalAmount)} · Encaissé {cfa(sale.collectedAmount || 0)} · Lignes {(sale.products || []).length}
          </p>
        )}
      </Surface>

      {/* Retours */}
      <Surface className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="fui-subtitle1">Retours de la vente</h2>
          <button
            type="button" className="ms-button ms-button-primary ms-button-md"
            disabled={!sale}
            onClick={() => setShowReturnForm((v) => !v)}
          >
            {showReturnForm ? <X size={16} /> : <Plus size={16} />} {showReturnForm ? 'Fermer' : 'Nouveau retour'}
          </button>
        </div>

        {showReturnForm && sale && (
          <form onSubmit={createReturn} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
            <p className="fui-body1-strong mb-2">Lignes retournées</p>
            {returnForm.lines.map((line, idx) => (
              <div key={idx} className="mb-2 grid grid-cols-12 gap-2">
                <select
                  className="form-control col-span-5"
                  value={line.product}
                  onChange={(e) => setReturnForm({ ...returnForm, lines: returnForm.lines.map((l, i) => (i === idx ? { ...l, product: e.target.value } : l)) })}
                  required
                >
                  <option value="">— Produit —</option>
                  {(sale.products || []).map((p) => {
                    // `p.product` peut être un objet peuplé : on envoie l'id réel.
                    const productId = p.product?._id || p.product;
                    return (
                      <option key={productId} value={productId}>{saleProductLabel(productId)}</option>
                    );
                  })}
                </select>
                <input
                  type="number" min="1" className="form-control col-span-2" placeholder="Qté"
                  value={line.quantity}
                  onChange={(e) => setReturnForm({ ...returnForm, lines: returnForm.lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)) })}
                  required
                />
                <select
                  className="form-control col-span-4"
                  value={line.disposition}
                  onChange={(e) => setReturnForm({ ...returnForm, lines: returnForm.lines.map((l, i) => (i === idx ? { ...l, disposition: e.target.value } : l)) })}
                >
                  {DISPOSITIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <button
                  type="button" className="btn-ghost-danger col-span-1" aria-label="Retirer la ligne"
                  onClick={() => setReturnForm({ ...returnForm, lines: returnForm.lines.filter((_, i) => i !== idx) })}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button" className="btn-ghost"
              onClick={() => setReturnForm({ ...returnForm, lines: [...returnForm.lines, { product: '', quantity: 1, disposition: 'restocked' }] })}
            >
              <Plus size={16} /> Ajouter une ligne
            </button>
            <label className="form-control mt-3">
              <span className="fui-caption1 mb-1">Note</span>
              <input type="text" className="form-control" value={returnForm.note} onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })} placeholder="Motif du retour…" />
            </label>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="btn-primary"><Undo2 size={16} /> Enregistrer le retour</button>
            </div>
          </form>
        )}

        {sale ? (
          returns.length === 0 ? (
            <EmptyState title="Aucun retour sur cette vente" description="Enregistrez un retour de produit." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Lignes</th><th>Note</th><th>Statut</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret) => {
                    const st = RETURN_STATUS[ret.status] || { label: ret.status, tone: 'neutral' };
                    return (
                      <tr key={ret._id}>
                        <td>{formatDate(ret.createdAt)}</td>
                        <td>
                          {(ret.lines || []).map((l, i) => (
                            <span key={i} className="mr-2 inline-flex items-center gap-1">
                              <StatusBadge tone="neutral">
                                {saleProductLabel(l.product)} × {l.quantity}
                              </StatusBadge>
                              <span className="fui-caption1">
                                {DISPOSITIONS.find((d) => d.value === l.disposition)?.label || l.disposition}
                              </span>
                            </span>
                          ))}
                        </td>
                        <td className="max-w-[200px] truncate">{ret.note || '—'}</td>
                        <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                        <td className="text-right whitespace-nowrap">
                          {ret.status === 'pending' && (
                            <>
                              <button type="button" className="btn-ghost" disabled={busyId === ret._id} onClick={() => returnAction(ret, 'post')}><Check size={14} /> Passer</button>
                              <button type="button" className="btn-ghost-danger" disabled={busyId === ret._id} onClick={() => returnAction(ret, 'cancel')}><Ban size={14} /></button>
                            </>
                          )}
                          {ret.status !== 'pending' && <span className="fui-caption1">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          )
        ) : allReturns.length === 0 ? (
          <EmptyState title="Aucun retour enregistré" description="Sélectionnez une vente ci-dessus pour créer un retour." />
        ) : (
          <>
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Code</th><th>Vente</th><th>Lignes</th><th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {allReturns.map((ret) => {
                    const st = RETURN_STATUS[ret.status] || { label: ret.status, tone: 'neutral' };
                    return (
                      <tr key={ret._id}>
                        <td>{formatDate(ret.createdAt)}</td>
                        <td className="font-mono">{ret.code || String(ret._id).slice(-6)}</td>
                        <td className="font-mono">{String(ret.saleId || '—').slice(-6)}</td>
                        <td>
                          {(ret.lines || []).map((l, i) => (
                            <span key={i} className="mr-2 inline-flex items-center gap-1">
                              <StatusBadge tone="neutral">{saleProductLabel(l.product)} × {l.quantity}</StatusBadge>
                              <span className="fui-caption1">{DISPOSITIONS.find((d) => d.value === l.disposition)?.label || l.disposition}</span>
                            </span>
                          ))}
                        </td>
                        <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
            <p className="fui-caption1 mt-2">Sélectionnez une vente ci-dessus pour passer ou annuler un retour.</p>
          </>
        )}
      </Surface>

      {/* Remboursements */}
      <Surface className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="fui-subtitle1">Remboursements</h2>
          <button
            type="button" className="ms-button ms-button-primary ms-button-md"
            disabled={!sale}
            onClick={() => setShowRefundForm((v) => !v)}
          >
            {showRefundForm ? <X size={16} /> : <Plus size={16} />} {showRefundForm ? 'Fermer' : 'Nouveau remboursement'}
          </button>
        </div>

        {showRefundForm && sale && (
          <form onSubmit={createRefund} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="form-control">
                <span className="fui-caption1 mb-1">Montant (CFA) *</span>
                <input
                  type="number" min="1" className="form-control" required
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                />
              </label>
              <label className="form-control">
                <span className="fui-caption1 mb-1">Méthode</span>
                <select className="form-control" value={refundForm.method} onChange={(e) => setRefundForm({ ...refundForm, method: e.target.value })}>
                  <option value="cash">Espèces</option>
                  <option value="MobileMoney">Mobile Money</option>
                  <option value="bank">Virement</option>
                  <option value="credit">Avoir</option>
                </select>
              </label>
              <label className="form-control">
                <span className="fui-caption1 mb-1">Motif</span>
                <input type="text" className="form-control" value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} placeholder="Erreur, insatisfaction…" />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="btn-primary"><Wallet size={16} /> Enregistrer le remboursement</button>
            </div>
          </form>
        )}

        {refunds.length === 0 ? (
          <EmptyState title="Aucun remboursement" description="Les remboursements v2 enregistrés apparaîtront ici." />
        ) : (
          <DataTable>
            <table className="ms-table">
              <thead>
                <tr>
                  <th>Date</th><th>Vente</th><th className="text-right">Montant</th>
                  <th>Méthode</th><th>Motif</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => {
                  const st = REFUND_STATUS[r.status] || { label: r.status, tone: 'neutral' };
                  return (
                    <tr key={r._id}>
                      <td>{formatDate(r.createdAt)}</td>
                      <td className="font-mono">{String(r.saleId || '—').slice(-6)}</td>
                      <td className="text-right">{cfa(r.amount)}</td>
                      <td>{r.method}</td>
                      <td className="max-w-[200px] truncate">{r.reason || '—'}</td>
                      <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        )}
        <p className="fui-caption1 mt-3">
          <PackageX size={12} className="inline" /> Les retours « remise en stock » réintègrent automatiquement le stock via le moteur d'inventaire v2.
        </p>
      </Surface>
    </Workspace>
  );
};

export default ReturnsRefunds;
