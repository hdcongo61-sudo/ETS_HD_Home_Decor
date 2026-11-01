import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, Calculator, Plus, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { formatCfa } from '../utils/format';

const FixedAssets = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null); // { asset, schedule }
  const [form, setForm] = useState({
    name: '',
    category: '',
    cost: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    usefulLifeYears: 5,
    salvageValue: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/assets');
      setAssets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les immobilisations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/assets', {
        name: form.name,
        category: form.category,
        cost: Number(form.cost),
        purchaseDate: form.purchaseDate,
        usefulLifeYears: Number(form.usefulLifeYears) || 5,
        salvageValue: Number(form.salvageValue) || 0,
      });
      toast.success('Immobilisation créée');
      setForm({
        name: '', category: '', cost: '',
        purchaseDate: new Date().toISOString().slice(0, 10),
        usefulLifeYears: 5, salvageValue: 0,
      });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    try {
      const { data } = await api.get(`/assets/${id}`);
      setDetail(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de chargement');
    }
  };

  const depreciate = async (id) => {
    try {
      const { data } = await api.post(`/assets/${id}/depreciate`, {});
      toast.success(`Amortissement comptabilisé (${data.entry?.entryNumber || ''})`);
      await load();
      if (detail) setDetail(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de comptabilisation');
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/assets/${id}`);
      toast.success('Immobilisation supprimée');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression');
    }
  };

  const inputBase =
    'form-control w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
          <Boxes className="h-5 w-5" />
        </span>
        <div>
          <h1 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Immobilisations</h1>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Actifs fixes et amortissement linéaire, comptabilisés dans le grand livre.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => setShowForm((v) => !v)} className="ms-button ms-button-primary min-h-[44px]">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Fermer' : 'Nouvelle immobilisation'}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--ms-danger)]">{error}</p>}

      {showForm && (
        <form onSubmit={submit} className="fluent-card-filled grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Nom</label>
            <input type="text" className={inputBase} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Catégorie</label>
            <input type="text" className={inputBase} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Matériel, véhicule…" />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Coût d’acquisition</label>
            <input type="number" min="0" step="0.01" className={inputBase} value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} required />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Date d’acquisition</label>
            <input type="date" className={inputBase} value={form.purchaseDate} onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Durée de vie (ans)</label>
            <input type="number" min="1" className={inputBase} value={form.usefulLifeYears} onChange={(e) => setForm((p) => ({ ...p, usefulLifeYears: e.target.value }))} />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Valeur résiduelle</label>
            <input type="number" min="0" step="0.01" className={inputBase} value={form.salvageValue} onChange={(e) => setForm((p) => ({ ...p, salvageValue: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving} className="ms-button ms-button-primary min-h-[44px] justify-center disabled:opacity-60 sm:col-span-3">
            {saving ? 'Création…' : 'Créer l’immobilisation'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
      ) : assets.length === 0 ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucune immobilisation enregistrée.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)]">
          <table className="min-w-full divide-y divide-[var(--ms-border)]">
            <thead className="bg-[var(--ms-bg-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Nom</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Catégorie</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Coût</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Amorti</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">VNC</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ms-border)]">
              {assets.map((asset) => (
                <tr key={asset._id}>
                  <td className="px-3 py-2 text-sm font-semibold">{asset.name}</td>
                  <td className="px-3 py-2 text-sm text-[var(--ms-text-muted)]">{asset.category || '—'}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(asset.cost)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(asset.accumulatedDepreciation)}</td>
                  <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">{formatCfa(asset.netBookValue)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => openDetail(asset._id)} className="ms-button ms-button-secondary ms-button-sm">
                        <Calculator className="h-4 w-4" /> Plan
                      </button>
                      {asset.status === 'active' && asset.remainingBase > 0 && (
                        <button type="button" onClick={() => depreciate(asset._id)} className="ms-button ms-button-primary ms-button-sm">
                          Amortir
                        </button>
                      )}
                      <button type="button" onClick={() => remove(asset._id)} className="ms-icon-button" aria-label="Supprimer">
                        <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fluent-card-filled space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>
              Plan d’amortissement — {detail.name}
            </h2>
            <button type="button" onClick={() => setDetail(null)} className="ms-icon-button" aria-label="Fermer"><X className="h-4 w-4" /></button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--ms-border)]">
            <table className="min-w-full divide-y divide-[var(--ms-border)]">
              <thead className="bg-[var(--ms-bg-subtle)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--ms-text-muted)]">Exercice</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-[var(--ms-text-muted)]">Dotation</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-[var(--ms-text-muted)]">Cumul</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-[var(--ms-text-muted)]">VNC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ms-border)]">
                {(detail.schedule || []).map((row) => (
                  <tr key={row.year}>
                    <td className="px-3 py-2 text-sm font-semibold tabular-nums">{row.year}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(row.depreciation)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(row.accumulated)}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">{formatCfa(row.netBookValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedAssets;
