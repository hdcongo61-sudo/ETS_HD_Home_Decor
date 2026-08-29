import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Truck, Send, Check, X, Ban, PackageCheck, Receipt, Wallet,
  Plus, RefreshCw, ClipboardList, Ship, Undo2,
} from 'lucide-react';
import {
  Workspace, PageHeader, Surface, StatusBadge, KPICard, EmptyState,
  LoadingSkeleton, DataTable,
} from '../components/business';
import { confirmDialog } from '../components/ConfirmProvider';
import { purchasingApi } from '../features/purchasing/api';
import { catalogApi } from '../features/catalog/api';
import { platformApi } from '../features/platform/api';
import { formatCfa as cfa } from '../utils/format';
import { formatDate } from '../utils/saleUtils';

const PO_STATUS = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  submitted: { label: 'Soumis', tone: 'info' },
  approved: { label: 'Approuvé', tone: 'success' },
  partially_received: { label: 'Partiel. reçu', tone: 'info' },
  received: { label: 'Reçu', tone: 'success' },
  closed: { label: 'Clôturé', tone: 'neutral' },
  rejected: { label: 'Rejeté', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

const SHIP_STATUS = {
  planned: { label: 'Planifiée', tone: 'neutral' },
  in_transit: { label: 'En transit', tone: 'info' },
  received: { label: 'Reçue', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

const INV_STATUS = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  posted: { label: 'Comptabilisée', tone: 'info' },
  partially_paid: { label: 'Partiel. payée', tone: 'warning' },
  paid: { label: 'Payée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

const TABS = [
  { key: 'orders', label: 'Bons de commande', icon: ClipboardList },
  { key: 'shipments', label: 'Expéditions', icon: Ship },
  { key: 'invoices', label: 'Factures fournisseur', icon: Receipt },
  { key: 'payables', label: 'À payer', icon: Wallet },
];

const asList = (data, field) => {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[field]) ? data[field] : [];
};

const PurchaseOrders = () => {
  const [tab, setTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payables, setPayables] = useState({ bySupplier: [] });
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);

  const [showPoForm, setShowPoForm] = useState(false);
  const [showShipForm, setShowShipForm] = useState(false);
  const [showInvForm, setShowInvForm] = useState(false);

  const [poForm, setPoForm] = useState({
    supplierId: '', note: '', expectedDate: '',
    lines: [{ product: '', orderedQuantity: 1, unitCost: 0 }],
  });
  const [shipForm, setShipForm] = useState({
    reference: '', destinationLocationId: '', origin: '', containerNumber: '',
    supplierIds: '', purchaseOrderIds: '', freightCost: 0, customsCost: 0,
    insuranceCost: 0, note: '',
  });
  const [invForm, setInvForm] = useState({
    supplierId: '', invoiceNumber: '', issueDate: '', dueDate: '', note: '',
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [oRes, sRes, iRes, pRes, supRes, prodRes, locRes] = await Promise.all([
        purchasingApi.orders(),
        purchasingApi.shipments(),
        purchasingApi.invoices(),
        purchasingApi.payables(),
        purchasingApi.suppliers(),
        catalogApi.list({ limit: 500 }),
        platformApi.locations(),
      ]);
      setOrders(asList(oRes.data, 'orders'));
      setShipments(asList(sRes.data, 'shipments'));
      setInvoices(asList(iRes.data, 'invoices'));
      setPayables(pRes.data?.bySupplier ? pRes.data : { ...(pRes.data || {}), bySupplier: [] });
      setSuppliers(asList(supRes.data, 'suppliers'));
      setProducts(asList(prodRes.data, 'products'));
      setLocations(asList(locRes.data, 'locations'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de charger les achats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const supplierName = (idOrDoc) => idOrDoc?.name || (typeof idOrDoc === 'string' ? idOrDoc.slice(-6) : '—');

  // ── Actions bons de commande ──
  const runOrderAction = async (order, action, extra = null) => {
    try {
      setBusyId(order._id);
      if (action === 'submit') {
        if (!(await confirmDialog('Soumettre ce bon de commande ?', { confirmLabel: 'Soumettre' }))) return;
        await purchasingApi.submitOrder(order._id);
      } else if (action === 'approve') {
        if (!(await confirmDialog('Approuver ce bon de commande ?', { confirmLabel: 'Approuver' }))) return;
        await purchasingApi.approveOrder(order._id);
      } else if (action === 'reject') {
        const reason = window.prompt('Motif du rejet :');
        if (reason === null) return;
        await purchasingApi.rejectOrder(order._id, reason.trim());
      } else if (action === 'cancel') {
        if (!(await confirmDialog('Annuler ce bon de commande ?', { danger: true, confirmLabel: 'Annuler le bon' }))) return;
        await purchasingApi.cancelOrder(order._id);
      } else if (action === 'close') {
        if (!(await confirmDialog('Clôturer ce bon de commande ?', { confirmLabel: 'Clôturer' }))) return;
        await purchasingApi.closeOrder(order._id);
      } else if (action === 'receive') {
        const remaining = (order.lines || []).filter((l) => l.receivedQuantity < l.orderedQuantity);
        if (remaining.length === 0) { toast('Toutes les lignes sont déjà reçues.'); return; }
        if (!(await confirmDialog(`Réceptionner les ${remaining.length} ligne(s) restantes ?`, { confirmLabel: 'Réceptionner' }))) return;
        await purchasingApi.receiveOrder(order._id, remaining.map((l) => ({
          product: l.product?._id || l.product,
          receivedQuantity: l.orderedQuantity - l.receivedQuantity,
        })));
      } else if (extra) {
        await extra();
      }
      toast.success('Action effectuée.');
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const createOrder = async (e) => {
    e.preventDefault();
    if (!poForm.supplierId || poForm.lines.some((l) => !l.product || Number(l.orderedQuantity) <= 0)) {
      toast.error('Fournisseur et lignes valides requis.');
      return;
    }
    try {
      await purchasingApi.createOrder({
        supplierId: poForm.supplierId,
        note: poForm.note,
        expectedDate: poForm.expectedDate || null,
        lines: poForm.lines.map((l) => ({
          product: l.product,
          orderedQuantity: Number(l.orderedQuantity),
          unitCost: Number(l.unitCost) || 0,
        })),
      });
      toast.success('Bon de commande créé.');
      setPoForm({ supplierId: '', note: '', expectedDate: '', lines: [{ product: '', orderedQuantity: 1, unitCost: 0 }] });
      setShowPoForm(false);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Création impossible.');
    }
  };

  const createShipment = async (e) => {
    e.preventDefault();
    if (!shipForm.reference.trim() || !shipForm.destinationLocationId) {
      toast.error('Référence et boutique de destination requises.');
      return;
    }
    try {
      await purchasingApi.createShipment({
        reference: shipForm.reference,
        destinationLocationId: shipForm.destinationLocationId,
        origin: shipForm.origin,
        containerNumber: shipForm.containerNumber,
        supplierIds: shipForm.supplierIds.split(',').map((s) => s.trim()).filter(Boolean),
        purchaseOrderIds: shipForm.purchaseOrderIds.split(',').map((s) => s.trim()).filter(Boolean),
        freightCost: Number(shipForm.freightCost) || 0,
        customsCost: Number(shipForm.customsCost) || 0,
        insuranceCost: Number(shipForm.insuranceCost) || 0,
        note: shipForm.note,
      });
      toast.success('Expédition créée.');
      setShipForm({ reference: '', destinationLocationId: '', origin: '', containerNumber: '', supplierIds: '', purchaseOrderIds: '', freightCost: 0, customsCost: 0, insuranceCost: 0, note: '' });
      setShowShipForm(false);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Création impossible.');
    }
  };

  const shipAction = async (shipment, action) => {
    try {
      setBusyId(shipment._id);
      if (action === 'in_transit') {
        if (!(await confirmDialog('Marquer l’expédition « en transit » ?', { confirmLabel: 'En transit' }))) return;
        await purchasingApi.markShipmentInTransit(shipment._id);
      } else if (action === 'receive') {
        if (!(await confirmDialog('Réceptionner cette expédition ?', { confirmLabel: 'Réceptionner' }))) return;
        await purchasingApi.receiveShipment(shipment._id);
      } else if (action === 'cancel') {
        if (!(await confirmDialog('Annuler cette expédition ?', { danger: true, confirmLabel: 'Annuler' }))) return;
        await purchasingApi.cancelShipment(shipment._id);
      }
      toast.success('Action effectuée.');
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const createInvoice = async (e) => {
    e.preventDefault();
    if (!invForm.supplierId || !invForm.invoiceNumber.trim()) {
      toast.error('Fournisseur et numéro de facture requis.');
      return;
    }
    try {
      await purchasingApi.createInvoice({
        supplierId: invForm.supplierId,
        invoiceNumber: invForm.invoiceNumber,
        issueDate: invForm.issueDate || null,
        dueDate: invForm.dueDate || null,
        note: invForm.note,
      });
      toast.success('Facture créée.');
      setInvForm({ supplierId: '', invoiceNumber: '', issueDate: '', dueDate: '', note: '' });
      setShowInvForm(false);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Création impossible.');
    }
  };

  const invoiceAction = async (invoice, action) => {
    try {
      setBusyId(invoice._id);
      if (action === 'post') {
        if (!(await confirmDialog('Comptabiliser cette facture ?', { confirmLabel: 'Comptabiliser' }))) return;
        await purchasingApi.postInvoice(invoice._id);
      } else if (action === 'pay') {
        const amount = window.prompt('Montant du paiement (CFA) :', invoice.totalAmount - invoice.paidAmount);
        if (amount === null) return;
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) { toast.error('Montant invalide.'); return; }
        await purchasingApi.payInvoice(invoice._id, { amount: value, method: 'cash' });
      } else if (action === 'cancel') {
        if (!(await confirmDialog('Annuler cette facture ?', { danger: true, confirmLabel: 'Annuler' }))) return;
        await purchasingApi.cancelInvoice(invoice._id);
      }
      toast.success('Action effectuée.');
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const kpis = useMemo(() => {
    const openOrders = orders.filter((o) => ['draft', 'submitted', 'approved', 'partially_received'].includes(o.status));
    const pendingInvoices = invoices.filter((i) => ['posted', 'partially_paid'].includes(i.status));
    const outstanding = Number(payables.totalOutstanding || 0);
    return {
      orders: orders.length,
      openOrders: openOrders.length,
      pendingInvoices: pendingInvoices.length,
      outstanding,
    };
  }, [orders, invoices, payables]);

  if (loading) {
    return (
      <Workspace>
        <PageHeader eyebrow="Achats v2" title="Achats & fournisseurs" description="Bons de commande, expéditions, factures et dettes fournisseur." />
        <LoadingSkeleton rows={6} />
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PageHeader
        eyebrow="Achats v2"
        title="Achats & fournisseurs"
        description="Cycle d'achat complet : bon de commande → expédition → facture → règlement."
        actions={
          <button type="button" className="ms-button ms-button-secondary ms-button-md" onClick={() => load(true)}>
            <RefreshCw size={16} /> Actualiser
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard title="Bons de commande" value={kpis.orders} context={`${kpis.openOrders} en cours`} />
        <KPICard title="Expéditions" value={shipments.length} context={`${shipments.filter((s) => s.status === 'in_transit').length} en transit`} />
        <KPICard title="Factures à régler" value={kpis.pendingInvoices} context="Comptabilisées non soldées" tone="warning" />
        <KPICard title="Dettes fournisseur" value={cfa(kpis.outstanding)} context="Total à payer" tone="danger" />
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections achats">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={tab === key ? 'ms-button ms-button-primary ms-button-md' : 'ms-button ms-button-secondary ms-button-md'}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ── Bons de commande ── */}
      {tab === 'orders' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Bons de commande</h2>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={() => setShowPoForm((v) => !v)}>
              {showPoForm ? <X size={16} /> : <Plus size={16} />} {showPoForm ? 'Fermer' : 'Nouveau bon'}
            </button>
          </div>

          {showPoForm && (
            <form onSubmit={createOrder} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Fournisseur *</span>
                  <select className="form-control" value={poForm.supplierId} onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })} required>
                    <option value="">— Choisir —</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Date de livraison prévue</span>
                  <input type="date" className="form-control" value={poForm.expectedDate} onChange={(e) => setPoForm({ ...poForm, expectedDate: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Note</span>
                  <input type="text" className="form-control" value={poForm.note} onChange={(e) => setPoForm({ ...poForm, note: e.target.value })} placeholder="Référence interne…" />
                </label>
              </div>

              <p className="fui-body1-strong mt-3 mb-2">Lignes</p>
              {poForm.lines.map((line, idx) => (
                <div key={idx} className="mb-2 grid grid-cols-12 gap-2">
                  <select
                    className="form-control col-span-5"
                    value={line.product}
                    onChange={(e) => setPoForm({ ...poForm, lines: poForm.lines.map((l, i) => (i === idx ? { ...l, product: e.target.value } : l)) })}
                    required
                  >
                    <option value="">— Produit —</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                  </select>
                  <input
                    type="number" min="1" className="form-control col-span-3" placeholder="Qté"
                    value={line.orderedQuantity}
                    onChange={(e) => setPoForm({ ...poForm, lines: poForm.lines.map((l, i) => (i === idx ? { ...l, orderedQuantity: e.target.value } : l)) })}
                    required
                  />
                  <input
                    type="number" min="0" step="0.01" className="form-control col-span-3" placeholder="Coût unit."
                    value={line.unitCost}
                    onChange={(e) => setPoForm({ ...poForm, lines: poForm.lines.map((l, i) => (i === idx ? { ...l, unitCost: e.target.value } : l)) })}
                  />
                  <button
                    type="button" className="btn-ghost-danger col-span-1" aria-label="Retirer la ligne"
                    onClick={() => setPoForm({ ...poForm, lines: poForm.lines.filter((_, i) => i !== idx) })}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button" className="btn-ghost"
                onClick={() => setPoForm({ ...poForm, lines: [...poForm.lines, { product: '', orderedQuantity: 1, unitCost: 0 }] })}
              >
                <Plus size={16} /> Ajouter une ligne
              </button>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary"><Send size={16} /> Créer le bon de commande</button>
              </div>
            </form>
          )}

          {orders.length === 0 ? (
            <EmptyState title="Aucun bon de commande" description="Créez votre premier bon de commande fournisseur." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>N°</th><th>Fournisseur</th><th>Date</th><th>Lignes</th>
                    <th className="text-right">Total</th><th>Statut</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const st = PO_STATUS[o.status] || { label: o.status, tone: 'neutral' };
                    return (
                      <tr key={o._id}>
                        <td className="font-mono">{String(o._id).slice(-6).toUpperCase()}</td>
                        <td>{supplierName(o.supplierId)}</td>
                        <td>{formatDate(o.createdAt)}</td>
                        <td>{o.lines?.length || 0}</td>
                        <td className="text-right">{cfa(o.totalAmount)}</td>
                        <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                        <td className="text-right whitespace-nowrap">
                          {['draft'].includes(o.status) && (
                            <>
                              <button type="button" className="btn-ghost" disabled={busyId === o._id} onClick={() => runOrderAction(o, 'submit')}><Send size={14} /> Soumettre</button>
                              <button type="button" className="btn-ghost-danger" disabled={busyId === o._id} onClick={() => runOrderAction(o, 'cancel')}><Ban size={14} /></button>
                            </>
                          )}
                          {o.status === 'submitted' && (
                            <>
                              <button type="button" className="btn-ghost" disabled={busyId === o._id} onClick={() => runOrderAction(o, 'approve')}><Check size={14} /> Approuver</button>
                              <button type="button" className="btn-ghost-danger" disabled={busyId === o._id} onClick={() => runOrderAction(o, 'reject')}><X size={14} /> Rejeter</button>
                            </>
                          )}
                          {['approved', 'partially_received'].includes(o.status) && (
                            <button type="button" className="btn-ghost" disabled={busyId === o._id} onClick={() => runOrderAction(o, 'receive')}><PackageCheck size={14} /> Réceptionner</button>
                          )}
                          {o.status === 'received' && (
                            <button type="button" className="btn-ghost" disabled={busyId === o._id} onClick={() => runOrderAction(o, 'close')}><Check size={14} /> Clôturer</button>
                          )}
                          {!['draft', 'submitted', 'approved', 'partially_received', 'received'].includes(o.status) && (
                            <span className="fui-caption1">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── Expéditions ── */}
      {tab === 'shipments' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Expéditions entrantes</h2>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={() => setShowShipForm((v) => !v)}>
              {showShipForm ? <X size={16} /> : <Plus size={16} />} {showShipForm ? 'Fermer' : 'Nouvelle expédition'}
            </button>
          </div>

          {showShipForm && (
            <form onSubmit={createShipment} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Référence *</span>
                  <input type="text" className="form-control" value={shipForm.reference} onChange={(e) => setShipForm({ ...shipForm, reference: e.target.value })} required />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Boutique de destination *</span>
                  <select className="form-control" value={shipForm.destinationLocationId} onChange={(e) => setShipForm({ ...shipForm, destinationLocationId: e.target.value })} required>
                    <option value="">— Choisir —</option>
                    {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Origine</span>
                  <input type="text" className="form-control" value={shipForm.origin} onChange={(e) => setShipForm({ ...shipForm, origin: e.target.value })} placeholder="Port, ville…" />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Conteneur</span>
                  <input type="text" className="form-control" value={shipForm.containerNumber} onChange={(e) => setShipForm({ ...shipForm, containerNumber: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Fournisseurs (ids séparés par ,)</span>
                  <input type="text" className="form-control" value={shipForm.supplierIds} onChange={(e) => setShipForm({ ...shipForm, supplierIds: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Bons de commande (ids ,)</span>
                  <input type="text" className="form-control" value={shipForm.purchaseOrderIds} onChange={(e) => setShipForm({ ...shipForm, purchaseOrderIds: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Fret</span>
                  <input type="number" min="0" className="form-control" value={shipForm.freightCost} onChange={(e) => setShipForm({ ...shipForm, freightCost: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Douane</span>
                  <input type="number" min="0" className="form-control" value={shipForm.customsCost} onChange={(e) => setShipForm({ ...shipForm, customsCost: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Assurance</span>
                  <input type="number" min="0" className="form-control" value={shipForm.insuranceCost} onChange={(e) => setShipForm({ ...shipForm, insuranceCost: e.target.value })} />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary"><Truck size={16} /> Créer l'expédition</button>
              </div>
            </form>
          )}

          {shipments.length === 0 ? (
            <EmptyState title="Aucune expédition" description="Planifiez une expédition fournisseur entrante." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Référence</th><th>Destination</th><th>Origine</th>
                    <th className="text-right">Coûts totaux</th><th>Statut</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => {
                    const st = SHIP_STATUS[s.status] || { label: s.status, tone: 'neutral' };
                    const totalCost = Number(s.freightCost || 0) + Number(s.customsCost || 0) + Number(s.insuranceCost || 0);
                    return (
                      <tr key={s._id}>
                        <td className="font-mono">{s.reference}</td>
                        <td>{s.destinationLocationId?.name || String(s.destinationLocationId || '—').slice(-6)}</td>
                        <td>{s.origin || '—'}</td>
                        <td className="text-right">{cfa(totalCost)}</td>
                        <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                        <td className="text-right whitespace-nowrap">
                          {s.status === 'planned' && (
                            <>
                              <button type="button" className="btn-ghost" disabled={busyId === s._id} onClick={() => shipAction(s, 'in_transit')}><Send size={14} /> Transit</button>
                              <button type="button" className="btn-ghost-danger" disabled={busyId === s._id} onClick={() => shipAction(s, 'cancel')}><Ban size={14} /></button>
                            </>
                          )}
                          {s.status === 'in_transit' && (
                            <button type="button" className="btn-ghost" disabled={busyId === s._id} onClick={() => shipAction(s, 'receive')}><PackageCheck size={14} /> Réceptionner</button>
                          )}
                          {['received', 'cancelled'].includes(s.status) && <span className="fui-caption1">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── Factures ── */}
      {tab === 'invoices' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Factures fournisseur</h2>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={() => setShowInvForm((v) => !v)}>
              {showInvForm ? <X size={16} /> : <Plus size={16} />} {showInvForm ? 'Fermer' : 'Nouvelle facture'}
            </button>
          </div>

          {showInvForm && (
            <form onSubmit={createInvoice} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Fournisseur *</span>
                  <select className="form-control" value={invForm.supplierId} onChange={(e) => setInvForm({ ...invForm, supplierId: e.target.value })} required>
                    <option value="">— Choisir —</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">N° de facture *</span>
                  <input type="text" className="form-control" value={invForm.invoiceNumber} onChange={(e) => setInvForm({ ...invForm, invoiceNumber: e.target.value })} required />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Date d'émission</span>
                  <input type="date" className="form-control" value={invForm.issueDate} onChange={(e) => setInvForm({ ...invForm, issueDate: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Échéance</span>
                  <input type="date" className="form-control" value={invForm.dueDate} onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })} />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary"><Receipt size={16} /> Créer la facture</button>
              </div>
            </form>
          )}

          {invoices.length === 0 ? (
            <EmptyState title="Aucune facture fournisseur" description="Comptabilisez vos factures fournisseurs ici." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>N°</th><th>Fournisseur</th><th>Échéance</th>
                    <th className="text-right">Total</th><th className="text-right">Payé</th>
                    <th>Statut</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const st = INV_STATUS[inv.status] || { label: inv.status, tone: 'neutral' };
                    return (
                      <tr key={inv._id}>
                        <td className="font-mono">{inv.invoiceNumber}</td>
                        <td>{supplierName(inv.supplierId)}</td>
                        <td>{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                        <td className="text-right">{cfa(inv.totalAmount)}</td>
                        <td className="text-right">{cfa(inv.paidAmount || 0)}</td>
                        <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                        <td className="text-right whitespace-nowrap">
                          {inv.status === 'draft' && (
                            <>
                              <button type="button" className="btn-ghost" disabled={busyId === inv._id} onClick={() => invoiceAction(inv, 'post')}><Check size={14} /> Comptabiliser</button>
                              <button type="button" className="btn-ghost-danger" disabled={busyId === inv._id} onClick={() => invoiceAction(inv, 'cancel')}><Ban size={14} /></button>
                            </>
                          )}
                          {['posted', 'partially_paid'].includes(inv.status) && (
                            <button type="button" className="btn-ghost" disabled={busyId === inv._id} onClick={() => invoiceAction(inv, 'pay')}><Wallet size={14} /> Payer</button>
                          )}
                          {inv.status === 'paid' && <StatusBadge tone="success"><Check size={12} /> Soldée</StatusBadge>}
                          {inv.status === 'cancelled' && <span className="fui-caption1">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── À payer ── */}
      {tab === 'payables' && (
        <Surface className="p-4">
          <h2 className="fui-subtitle1 mb-4">Dettes fournisseur</h2>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KPICard title="Total facturé" value={cfa(payables.totalInvoiced || 0)} />
            <KPICard title="Total payé" value={cfa(payables.totalPaid || 0)} tone="success" />
            <KPICard title="Reste à payer" value={cfa(payables.totalOutstanding || 0)} tone="danger" />
          </div>
          {(!payables.bySupplier || payables.bySupplier.length === 0) ? (
            <EmptyState title="Aucune dette" description="Toutes les factures fournisseurs sont soldées." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th className="text-right">Facturé</th>
                    <th className="text-right">Payé</th>
                    <th className="text-right">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.bySupplier.map((row, idx) => (
                    <tr key={row.supplierId || idx}>
                      <td>{row.supplierName || supplierName(row.supplierId) || '—'}</td>
                      <td className="text-right">{cfa(row.totalInvoiced || 0)}</td>
                      <td className="text-right">{cfa(row.totalPaid || 0)}</td>
                      <td className="text-right">{cfa(row.outstanding || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
          <p className="fui-caption1 mt-3">
            <Undo2 size={12} className="inline" /> Le règlement s'effectue depuis l'onglet Factures fournisseur.
          </p>
        </Surface>
      )}
    </Workspace>
  );
};

export default PurchaseOrders;
