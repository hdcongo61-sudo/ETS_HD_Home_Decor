import { formatCfa } from '../utils/format';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Tag, Trash2 } from 'lucide-react';
import api from '../services/api';

// Gestion des codes promo (remises) — administration.
const Promotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', label: '', type: 'percent', value: '', maxUses: '' });
  const [saving, setSaving] = useState(false);

  const fetchPromotions = useCallback(async () => {
    try {
      setError('');
      const { data } = await api.get('/promotions');
      setPromotions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les promotions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/promotions', {
        code: form.code.trim(),
        label: form.label.trim(),
        type: form.type,
        value: Number(form.value),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
      });
      setForm({ code: '', label: '', type: 'percent', value: '', maxUses: '' });
      toast.success('Code promo créé');
      await fetchPromotions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/promotions/${id}`);
      toast.success('Code promo supprimé');
      setPromotions((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression');
    }
  };

  const formatValue = (promotion) =>
    promotion.type === 'amount'
      ? `${formatCfa(Number(promotion.value))}`
      : `${Number(promotion.value).toLocaleString('fr-FR')} %`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
          <Tag className="h-5 w-5" />
        </span>
        <div>
          <h1 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Codes promo</h1>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Créez des remises (pourcentage ou montant) applicables à la caisse.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="fluent-card-filled space-y-4 p-4 sm:p-5">
        <h2 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Nouveau code</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Code</label>
            <input type="text" name="code" value={form.code} onChange={handleChange} placeholder="BIENVENUE10" required className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Libellé</label>
            <input type="text" name="label" value={form.label} onChange={handleChange} placeholder="Remise de bienvenue" className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Type</label>
            <select name="type" value={form.type} onChange={handleChange} className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm">
              <option value="percent">Pourcentage (%)</option>
              <option value="amount">Montant fixe</option>
            </select>
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Valeur</label>
            <input type="number" name="value" value={form.value} onChange={handleChange} min="0" step="0.01" required className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Limite d'utilisations (vide = illimité)</label>
            <input type="number" name="maxUses" value={form.maxUses} onChange={handleChange} min="0" step="1" className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="ms-button ms-button-primary min-h-[44px] justify-center disabled:opacity-60">
          <Plus className="h-4 w-4" /> {saving ? 'Création…' : 'Créer le code'}
        </button>
      </form>

      {loading ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
      ) : error ? (
        <p className="text-sm text-[var(--ms-danger)]">{error}</p>
      ) : promotions.length === 0 ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucun code promo pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {promotions.map((promotion) => (
            <li key={promotion._id} className="fluent-card-filled flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--colorNeutralForeground1)]">{promotion.code}</p>
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {promotion.label || 'Sans libellé'} · {formatValue(promotion)} · {promotion.active ? 'Actif' : 'Désactivé'}
                </p>
              </div>
              <button type="button" onClick={() => handleDelete(promotion._id)} className="ms-icon-button" aria-label="Supprimer">
                <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Promotions;
