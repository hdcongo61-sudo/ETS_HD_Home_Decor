import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { formatCfa } from '../utils/format';

const STATUS = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Envoyé', cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepté', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulé', cls: 'bg-gray-100 text-gray-500' },
  converted: { label: 'Converti', cls: 'bg-violet-100 text-violet-700' },
  expired: { label: 'Expiré', cls: 'bg-amber-100 text-amber-700' },
};

const normalize = (value, keys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
};

const emptyLine = () => ({ product: '', quantity: 1, price: 0 });

const Devis = () => {
  const [devis, setDevis] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client: '',
    note: '',
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    lines: [emptyLine()],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [devisRes, clientsRes, productsRes] = await Promise.all([
        api.get('/devis'),
        api.get('/clients'),
        api.get('/products'),
      ]);
      setDevis(normalize(devisRes.data, ['devis', 'data']));
      setClients(normalize(clientsRes.data, ['clients', 'data']));
      setProducts(normalize(productsRes.data, ['products', 'data']));
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les devis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(
    () =>
      form.lines.reduce(
        (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.price) || 0),
        0
      ),
    [form.lines]
  );

  const updateLine = (index, field, value) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...prev, lines };
    });
  };

  const addLine = () => setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  const removeLine = (index) =>
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter((_, i) => i !== index) : prev.lines,
    }));

  const submitDevis = async (e) => {
    e.preventDefault();
    if (!form.client) {
      toast.error('Sélectionnez un client');
      return;
    }
    const lines = form.lines
      .filter((line) => line.product)
      .map((line) => ({
        product: line.product,
        quantity: Number(line.quantity) || 1,
        price: Number(line.price) || 0,
      }));
    if (lines.length === 0) {
      toast.error('Ajoutez au moins un produit');
      return;
    }

    setSaving(true);
    try {
      await api.post('/devis', {
        client: form.client,
        validUntil: form.validUntil,
        note: form.note,
        products: lines,
      });
      toast.success('Devis créé');
      setForm({
        client: '',
        note: '',
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        lines: [emptyLine()],
      });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/devis/${id}/status`, { status });
      toast.success('Statut mis à jour');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de mise à jour');
    }
  };

  const convert = async (id) => {
    try {
      const { data } = await api.post(`/devis/${id}/convert`);
      toast.success(`Proforma ${data.proforma?.reference || ''} créée`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de conversion');
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/devis/${id}`);
      toast.success('Devis supprimé');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression');
    }
  };

  const inputBase =
    'form-control w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400';

  const statusOf = (d) => (d.derivedExpired && ['draft', 'sent'].includes(d.status) ? 'expired' : d.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]"
          style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}
        >
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>
            Devis
          </h1>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Pipeline devis → proforma → vente.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={load} className="ms-button ms-button-secondary min-h-[44px]">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="ms-button ms-button-primary min-h-[44px]">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Fermer' : 'Nouveau devis'}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--ms-danger)]">{error}</p>}

      {showForm && (
        <form onSubmit={submitDevis} className="fluent-card-filled space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Client</label>
              <select className={inputBase} value={form.client} onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}>
                <option value="">Sélectionner un client…</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Valable jusqu’au</label>
              <input type="date" className={inputBase} value={form.validUntil} onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            {form.lines.map((line, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3 sm:grid-cols-[1fr_100px_120px_auto]">
                <select className={inputBase} value={line.product} onChange={(e) => {
                  const product = products.find((p) => p._id === e.target.value);
                  updateLine(index, 'product', e.target.value);
                  if (product) updateLine(index, 'price', product.price || 0);
                }}>
                  <option value="">Produit…</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
                <input type="number" min="1" className={inputBase} placeholder="Qté" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} />
                <input type="number" min="0" step="0.01" className={inputBase} placeholder="Prix" value={line.price} onChange={(e) => updateLine(index, 'price', e.target.value)} />
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
            <div className="text-sm">Total : <strong>{formatCfa(total)}</strong></div>
          </div>

          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Note</label>
            <textarea className={`${inputBase} min-h-[70px] resize-y`} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </div>

          <button type="submit" disabled={saving} className="ms-button ms-button-primary min-h-[44px] justify-center disabled:opacity-60">
            {saving ? 'Création…' : 'Créer le devis'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
      ) : devis.length === 0 ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucun devis pour le moment.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)]">
          <table className="min-w-full divide-y divide-[var(--ms-border)]">
            <thead className="bg-[var(--ms-bg-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Référence</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Client</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Total</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Statut</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Valable jusqu’au</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ms-border)]">
              {devis.map((d) => {
                const status = statusOf(d);
                const st = STATUS[status] || STATUS.draft;
                return (
                  <tr key={d._id}>
                    <td className="px-3 py-2 text-sm font-semibold">{d.reference}</td>
                    <td className="px-3 py-2 text-sm">{d.client?.name || '—'}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(d.totalAmount)}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">{new Date(d.validUntil).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        {d.status === 'draft' && (
                          <button type="button" onClick={() => setStatus(d._id, 'sent')} className="ms-button ms-button-secondary ms-button-sm">Envoyer</button>
                        )}
                        {(d.status === 'draft' || d.status === 'sent') && (
                          <button type="button" onClick={() => setStatus(d._id, 'accepted')} className="ms-button ms-button-secondary ms-button-sm">Accepter</button>
                        )}
                        {d.status === 'sent' && (
                          <button type="button" onClick={() => setStatus(d._id, 'rejected')} className="ms-button ms-button-secondary ms-button-sm">Rejeter</button>
                        )}
                        {d.status === 'accepted' && (
                          <button type="button" onClick={() => convert(d._id)} className="ms-button ms-button-primary ms-button-sm">Convertir</button>
                        )}
                        {d.status !== 'converted' && (
                          <button type="button" onClick={() => remove(d._id)} className="ms-icon-button" aria-label="Supprimer">
                            <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Devis;
