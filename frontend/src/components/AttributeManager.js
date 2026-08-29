import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Save, X, Tag } from 'lucide-react';
import { attributeApi } from '../services/variantApi';
import { Surface, PageHeader, LoadingSkeleton, EmptyState } from './business';

/**
 * AttributeManager — gestion des attributs de variantes (taille, couleur, etc.)
 *
 * Les attributs avec variantAxis=true génèrent des variantes de produits.
 */
const AttributeManager = () => {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    dataType: 'select',
    options: [],
    variantAxis: true,
    required: false,
    searchable: false,
    filterable: true,
  });
  const [optionInput, setOptionInput] = useState('');

  useEffect(() => {
    loadAttributes();
  }, []);

  const loadAttributes = async () => {
    try {
      setLoading(true);
      const { data } = await attributeApi.list();
      setAttributes(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des attributs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.label.trim()) {
      toast.error('Le libellé est requis');
      return;
    }

    if (!formData.key.trim()) {
      formData.key = formData.label.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    if (formData.variantAxis && formData.options.length === 0) {
      toast.error('Les attributs de variante nécessitent au moins une option');
      return;
    }

    try {
      if (editingId) {
        await attributeApi.update(editingId, formData);
        toast.success('Attribut modifié');
      } else {
        await attributeApi.create(formData);
        toast.success('Attribut créé');
      }
      resetForm();
      loadAttributes();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleEdit = (attr) => {
    setFormData({
      key: attr.key,
      label: attr.label,
      dataType: attr.dataType,
      options: attr.options || [],
      variantAxis: attr.variantAxis,
      required: attr.required,
      searchable: attr.searchable,
      filterable: attr.filterable,
    });
    setEditingId(attr._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet attribut ? Les variantes existantes ne seront pas affectées.')) {
      return;
    }

    try {
      await attributeApi.delete(id);
      toast.success('Attribut supprimé');
      loadAttributes();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      label: '',
      dataType: 'select',
      options: [],
      variantAxis: true,
      required: false,
      searchable: false,
      filterable: true,
    });
    setOptionInput('');
    setEditingId(null);
    setShowForm(false);
  };

  const addOption = () => {
    const trimmed = optionInput.trim();
    if (!trimmed) return;
    if (formData.options.includes(trimmed)) {
      toast.error('Cette option existe déjà');
      return;
    }
    setFormData({ ...formData, options: [...formData.options, trimmed] });
    setOptionInput('');
  };

  const removeOption = (option) => {
    setFormData({ ...formData, options: formData.options.filter(o => o !== option) });
  };

  if (loading) {
    return (
      <div className="p-4">
        <PageHeader title="Attributs de variantes" description="Gérez les attributs de taille, couleur, etc." />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Attributs de variantes"
        description="Créez des attributs comme Taille ou Couleur pour générer des variantes de produits (S/M/L, Rouge/Bleu, etc.)"
        actions={
          !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="ms-button ms-button-primary ms-button-md"
            >
              <Plus size={16} /> Nouvel attribut
            </button>
          )
        }
      />

      {/* Form */}
      {showForm && (
        <Surface className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="fui-subtitle1">
                {editingId ? 'Modifier l\'attribut' : 'Nouvel attribut'}
              </h3>
              <button type="button" onClick={resetForm} className="btn-ghost">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="fui-label">Libellé *</label>
                <input
                  type="text"
                  className="ms-input w-full"
                  placeholder="ex: Taille, Couleur"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="fui-label">Clé (slug)</label>
                <input
                  type="text"
                  className="ms-input w-full"
                  placeholder="ex: taille, couleur (généré auto)"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase() })}
                />
                <p className="fui-caption1 text-[var(--colorNeutralForeground3)] mt-1">
                  Lettres minuscules, chiffres, tirets uniquement
                </p>
              </div>
            </div>

            <div>
              <label className="fui-label">Type de données</label>
              <select
                className="ms-input w-full"
                value={formData.dataType}
                onChange={(e) => setFormData({ ...formData, dataType: e.target.value })}
              >
                <option value="select">Liste déroulante (select)</option>
                <option value="text">Texte</option>
                <option value="number">Nombre</option>
              </select>
            </div>

            {/* Options (pour select) */}
            {(formData.dataType === 'select' || formData.dataType === 'multiselect') && (
              <div>
                <label className="fui-label">Options *</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="ms-input flex-1"
                    placeholder="ex: S, M, L, XL"
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <button type="button" onClick={addOption} className="ms-button ms-button-secondary ms-button-md">
                    <Plus size={16} /> Ajouter
                  </button>
                </div>

                {formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.options.map((opt) => (
                      <div
                        key={opt}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-[var(--colorNeutralBackground3)]"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => removeOption(opt)}
                          className="text-[var(--colorNeutralForeground3)] hover:text-[var(--colorStatusDangerForeground1)]"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.variantAxis}
                  onChange={(e) => setFormData({ ...formData, variantAxis: e.target.checked })}
                />
                <span className="fui-body1">Génère des variantes de produits</span>
              </label>
              <p className="fui-caption1 text-[var(--colorNeutralForeground3)] ml-6">
                Les attributs de variante (taille, couleur) créent des combinaisons vendables distinctes
              </p>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                />
                <span className="fui-body1">Requis</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.filterable}
                  onChange={(e) => setFormData({ ...formData, filterable: e.target.checked })}
                />
                <span className="fui-body1">Filtrable (recherche)</span>
              </label>
            </div>

            <div className="flex gap-2 pt-4">
              <button type="submit" className="ms-button ms-button-primary ms-button-md">
                <Save size={16} /> {editingId ? 'Enregistrer' : 'Créer'}
              </button>
              <button type="button" onClick={resetForm} className="ms-button ms-button-secondary ms-button-md">
                Annuler
              </button>
            </div>
          </form>
        </Surface>
      )}

      {/* List */}
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={18} />
          <h3 className="fui-subtitle1">Attributs configurés</h3>
        </div>

        {attributes.length === 0 ? (
          <EmptyState
            title="Aucun attribut"
            description="Créez des attributs de variantes pour gérer les tailles, couleurs, et autres options de produits."
          />
        ) : (
          <div className="space-y-2">
            {attributes.map((attr) => (
              <div
                key={attr._id}
                className="flex items-center justify-between p-3 rounded-[var(--radiusLarge)] bg-[var(--colorNeutralBackground2)] hover:bg-[var(--colorNeutralBackground3)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="fui-body1-strong">{attr.label}</p>
                    {attr.variantAxis && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--colorBrandBackground)] text-white">
                        Variante
                      </span>
                    )}
                    {attr.required && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--colorStatusWarningBackground1)] text-[var(--colorStatusWarningForeground1)]">
                        Requis
                      </span>
                    )}
                  </div>
                  <p className="fui-caption1 text-[var(--colorNeutralForeground3)] font-mono">{attr.key}</p>
                  {attr.options && attr.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {attr.options.map((opt) => (
                        <span
                          key={opt}
                          className="text-xs px-2 py-0.5 rounded-full bg-[var(--colorNeutralBackground1)] border border-[var(--colorNeutralStroke1)]"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(attr)}
                    className="btn-ghost"
                    title="Modifier"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(attr._id)}
                    className="btn-ghost text-[var(--colorStatusDangerForeground1)]"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
};

export default AttributeManager;
