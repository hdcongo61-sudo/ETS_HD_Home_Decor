import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Boxes, ArrowLeftRight, ClipboardCheck, SlidersHorizontal, Scale, Plus,
  X, Send, PackageCheck, Ban, RefreshCw, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  Workspace, PageHeader, Surface, StatusBadge, KPICard, EmptyState,
  LoadingSkeleton, DataTable,
} from '../components/business';
import { confirmDialog } from '../components/ConfirmProvider';
import { inventoryApi } from '../features/inventory/api';
import { catalogApi } from '../features/catalog/api';
import { platformApi } from '../features/platform/api';
import { formatDate } from '../utils/saleUtils';

const TRANSFER_STATUS = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  submitted: { label: 'Soumis', tone: 'info' },
  shipped: { label: 'Expédié', tone: 'info' },
  received: { label: 'Reçu', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

const COUNT_STATUS = {
  open: { label: 'Ouvert', tone: 'info' },
  posted: { label: 'Publié', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

const TABS = [
  { key: 'balances', label: 'Soldes', icon: Boxes },
  { key: 'transfers', label: 'Transferts', icon: ArrowLeftRight },
  { key: 'counts', label: 'Inventaires', icon: ClipboardCheck },
  { key: 'adjustments', label: 'Ajustements', icon: SlidersHorizontal },
  { key: 'reconciliation', label: 'Rapprochement', icon: Scale },
];

const asList = (data, field) => (Array.isArray(data) ? data : (Array.isArray(data?.[field]) ? data[field] : []));

const InventoryV2 = () => {
  const [tab, setTab] = useState('balances');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [balances, setBalances] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [counts, setCounts] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [movements, setMovements] = useState([]);

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showCountForm, setShowCountForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [countedValues, setCountedValues] = useState({});

  const [transferForm, setTransferForm] = useState({
    sourceLocationId: '', destinationLocationId: '', note: '',
    lines: [{ product: '', quantity: 1 }],
  });
  const [countForm, setCountForm] = useState({ locationId: '', productIds: '', reason: '', note: '' });
  const [adjustForm, setAdjustForm] = useState({ productId: '', quantity: '', unitCost: '', note: '' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bRes, tRes, cRes, rRes, prodRes, locRes, mRes] = await Promise.all([
        inventoryApi.balances({ limit: 500 }),
        inventoryApi.transfers({ limit: 100 }),
        inventoryApi.counts({ limit: 100 }),
        inventoryApi.reconciliation(),
        catalogApi.list({ limit: 500 }),
        platformApi.locations(),
        inventoryApi.movements({ limit: 30 }),
      ]);
      setBalances(asList(bRes.data, 'balances'));
      setTransfers(asList(tRes.data, 'transfers'));
      setCounts(asList(cRes.data, 'counts'));
      setReconciliation(rRes.data);
      setProducts(asList(prodRes.data, 'products'));
      setLocations(asList(locRes.data, 'locations'));
      setMovements(asList(mRes.data, 'movements'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de charger l’inventaire.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const productLabel = (idOrDoc) => {
    if (!idOrDoc) return '—';
    if (idOrDoc.name) return `${idOrDoc.name}${idOrDoc.sku ? ` (${idOrDoc.sku})` : ''}`;
    const found = products.find((p) => String(p._id) === String(idOrDoc));
    return found ? `${found.name}${found.sku ? ` (${found.sku})` : ''}` : String(idOrDoc).slice(-6);
  };

  const locationLabel = (idOrDoc) => {
    if (!idOrDoc) return '—';
    if (idOrDoc.name) return idOrDoc.name;
    const found = locations.find((l) => String(l._id) === String(idOrDoc));
    return found ? found.name : String(idOrDoc).slice(-6);
  };

  // ── Transferts ──
  const createTransfer = async (e) => {
    e.preventDefault();
    if (!transferForm.sourceLocationId || !transferForm.destinationLocationId || transferForm.lines.some((l) => !l.product || Number(l.quantity) <= 0)) {
      toast.error('Boutiques et lignes valides requises.');
      return;
    }
    try {
      await inventoryApi.createTransfer({
        sourceLocationId: transferForm.sourceLocationId,
        destinationLocationId: transferForm.destinationLocationId,
        note: transferForm.note,
        lines: transferForm.lines.map((l) => ({ product: l.product, quantity: Number(l.quantity) })),
      });
      toast.success('Transfert créé.');
      setTransferForm({ sourceLocationId: '', destinationLocationId: '', note: '', lines: [{ product: '', quantity: 1 }] });
      setShowTransferForm(false);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Création impossible.');
    }
  };

  const transferAction = async (transfer, action) => {
    try {
      setBusyId(transfer._id);
      if (action === 'ship') {
        if (!(await confirmDialog('Expédier ce transfert ? Le stock source sera débité.', { confirmLabel: 'Expédier' }))) return;
        await inventoryApi.shipTransfer(transfer._id);
      } else if (action === 'receive') {
        if (!(await confirmDialog('Réceptionner ce transfert ? Le stock destination sera crédité.', { confirmLabel: 'Réceptionner' }))) return;
        await inventoryApi.receiveTransfer(transfer._id);
      } else if (action === 'cancel') {
        if (!(await confirmDialog('Annuler ce transfert ?', { danger: true, confirmLabel: 'Annuler' }))) return;
        await inventoryApi.cancelTransfer(transfer._id);
      }
      toast.success('Action effectuée.');
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Inventaires physiques ──
  const createCount = async (e) => {
    e.preventDefault();
    const productIds = countForm.productIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (!countForm.locationId || productIds.length === 0 || !countForm.reason.trim()) {
      toast.error('Boutique, produits et motif requis.');
      return;
    }
    try {
      await inventoryApi.createCount({
        locationId: countForm.locationId,
        productIds,
        reason: countForm.reason,
        note: countForm.note,
      });
      toast.success('Inventaire physique ouvert.');
      setCountForm({ locationId: '', productIds: '', reason: '', note: '' });
      setShowCountForm(false);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ouverture impossible.');
    }
  };

  const postCount = async (count) => {
    const missing = (count.lines || []).filter((l) => countedValues[String(l.product)] === undefined || countedValues[String(l.product)] === '');
    if (missing.length > 0) {
      toast.error(`Quantité comptée manquante pour ${missing.length} ligne(s).`);
      return;
    }
    if (!(await confirmDialog('Publier cet inventaire ? Les écarts seront appliqués en ajustements.', { confirmLabel: 'Publier' }))) return;
    try {
      setBusyId(count._id);
      const obj = {};
      (count.lines || []).forEach((l) => { obj[String(l.product)] = Number(countedValues[String(l.product)]); });
      await inventoryApi.postCount(count._id, { countedQuantities: obj });
      toast.success('Inventaire publié — écarts appliqués.');
      setCountedValues({});
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publication impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const cancelCount = async (count) => {
    if (!(await confirmDialog('Annuler cet inventaire ?', { danger: true, confirmLabel: 'Annuler' }))) return;
    try {
      setBusyId(count._id);
      await inventoryApi.cancelCount(count._id);
      toast.success('Inventaire annulé.');
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Annulation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Ajustements ──
  const createAdjustment = async (e) => {
    e.preventDefault();
    const qty = Number(adjustForm.quantity);
    if (!adjustForm.productId || !Number.isFinite(qty) || qty === 0) {
      toast.error('Produit et quantité non nulle requis.');
      return;
    }
    try {
      await inventoryApi.adjust({
        productId: adjustForm.productId,
        quantity: qty,
        unitCost: adjustForm.unitCost ? Number(adjustForm.unitCost) : 0,
        note: adjustForm.note,
      });
      toast.success('Ajustement appliqué.');
      setAdjustForm({ productId: '', quantity: '', unitCost: '', note: '' });
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ajustement impossible.');
    }
  };

  const totalOnHand = useMemo(() => balances.reduce((sum, b) => sum + (Number(b.onHand) || 0), 0), [balances]);
  const openCounts = counts.filter((c) => c.status === 'open');
  const shippedTransfers = transfers.filter((t) => t.status === 'shipped');
  const mismatches = reconciliation?.mismatches || [];

  if (loading) {
    return (
      <Workspace>
        <PageHeader eyebrow="Inventaire v2" title="Inventaire" description="Soldes, transferts, inventaires physiques et rapprochement." />
        <LoadingSkeleton rows={6} />
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PageHeader
        eyebrow="Inventaire v2"
        title="Inventaire"
        description="Moteur d'inventaire transactionnel : soldes par boutique, transferts, comptages et rapprochement."
        actions={
          <button type="button" className="ms-button ms-button-secondary ms-button-md" onClick={() => load(true)}>
            <RefreshCw size={16} /> Actualiser
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard title="Stock total" value={totalOnHand} context={`${balances.length} soldes`} />
        <KPICard title="Transferts en route" value={shippedTransfers.length} context={`${transfers.length} au total`} tone="info" />
        <KPICard title="Inventaires ouverts" value={openCounts.length} context="À publier" tone="warning" />
        <KPICard title="Écarts de rapprochement" value={mismatches.length} context={reconciliation?.coherent ? 'Cohérent' : 'À corriger'} tone={reconciliation?.coherent ? 'success' : 'danger'} />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections inventaire">
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

      {/* ── Soldes ── */}
      {tab === 'balances' && (
        <Surface className="p-4">
          <h2 className="fui-subtitle1 mb-4">Soldes par boutique</h2>
          {balances.length === 0 ? (
            <EmptyState title="Aucun solde" description="Aucun mouvement d'inventaire v2 enregistré pour l'instant." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Produit</th><th>Boutique</th>
                    <th className="text-right">En stock</th>
                    <th className="text-right">Réservé</th>
                    <th className="text-right">Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b._id}>
                      <td>{productLabel(b.productId)}</td>
                      <td>{locationLabel(b.locationId)}</td>
                      <td className="text-right">{b.onHand}</td>
                      <td className="text-right">{b.reserved || 0}</td>
                      <td className="text-right">{b.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── Transferts ── */}
      {tab === 'transfers' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Transferts inter-boutiques</h2>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={() => setShowTransferForm((v) => !v)}>
              {showTransferForm ? <X size={16} /> : <Plus size={16} />} {showTransferForm ? 'Fermer' : 'Nouveau transfert'}
            </button>
          </div>

          {showTransferForm && (
            <form onSubmit={createTransfer} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Boutique source *</span>
                  <select className="form-control" value={transferForm.sourceLocationId} onChange={(e) => setTransferForm({ ...transferForm, sourceLocationId: e.target.value })} required>
                    <option value="">— Choisir —</option>
                    {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Boutique destination *</span>
                  <select className="form-control" value={transferForm.destinationLocationId} onChange={(e) => setTransferForm({ ...transferForm, destinationLocationId: e.target.value })} required>
                    <option value="">— Choisir —</option>
                    {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Note</span>
                  <input type="text" className="form-control" value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} />
                </label>
              </div>
              <p className="fui-body1-strong mt-3 mb-2">Lignes</p>
              {transferForm.lines.map((line, idx) => (
                <div key={idx} className="mb-2 grid grid-cols-12 gap-2">
                  <select
                    className="form-control col-span-9"
                    value={line.product}
                    onChange={(e) => setTransferForm({ ...transferForm, lines: transferForm.lines.map((l, i) => (i === idx ? { ...l, product: e.target.value } : l)) })}
                    required
                  >
                    <option value="">— Produit —</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                  </select>
                  <input
                    type="number" min="1" className="form-control col-span-2" placeholder="Qté"
                    value={line.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, lines: transferForm.lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)) })}
                    required
                  />
                  <button
                    type="button" className="btn-ghost-danger col-span-1" aria-label="Retirer la ligne"
                    onClick={() => setTransferForm({ ...transferForm, lines: transferForm.lines.filter((_, i) => i !== idx) })}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button" className="btn-ghost"
                onClick={() => setTransferForm({ ...transferForm, lines: [...transferForm.lines, { product: '', quantity: 1 }] })}
              >
                <Plus size={16} /> Ajouter une ligne
              </button>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary"><ArrowLeftRight size={16} /> Créer le transfert</button>
              </div>
            </form>
          )}

          {transfers.length === 0 ? (
            <EmptyState title="Aucun transfert" description="Transférez du stock entre vos boutiques." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>N°</th><th>Source</th><th>Destination</th><th>Lignes</th>
                    <th>Date</th><th>Statut</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => {
                    const st = TRANSFER_STATUS[t.status] || { label: t.status, tone: 'neutral' };
                    return (
                      <tr key={t._id}>
                        <td className="font-mono">{String(t._id).slice(-6).toUpperCase()}</td>
                        <td>{locationLabel(t.sourceLocationId)}</td>
                        <td>{locationLabel(t.destinationLocationId)}</td>
                        <td>{t.lines?.length || 0}</td>
                        <td>{formatDate(t.createdAt)}</td>
                        <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                        <td className="text-right whitespace-nowrap">
                          {['draft', 'submitted'].includes(t.status) && (
                            <>
                              <button type="button" className="btn-ghost" disabled={busyId === t._id} onClick={() => transferAction(t, 'ship')}><Send size={14} /> Expédier</button>
                              <button type="button" className="btn-ghost-danger" disabled={busyId === t._id} onClick={() => transferAction(t, 'cancel')}><Ban size={14} /></button>
                            </>
                          )}
                          {t.status === 'shipped' && (
                            <button type="button" className="btn-ghost" disabled={busyId === t._id} onClick={() => transferAction(t, 'receive')}><PackageCheck size={14} /> Réceptionner</button>
                          )}
                          {['received', 'cancelled'].includes(t.status) && <span className="fui-caption1">—</span>}
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

      {/* ── Inventaires physiques ── */}
      {tab === 'counts' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Inventaires physiques</h2>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={() => setShowCountForm((v) => !v)}>
              {showCountForm ? <X size={16} /> : <Plus size={16} />} {showCountForm ? 'Fermer' : 'Ouvrir un inventaire'}
            </button>
          </div>

          {showCountForm && (
            <form onSubmit={createCount} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Boutique *</span>
                  <select className="form-control" value={countForm.locationId} onChange={(e) => setCountForm({ ...countForm, locationId: e.target.value })} required>
                    <option value="">— Choisir —</option>
                    {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Motif *</span>
                  <input type="text" className="form-control" value={countForm.reason} onChange={(e) => setCountForm({ ...countForm, reason: e.target.value })} placeholder="Inventaire mensuel…" required />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Note</span>
                  <input type="text" className="form-control" value={countForm.note} onChange={(e) => setCountForm({ ...countForm, note: e.target.value })} />
                </label>
              </div>
              <label className="form-control mt-3">
                <span className="fui-caption1 mb-1">Produits (ids séparés par des virgules) *</span>
                <textarea
                  className="form-control" rows="2"
                  value={countForm.productIds}
                  onChange={(e) => setCountForm({ ...countForm, productIds: e.target.value })}
                  placeholder="67a1…, 67a2…, 67a3…"
                  required
                />
              </label>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary"><ClipboardCheck size={16} /> Ouvrir l'inventaire</button>
              </div>
            </form>
          )}

          {counts.length === 0 ? (
            <EmptyState title="Aucun inventaire" description="Ouvrez un inventaire physique pour compter votre stock." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>N°</th><th>Boutique</th><th>Motif</th><th>Lignes</th>
                    <th>Date</th><th>Statut</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((c) => {
                    const st = COUNT_STATUS[c.status] || { label: c.status, tone: 'neutral' };
                    return (
                      <React.Fragment key={c._id}>
                        <tr>
                          <td className="font-mono">{String(c._id).slice(-6).toUpperCase()}</td>
                          <td>{locationLabel(c.locationId)}</td>
                          <td>{c.reason}</td>
                          <td>{c.lines?.length || 0}</td>
                          <td>{formatDate(c.createdAt)}</td>
                          <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                          <td className="text-right whitespace-nowrap">
                            {c.status === 'open' && (
                              <>
                                <button type="button" className="btn-ghost" disabled={busyId === c._id} onClick={() => postCount(c)}><CheckCircle2 size={14} /> Publier</button>
                                <button type="button" className="btn-ghost-danger" disabled={busyId === c._id} onClick={() => cancelCount(c)}><Ban size={14} /></button>
                              </>
                            )}
                            {c.status !== 'open' && <span className="fui-caption1">—</span>}
                          </td>
                        </tr>
                        {c.status === 'open' && (c.lines || []).length > 0 && (
                          <tr>
                            <td colSpan="7" style={{ background: 'var(--colorNeutralBackground2)' }}>
                              <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-4">
                                {c.lines.map((line) => (
                                  <label key={line.product} className="form-control">
                                    <span className="fui-caption1 mb-1">
                                      {productLabel(line.product)} <span className="opacity-60">(attendu {line.expectedQuantity})</span>
                                    </span>
                                    <input
                                      type="number" min="0" className="form-control" placeholder="Compté"
                                      value={countedValues[String(line.product)] ?? ''}
                                      onChange={(e) => setCountedValues((prev) => ({ ...prev, [String(line.product)]: e.target.value }))}
                                    />
                                  </label>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── Ajustements ── */}
      {tab === 'adjustments' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Ajustement manuel</h2>
            <button type="button" className="ms-button ms-button-secondary ms-button-md" onClick={() => setShowAdjustForm((v) => !v)}>
              {showAdjustForm ? <X size={16} /> : <Plus size={16} />} {showAdjustForm ? 'Fermer' : 'Nouvel ajustement'}
            </button>
          </div>

          {showAdjustForm && (
            <form onSubmit={createAdjustment} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Produit *</span>
                  <select className="form-control" value={adjustForm.productId} onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })} required>
                    <option value="">— Choisir —</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Quantité (positive = entrée, négative = sortie) *</span>
                  <input
                    type="number" className="form-control" placeholder="ex. 10 ou -5"
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                    required
                  />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Coût unitaire (optionnel)</span>
                  <input type="number" min="0" step="0.01" className="form-control" value={adjustForm.unitCost} onChange={(e) => setAdjustForm({ ...adjustForm, unitCost: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Note</span>
                  <input type="text" className="form-control" value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} placeholder="Casse, don, erreur…" />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary"><SlidersHorizontal size={16} /> Appliquer l'ajustement</button>
              </div>
            </form>
          )}

          <h3 className="fui-body1-strong mt-4 mb-2">Derniers mouvements</h3>
          {movements.length === 0 ? (
            <EmptyState title="Aucun mouvement" description="Le journal des mouvements v2 est vide." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Type</th><th>Produit</th>
                    <th className="text-right">Qté</th><th>Référence</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m._id}>
                      <td>{formatDate(m.createdAt)}</td>
                      <td><StatusBadge tone={Number(m.quantity) >= 0 ? 'success' : 'danger'}>{m.type || m.movementType || '—'}</StatusBadge></td>
                      <td>{productLabel(m.productId)}</td>
                      <td className="text-right">{Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity}</td>
                      <td className="font-mono">{m.referenceType || ''} {m.referenceId ? String(m.referenceId).slice(-6) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── Rapprochement ── */}
      {tab === 'reconciliation' && (
        <Surface className="p-4">
          <h2 className="fui-subtitle1 mb-4">Rapprochement Product.stock ↔ registre des soldes</h2>
          {!reconciliation ? (
            <EmptyState title="Rapport indisponible" />
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KPICard title="Produits vérifiés" value={reconciliation.productsChecked} context="Tous les produits du tenant" />
                <KPICard title="Écarts" value={mismatches.length} tone={mismatches.length === 0 ? 'success' : 'danger'} context="Product.stock ≠ Σ balances" />
                <KPICard
                  title="Cohérence"
                  value={reconciliation.coherent ? 'OK' : 'KO'}
                  tone={reconciliation.coherent ? 'success' : 'danger'}
                  context={`Généré le ${formatDate(reconciliation.generatedAt)}`}
                />
              </div>
              {mismatches.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorStatusSuccessBackground1)' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                  <p className="fui-body1" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
                    Le stock hérité et le registre transactionnel sont cohérents.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorStatusWarningBackground1)' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--colorStatusWarningForeground1)' }} />
                    <p className="fui-body1" style={{ color: 'var(--colorStatusWarningForeground1)' }}>
                      {mismatches.length} produit(s) en écart — utilisez un ajustement ou un inventaire physique pour les corriger.
                    </p>
                  </div>
                  <DataTable>
                    <table className="ms-table">
                      <thead>
                        <tr>
                          <th>Produit</th><th>SKU</th>
                          <th className="text-right">Stock hérité</th>
                          <th className="text-right">Registre</th>
                          <th className="text-right">Écart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mismatches.map((m) => (
                          <tr key={m.productId}>
                            <td>{m.name}</td>
                            <td className="font-mono">{m.sku || '—'}</td>
                            <td className="text-right">{m.legacyStock}</td>
                            <td className="text-right">{m.registryTotal}</td>
                            <td className="text-right">
                              <StatusBadge tone={m.difference > 0 ? 'danger' : 'warning'}>
                                {m.difference > 0 ? `+${m.difference}` : m.difference}
                              </StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DataTable>
                </>
              )}
            </>
          )}
        </Surface>
      )}
    </Workspace>
  );
};

export default InventoryV2;
