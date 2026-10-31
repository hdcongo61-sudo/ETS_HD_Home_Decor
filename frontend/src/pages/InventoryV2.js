import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Boxes, ArrowLeftRight, ClipboardCheck, SlidersHorizontal, Scale, Plus,
  X, Send, PackageCheck, Ban, RefreshCw, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  Workspace, PageHeader, Surface, StatusBadge, KPICard, EmptyState,
  DataTable,
} from '../components/business';
import { confirmDialog } from '../components/ConfirmProvider';
import { inventoryApi } from '../features/inventory/api';
import { useTranslation } from 'react-i18next';
import { catalogApi } from '../features/catalog/api';
import { platformApi } from '../features/platform/api';
import InventoryAdjustmentForm from '../components/stock/InventoryAdjustmentForm';
import AuthContext from '../context/AuthContext';
import { useLocations } from '../context/LocationContext';
import { formatDate } from '../utils/saleUtils';
import useInventorySection from './inventory-shared/useInventorySection';
import InventorySectionState from './inventory-shared/InventorySectionState';

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

const InventoryWorkspace = ({ auth }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('balances');
  const { activeLocationId } = useLocations() || {};
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showCountForm, setShowCountForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [countedValues, setCountedValues] = useState({});

  const [transferForm, setTransferForm] = useState({
    sourceLocationId: '', destinationLocationId: '', note: '',
    lines: [{ product: '', quantity: 1 }],
  });
  const [countForm, setCountForm] = useState({ locationId: '', productIds: '', reason: '', note: '' });


  const balancesSection = useInventorySection(useCallback(async () => asList((await inventoryApi.balances({ limit: 500 })).data, 'balances'), []), []);
  const transfersSection = useInventorySection(useCallback(async () => asList((await inventoryApi.transfers({ limit: 100 })).data, 'transfers'), []), []);
  const countsSection = useInventorySection(useCallback(async () => asList((await inventoryApi.counts({ limit: 100 })).data, 'counts'), []), []);
  const movementsSection = useInventorySection(useCallback(async () => asList((await inventoryApi.movements({ limit: 30 })).data, 'movements'), []), []);
  const reconciliationSection = useInventorySection(useCallback(async () => (await inventoryApi.reconciliation()).data, []), null);
  const lookupsSection = useInventorySection(useCallback(async () => {
    const [products, locations] = await Promise.all([catalogApi.list({ limit: 500 }), platformApi.locations()]);
    return { products: asList(products.data, 'products'), locations: asList(locations.data, 'locations') };
  }, []), { products: [], locations: [] });
  const { data: balances, reload: loadBalances } = balancesSection;
  const { data: transfers, reload: loadTransfers } = transfersSection;
  const { data: counts, reload: loadCounts } = countsSection;
  const { data: movements, reload: loadMovements } = movementsSection;
  const { data: reconciliation, reload: loadReconciliation } = reconciliationSection;
  const { data: { products, locations }, reload: loadLookups } = lookupsSection;
  const permissionsSection = useInventorySection(useCallback(async () => {
    if (auth.isAdmin || auth.isSuperAdmin) return { permissions: ['*'], allLocations: true };
    const response = await platformApi.myMemberships();
    return asList(response.data, 'memberships').find(membership => String(membership.tenantId?._id || membership.tenantId) === String(auth.tenantId) && membership.status === 'active') || { permissions: [] };
  }, [auth.isAdmin, auth.isSuperAdmin, auth.tenantId]), { permissions: [] });
  const { reload: loadPermissions } = permissionsSection;
  const can = permission => !sessionStorage.getItem('impersonating') && permissionsSection.loaded && !permissionsSection.error && (permissionsSection.data.permissions?.includes('*') || permissionsSection.data.permissions?.includes(permission));
  const canTransfer = can('inventory.transfer');
  const canCount = can('inventory.count');
  const refreshing = [balancesSection, transfersSection, countsSection, movementsSection, reconciliationSection, lookupsSection, permissionsSection].some(section => section.pending);
  const metric = (section, value) => section.loaded ? value : '—';
  const freshness = (section, context) => !section.loaded ? 'Indisponible' : section.error || section.pending ? 'Données à actualiser' : context;

  // Chargement complet (montage + bouton « Actualiser »).
  const loadAll = useCallback(async () => {
    await Promise.all([
      loadLookups(), loadBalances(), loadTransfers(), loadCounts(),
      loadReconciliation(), loadMovements(), loadPermissions(),
    ]);
  }, [loadLookups, loadBalances, loadTransfers, loadCounts, loadReconciliation, loadMovements, loadPermissions]);

  useEffect(() => { loadAll(); }, [loadAll]);

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
    if (!canTransfer || !lookupsReady) return;
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
      await loadTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Création impossible.');
    }
  };

  const transferAction = async (transfer, action) => {
    if (!canTransfer) return;
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
      if (action === 'cancel') {
        // Annulation : seul le statut du transfert change, le stock reste inchangé.
        await loadTransfers();
      } else {
        // Expédition/réception : le stock bouge — soldes, transferts, mouvements et rapprochement.
        await Promise.all([loadTransfers(), loadBalances(), loadMovements(), loadReconciliation()]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Inventaires physiques ──
  const createCount = async (e) => {
    e.preventDefault();
    if (!canCount || !lookupsReady) return;
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
      await loadCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ouverture impossible.');
    }
  };

  const postCount = async (count) => {
    if (!canCount) return;
    const missing = (count.lines || []).filter((l) => countedValues[String(count._id)]?.[String(l.product?._id || l.product)] === undefined || countedValues[String(count._id)]?.[String(l.product?._id || l.product)] === '');
    if (missing.length > 0) {
      toast.error(`Quantité comptée manquante pour ${missing.length} ligne(s).`);
      return;
    }
    if (!(await confirmDialog('Publier cet inventaire ? Les écarts seront appliqués en ajustements.', { confirmLabel: 'Publier' }))) return;
    try {
      setBusyId(count._id);
      const obj = {};
      (count.lines || []).forEach((l) => { obj[String(l.product?._id || l.product)] = Number(countedValues[String(count._id)]?.[String(l.product?._id || l.product)]); });
      await inventoryApi.postCount(count._id, { countedQuantities: obj });
      toast.success('Inventaire publié — écarts appliqués.');
      setCountedValues(previous => { const next = { ...previous }; delete next[String(count._id)]; return next; });
      // Écarts appliqués en ajustements : comptages, soldes, mouvements et rapprochement bougent.
      await Promise.all([loadCounts(), loadBalances(), loadMovements(), loadReconciliation()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publication impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const cancelCount = async (count) => {
    if (!canCount) return;
    if (!(await confirmDialog('Annuler cet inventaire ?', { danger: true, confirmLabel: 'Annuler' }))) return;
    try {
      setBusyId(count._id);
      await inventoryApi.cancelCount(count._id);
      toast.success('Inventaire annulé.');
      await loadCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Annulation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Ajustements ──
  const adjustmentLocation = activeLocationId
    ? locations.find(location => String(location._id) === String(activeLocationId) && location.isActive !== false)
    : [...locations].filter(location => location.isActive !== false).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  const permissionData = permissionsSection.data;
  const canAdjust = can('inventory.adjust') && (permissionData.permissions?.includes('*') || permissionData.allLocations || (permissionData.locationIds || []).some(id => String(id?._id || id) === String(adjustmentLocation?._id)));
  const lookupsReady = lookupsSection.loaded && !lookupsSection.error && !lookupsSection.pending;
  const readOnlyMessage = <p className="fui-body1 mb-3">Consultation uniquement : votre rôle ne permet pas de modifier cette section. Contactez un administrateur pour obtenir cet accès.</p>;
  const adjustmentSaved = () => {
    Promise.all([loadBalances(), loadMovements(), loadReconciliation()]);
    window.dispatchEvent(new CustomEvent('productStockChanged'));
  };

  const totalOnHand = useMemo(() => balances.reduce((sum, b) => sum + (Number(b.onHand) || 0), 0), [balances]);
  const openCounts = counts.filter((c) => c.status === 'open');
  const shippedTransfers = transfers.filter((t) => t.status === 'shipped');
  const mismatches = reconciliation?.mismatches || [];


  return (
    <Workspace>
      <PageHeader
        eyebrow={t('inventory.eyebrow', 'Inventaire v2')}
        title={t('inventory.title', 'Inventaire')}
        description="Moteur d'inventaire transactionnel : soldes par boutique, transferts, comptages et rapprochement."
        actions={
          <button type="button" className="ms-button ms-button-secondary ms-button-md" disabled={adjustBusy || refreshing} onClick={() => loadAll()}>
            <RefreshCw size={16} /> {refreshing ? t('inventory.refreshing', 'Actualisation…') : t('inventory.refresh', 'Actualiser')}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard title={t('inventory.stockTotal', 'Stock total')} value={metric(balancesSection, totalOnHand)} context={freshness(balancesSection, balances.length + ' soldes')} />
        <KPICard title={t('inventory.transfersInRoute', 'Transferts en route')} value={metric(transfersSection, shippedTransfers.length)} context={freshness(transfersSection, transfers.length + ' au total')} tone="info" />
        <KPICard title={t('inventory.openCounts', 'Inventaires ouverts')} value={metric(countsSection, openCounts.length)} context={freshness(countsSection, 'À publier')} tone="warning" />
        <KPICard title={t('inventory.reconciliationGaps', 'Écarts de rapprochement')} value={metric(reconciliationSection, mismatches.length)} context={freshness(reconciliationSection, reconciliation?.coherent ? 'Cohérent' : 'À corriger')} tone={!reconciliationSection.loaded || reconciliationSection.error || reconciliationSection.pending ? 'neutral' : reconciliation?.coherent ? 'success' : 'danger'} />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections inventaire">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            disabled={adjustBusy} onClick={() => setTab(key)}
            className={tab === key ? 'ms-button ms-button-primary ms-button-md' : 'ms-button ms-button-secondary ms-button-md'}
          >
            <Icon size={16} /> {t('inventory.' + key, label)}
          </button>
        ))}
      </div>

      <InventorySectionState section={permissionsSection} />

      {/* ── Soldes ── */}
      {tab === 'balances' && (
        <Surface className="p-4">
          <h2 className="fui-subtitle1 mb-4">{t('inventory.balancesByShop', 'Soldes par boutique')}</h2>
          <InventorySectionState section={balancesSection}>
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
          </InventorySectionState>
        </Surface>
      )}

      {/* ── Transferts ── */}
      {tab === 'transfers' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Transferts inter-boutiques</h2>
            {canTransfer && (
            <button type="button" className="ms-button ms-button-primary ms-button-md" disabled={!lookupsReady} onClick={() => setShowTransferForm((v) => !v)}>
              {showTransferForm ? <X size={16} /> : <Plus size={16} />} {showTransferForm ? 'Fermer' : 'Nouveau transfert'}
            </button>
            )}
          </div>
          {!canTransfer && permissionsSection.loaded && !permissionsSection.error && readOnlyMessage}
          <InventorySectionState section={lookupsSection} />

          {canTransfer && lookupsSection.loaded && showTransferForm && (
            <fieldset disabled={!lookupsReady} className="min-w-0">
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
            </fieldset>
          )}

          <InventorySectionState section={transfersSection}>
          {transfers.length === 0 ? (
            <EmptyState title="Aucun transfert" description={canTransfer ? 'Transférez du stock entre vos boutiques.' : 'Aucun transfert enregistré.'} />
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
                          {canTransfer && ['draft', 'submitted'].includes(t.status) && (
                            <>
                              <button type="button" className="btn-ghost" disabled={busyId === t._id} onClick={() => transferAction(t, 'ship')}><Send size={14} /> Expédier</button>
                              <button type="button" className="btn-ghost-danger" disabled={busyId === t._id} aria-label="Annuler le transfert" onClick={() => transferAction(t, 'cancel')}><Ban size={14} /></button>
                            </>
                          )}
                          {canTransfer && t.status === 'shipped' && (
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
          </InventorySectionState>
        </Surface>
      )}

      {/* ── Inventaires physiques ── */}
      {tab === 'counts' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Inventaires physiques</h2>
            {canCount && (
            <button type="button" className="ms-button ms-button-primary ms-button-md" disabled={!lookupsReady} onClick={() => setShowCountForm((v) => !v)}>
              {showCountForm ? <X size={16} /> : <Plus size={16} />} {showCountForm ? 'Fermer' : 'Ouvrir un inventaire'}
            </button>
            )}
          </div>
          {!canCount && permissionsSection.loaded && !permissionsSection.error && readOnlyMessage}
          <InventorySectionState section={lookupsSection} />

          {canCount && lookupsSection.loaded && showCountForm && (
            <fieldset disabled={!lookupsReady} className="min-w-0">
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
            </fieldset>
          )}

          <InventorySectionState section={countsSection}>
          {counts.length === 0 ? (
            <EmptyState title="Aucun inventaire" description={canCount ? 'Ouvrez un inventaire physique pour compter votre stock.' : 'Aucun inventaire physique enregistré.'} />
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
                            {canCount && c.status === 'open' && (
                              <>
                                <button type="button" className="btn-ghost" disabled={busyId === c._id} onClick={() => postCount(c)}><CheckCircle2 size={14} /> Publier</button>
                                <button type="button" className="btn-ghost-danger" disabled={busyId === c._id} aria-label="Annuler l’inventaire" onClick={() => cancelCount(c)}><Ban size={14} /></button>
                              </>
                            )}
                            {c.status !== 'open' && <span className="fui-caption1">—</span>}
                          </td>
                        </tr>
                        {canCount && c.status === 'open' && (c.lines || []).length > 0 && (
                          <tr>
                            <td colSpan="7" style={{ background: 'var(--colorNeutralBackground2)' }}>
                              <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-4">
                                {c.lines.map((line) => (
                                  <label key={String(line.product?._id || line.product)} className="form-control">
                                    <span className="fui-caption1 mb-1">
                                      {productLabel(line.product)} <span className="opacity-60">(attendu {line.expectedQuantity})</span>
                                    </span>
                                    <input
                                      type="number" min="0" className="form-control" placeholder="Compté"
                                      value={countedValues[String(c._id)]?.[String(line.product?._id || line.product)] ?? ''}
                                      onChange={(e) => setCountedValues((prev) => ({ ...prev, [String(c._id)]: { ...prev[String(c._id)], [String(line.product?._id || line.product)]: e.target.value } }))}
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
          </InventorySectionState>
        </Surface>
      )}

      {/* ── Ajustements ── */}
      {tab === 'adjustments' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Ajustement manuel</h2>
            {canAdjust && (
            <button type="button" className="ms-button ms-button-secondary ms-button-md" disabled={adjustBusy || !lookupsReady} onClick={() => setShowAdjustForm((v) => !v)}>
              {showAdjustForm ? <X size={16} /> : <Plus size={16} />} {showAdjustForm ? 'Fermer' : 'Nouvel ajustement'}
            </button>
            )}
          </div>
          {!canAdjust && permissionsSection.loaded && !permissionsSection.error && readOnlyMessage}
          <InventorySectionState section={lookupsSection} />

          {canAdjust && lookupsSection.loaded && showAdjustForm && <fieldset disabled={!lookupsReady} className="min-w-0"><InventoryAdjustmentForm key={adjustmentLocation?._id || "no-location"} products={products} location={adjustmentLocation} onSaved={adjustmentSaved} onBusyChange={setAdjustBusy} /></fieldset>}

          <h3 className="fui-body1-strong mt-4 mb-2">Derniers mouvements</h3>
          <InventorySectionState section={movementsSection}>
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
          </InventorySectionState>
        </Surface>
      )}

      {/* ── Rapprochement ── */}
      {tab === 'reconciliation' && (
        <Surface className="p-4">
          <h2 className="fui-subtitle1 mb-4">Rapprochement Product.stock ↔ registre des soldes</h2>
          <InventorySectionState section={reconciliationSection}>
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
          </InventorySectionState>
        </Surface>
      )}
    </Workspace>
  );
};

// Changing shop or user must never retain the preceding account's data.
const InventoryV2 = () => {
  const { auth } = useContext(AuthContext);
  return <InventoryWorkspace key={String(auth.tenantId) + ':' + String(auth.user?._id)} auth={auth} />;
};

export default InventoryV2;
