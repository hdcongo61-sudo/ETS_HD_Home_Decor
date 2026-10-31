import { formatCfa } from '../utils/format';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';

// Catalogue de services (hors-stock) — vertical « services ».
const Services = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', durationMinutes: '' });
  const [saving, setSaving] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      setError('');
      const { data } = await api.get('/services');
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/services', {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category: form.category.trim(),
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
      });
      setForm({ name: '', description: '', price: '', category: '', durationMinutes: '' });
      toast.success('Service créé');
      await fetchServices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/services/${id}`);
      toast.success('Service supprimé');
      setServices((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
          <Briefcase className="h-5 w-5" />
        </span>
        <div>
          <h1 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Services</h1>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Catalogue de prestations facturables sans stock (coiffure, réparation, consultation…).
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="fluent-card-filled space-y-4 p-4 sm:p-5">
        <h2 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Nouveau service</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Nom</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Prix (CFA)</label>
            <input type="number" name="price" value={form.price} onChange={handleChange} min="0" step="0.01" required className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Catégorie</label>
            <input type="text" name="category" value={form.category} onChange={handleChange} className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Durée (min)</label>
            <input type="number" name="durationMinutes" value={form.durationMinutes} onChange={handleChange} min="0" step="1" className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="fui-caption1 mb-1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>Description</label>
            <input type="text" name="description" value={form.description} onChange={handleChange} className="form-input w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-2 text-sm" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="ms-button ms-button-primary min-h-[44px] justify-center disabled:opacity-60">
          <Plus className="h-4 w-4" /> {saving ? 'Création…' : 'Créer le service'}
        </button>
      </form>

      {loading ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
      ) : error ? (
        <p className="text-sm text-[var(--ms-danger)]">{error}</p>
      ) : services.length === 0 ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucun service pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {services.map((service) => (
            <li key={service._id} className="fluent-card-filled flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--colorNeutralForeground1)]">{service.name}</p>
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {formatCfa(service.price)}
                  {service.category ? ` · ${service.category}` : ''}
                  {service.durationMinutes ? ` · ${service.durationMinutes} min` : ''}
                  {!service.active ? ' · Désactivé' : ''}
                </p>
              </div>
              <button type="button" onClick={() => handleDelete(service._id)} className="ms-icon-button" aria-label="Supprimer">
                <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Services;
