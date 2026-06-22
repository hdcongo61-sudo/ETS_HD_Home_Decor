import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Download, Edit3, FileText, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { getCompanyIdentity } from '../utils/appBranding';
import { generateProformaPdf } from '../utils/proformaPdf';
import { confirmDialog } from './ConfirmProvider';
import Modal from './Modal';

const STATUS_META = {
  draft: { label: 'Brouillon', className: 'ms-status-neutral' },
  sent: { label: 'Envoyée', className: 'ms-status-info' },
  converted: { label: 'Convertie', className: 'ms-status-success' },
  cancelled: { label: 'Annulée', className: 'ms-status-danger' },
};

const formatAmount = (value) => `${Number(value || 0).toLocaleString('fr-FR')} CFA`;
const dateInputValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '';
};

const toPdfPayload = (proforma, company, sellerName) => ({
  client: proforma.client || {},
  items: (proforma.products || []).map((item) => ({
    name: item.productName || item.product?.name || 'Produit',
    quantity: item.quantity,
    price: item.price,
  })),
  note: proforma.note,
  validUntil: proforma.validUntil,
  sellerName: proforma.createdBy?.name || sellerName,
  company,
  reference: proforma.reference,
  issueDate: proforma.createdAt,
});

const ProformaHistory = ({ clients = [], products = [] }) => {
  const { auth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const company = getCompanyIdentity(appSettings.branding);
  const [proformas, setProformas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [editing, setEditing] = useState(null);
  const [editClient, setEditClient] = useState('');
  const [editProducts, setEditProducts] = useState([]);
  const [editNote, setEditNote] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');

  const loadProformas = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/proformas');
      setProformas(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de charger les proformas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProformas();
    const refresh = () => loadProformas();
    window.addEventListener('proformaCreated', refresh);
    return () => window.removeEventListener('proformaCreated', refresh);
  }, [loadProformas]);

  const summary = useMemo(
    () => ({
      active: proformas.filter((item) => ['draft', 'sent'].includes(item.status)).length,
      total: proformas
        .filter((item) => ['draft', 'sent'].includes(item.status))
        .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    }),
    [proformas]
  );

  const openEdit = (proforma) => {
    setEditing(proforma);
    setEditClient(proforma.client?._id || proforma.client || '');
    setEditProducts(
      (proforma.products || []).map((item) => ({
        product: item.product?._id || item.product || '',
        quantity: item.quantity,
        price: item.price,
      }))
    );
    setEditNote(proforma.note || '');
    setEditValidUntil(dateInputValue(proforma.validUntil));
  };

  const updateEditLine = (index, patch) => {
    setEditProducts((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        if (patch.product) {
          const product = products.find((item) => item._id === patch.product);
          next.price = Number(product?.price || 0);
        }
        return next;
      })
    );
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    try {
      setWorkingId(editing._id);
      const { data } = await api.put(`/proformas/${editing._id}`, {
        client: editClient,
        products: editProducts,
        note: editNote,
        validUntil: editValidUntil,
      });
      setProformas((current) => current.map((item) => (item._id === data._id ? data : item)));
      setEditing(null);
      toast.success('Proforma mise à jour.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Modification impossible.');
    } finally {
      setWorkingId('');
    }
  };

  const convertToSale = async (proforma) => {
    const confirmed = await confirmDialog(
      `Convertir ${proforma.reference} en vente ? Le stock sera déduit uniquement après confirmation.`
    );
    if (!confirmed) return;
    try {
      setWorkingId(proforma._id);
      const { data: sale } = await api.post('/sales', {
        client: proforma.client?._id || proforma.client,
        products: (proforma.products || []).map((item) => ({
          product: item.product?._id || item.product,
          quantity: item.quantity,
          price: item.price,
        })),
        paymentMethod: 'credit',
        initialPaymentAmount: 0,
        note: `Conversion de ${proforma.reference}${proforma.note ? ` — ${proforma.note}` : ''}`,
        proformaId: proforma._id,
      });
      await loadProformas();
      window.dispatchEvent(new CustomEvent('saleCreated', { detail: sale }));
      toast.success('Proforma convertie en vente. Le stock a été mis à jour.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Conversion impossible.');
    } finally {
      setWorkingId('');
    }
  };

  const deleteProforma = async (proforma) => {
    if (!(await confirmDialog(`Supprimer ${proforma.reference} ?`))) return;
    try {
      setWorkingId(proforma._id);
      await api.delete(`/proformas/${proforma._id}`);
      setProformas((current) => current.filter((item) => item._id !== proforma._id));
      toast.success('Proforma supprimée.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Suppression impossible.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <section className="fluent-card-filled overflow-hidden" aria-labelledby="proforma-history-title">
      <div className="flex flex-col gap-3 border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="proforma-history-title" className="fui-subtitle1 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Proformas
          </h2>
          <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
            {summary.active} active(s) · {formatAmount(summary.total)} · aucun impact stock avant conversion
          </p>
        </div>
        <button type="button" onClick={loadProformas} className="ms-button ms-button-secondary ms-button-sm">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      <div className="p-5">
        {loading ? (
          <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
        ) : proformas.length === 0 ? (
          <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Aucune proforma enregistrée. Utilisez le mode « Proforma » dans le formulaire de vente.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {proformas.map((proforma) => {
              const meta = STATUS_META[proforma.status] || STATUS_META.draft;
              const disabled = workingId === proforma._id;
              const editable = proforma.status !== 'converted';
              return (
                <article key={proforma._id} className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="fui-body1-strong truncate">{proforma.reference}</p>
                      <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        {proforma.client?.name || 'Client inconnu'} · {new Date(proforma.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className={`ms-status-badge ${meta.className}`}>{meta.label}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="fui-title3">{formatAmount(proforma.totalAmount)}</p>
                      <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        {(proforma.products || []).length} article(s) · valable jusqu’au {new Date(proforma.validUntil).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => generateProformaPdf(toPdfPayload(proforma, company, auth?.user?.name))}
                      className="ms-button ms-button-secondary ms-button-sm"
                    >
                      <Download className="h-4 w-4" /> PDF
                    </button>
                    {editable && (
                      <button type="button" disabled={disabled} onClick={() => openEdit(proforma)} className="ms-button ms-button-secondary ms-button-sm">
                        <Edit3 className="h-4 w-4" /> Modifier
                      </button>
                    )}
                    {editable && (
                      <button type="button" disabled={disabled} onClick={() => convertToSale(proforma)} className="ms-button ms-button-primary ms-button-sm">
                        <ShoppingCart className="h-4 w-4" /> Convertir en vente
                      </button>
                    )}
                    {editable && (
                      <button type="button" disabled={disabled} onClick={() => deleteProforma(proforma)} className="ms-button ms-button-danger ms-button-sm">
                        <Trash2 className="h-4 w-4" /> Supprimer
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Modifier la proforma" size="lg" mobileFullscreen>
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="form-label">Client</label>
              <select className="form-control mt-1" value={editClient} onChange={(event) => setEditClient(event.target.value)} required>
                <option value="">Sélectionner…</option>
                {clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              {editProducts.map((line, index) => (
                <div key={`${line.product}-${index}`} className="grid gap-2 rounded-[var(--radiusMedium)] border border-[var(--ms-border)] p-3 sm:grid-cols-[1fr_110px_140px_auto]">
                  <select className="form-control" value={line.product} onChange={(event) => updateEditLine(index, { product: event.target.value })} required>
                    <option value="">Produit…</option>
                    {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                  </select>
                  <input className="form-control" type="number" min="1" value={line.quantity} onChange={(event) => updateEditLine(index, { quantity: Number(event.target.value) })} required />
                  <input className="form-control" type="number" min="0" value={line.price} onChange={(event) => updateEditLine(index, { price: Number(event.target.value) })} required />
                  <button type="button" onClick={() => setEditProducts((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="ms-button ms-button-danger ms-button-sm">Retirer</button>
                </div>
              ))}
              <button type="button" onClick={() => setEditProducts((current) => [...current, { product: '', quantity: 1, price: 0 }])} className="ms-button ms-button-secondary ms-button-sm">
                Ajouter un produit
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Valable jusqu’au</label>
                <input className="form-control mt-1" type="date" value={editValidUntil} onChange={(event) => setEditValidUntil(event.target.value)} required />
              </div>
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-control mt-1 min-h-[76px]" value={editNote} onChange={(event) => setEditNote(event.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="ms-button ms-button-secondary ms-button-md">Annuler</button>
              <button type="submit" disabled={workingId === editing._id || editProducts.length === 0} className="ms-button ms-button-primary ms-button-md">Enregistrer</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
};

export default ProformaHistory;
