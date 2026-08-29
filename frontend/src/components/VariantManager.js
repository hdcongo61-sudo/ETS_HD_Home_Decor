import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Package, AlertCircle, Zap } from 'lucide-react';
import { variantApi, attributeApi } from '../services/variantApi';
import { Surface, LoadingSkeleton, EmptyState } from './business';

/**
 * VariantManager — gestion des variantes d'un produit
 *
 * Permet de créer manuellement des variantes ou de générer automatiquement
 * toutes les combinaisons d'attributs (ex: toutes les tailles × couleurs).
 */
const VariantManager = ({ productId, productName }) => {
  const [variants, setVariants] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkOptions, setBulkOptions] = useState({});
  const [generating, setGenerating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [variantsRes, attrsRes] = await Promise.all([
        variantApi.list(productId),
        attributeApi.list(),
      ]);

      setVariants(variantsRes.data || []);

      // Filter only variant axis attributes
      const variantAttrs = (attrsRes.data || []).filter(attr => attr.variantAxis);
      setAttributes(variantAttrs);

      // Initialize bulk options with empty arrays
      const initialOptions = {};
      variantAttrs.forEach(attr => {
        initialOptions[attr.key] = [];
      });
      setBulkOptions(initialOptions);
    } catch (error) {
      toast.error('Erreur lors du chargement des variantes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      loadData();
    }
  }, [productId, loadData]);

  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm('Supprimer cette variante ?')) return;

    try {
      await variantApi.delete(variantId);
      toast.success('Variante supprimée');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleBulkCreate = async () => {
    // Validate at least one attribute is selected
    const selectedAttrs = Object.entries(bulkOptions).filter(([_, values]) => values.length > 0);

    if (selectedAttrs.length === 0) {
      toast.error('Sélectionnez au moins une option pour chaque attribut');
      return;
    }

    // Filter to only selected options
    const optionSets = {};
    selectedAttrs.forEach(([key, values]) => {
      optionSets[key] = values;
    });

    setGenerating(true);
    try {
      const created = await variantApi.bulkCreate(productId, optionSets);
      toast.success(`${created.length} variante(s) créée(s)`);
      setShowBulkCreate(false);
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la génération des variantes');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const toggleOption = (attrKey, option) => {
    const current = bulkOptions[attrKey] || [];
    const updated = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    setBulkOptions({ ...bulkOptions, [attrKey]: updated });
  };

  const getVariantLabel = (variant) => {
    const options = variant.optionValues || {};
    const entries = Object.entries(options);
    if (entries.length === 0) return 'Variante par défaut';
    return entries.map(([key, value]) => value).join(' / ');
  };

  const calculateCombinations = () => {
    const selected = Object.values(bulkOptions).filter(arr => arr.length > 0);
    if (selected.length === 0) return 0;
    return selected.reduce((acc, arr) => acc * arr.length, 1);
  };

  if (loading) {
    return <LoadingSkeleton rows={3} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={18} />
          <h3 className="fui-subtitle1">Variantes du produit</h3>
        </div>
        {attributes.length > 0 && !showBulkCreate && (
          <button
            onClick={() => setShowBulkCreate(true)}
            className="ms-button ms-button-primary ms-button-sm"
          >
            <Zap size={16} /> Générer toutes les variantes
          </button>
        )}
      </div>

      {/* No attributes warning */}
      {attributes.length === 0 && (
        <div
          className="flex items-start gap-3 p-4 rounded-[var(--radiusLarge)] bg-[var(--colorStatusWarningBackground1)] border border-[var(--colorStatusWarningStroke1)]"
        >
          <AlertCircle size={20} className="text-[var(--colorStatusWarningForeground1)] shrink-0 mt-0.5" />
          <div>
            <p className="fui-body1-strong text-[var(--colorStatusWarningForeground1)]">
              Aucun attribut de variante configuré
            </p>
            <p className="fui-caption1 text-[var(--colorStatusWarningForeground1)]">
              Créez d'abord des attributs (Taille, Couleur, etc.) dans la section "Attributs" avant de pouvoir générer des variantes.
            </p>
          </div>
        </div>
      )}

      {/* Bulk Create Form */}
      {showBulkCreate && attributes.length > 0 && (
        <Surface className="p-4">
          <h4 className="fui-body1-strong mb-3">Générer toutes les combinaisons</h4>
          <p className="fui-caption1 text-[var(--colorNeutralForeground3)] mb-4">
            Sélectionnez les options pour chaque attribut. Toutes les combinaisons seront créées automatiquement.
          </p>

          <div className="space-y-4">
            {attributes.map((attr) => (
              <div key={attr._id}>
                <label className="fui-label">{attr.label}</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(attr.options || []).map((option) => {
                    const isSelected = (bulkOptions[attr.key] || []).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleOption(attr.key, option)}
                        className={`px-3 py-2 rounded-[var(--radiusMedium)] text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-[var(--colorBrandBackground)] text-white'
                            : 'bg-[var(--colorNeutralBackground2)] text-[var(--colorNeutralForeground1)] hover:bg-[var(--colorNeutralBackground3)]'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {calculateCombinations() > 0 && (
            <div className="mt-4 p-3 rounded-[var(--radiusMedium)] bg-[var(--colorStatusInfoBackground1)]">
              <p className="fui-caption1 text-[var(--colorStatusInfoForeground1)]">
                <strong>{calculateCombinations()}</strong> variante(s) seront créées
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleBulkCreate}
              disabled={generating || calculateCombinations() === 0}
              className="ms-button ms-button-primary ms-button-md"
            >
              {generating ? (
                <>Génération...</>
              ) : (
                <>
                  <Zap size={16} /> Générer {calculateCombinations()} variante(s)
                </>
              )}
            </button>
            <button
              onClick={() => setShowBulkCreate(false)}
              disabled={generating}
              className="ms-button ms-button-secondary ms-button-md"
            >
              Annuler
            </button>
          </div>
        </Surface>
      )}

      {/* Variants List */}
      <Surface className="p-4">
        {variants.length === 0 ? (
          <EmptyState
            title="Aucune variante"
            description="Générez des variantes pour ce produit (ex: Maillot PSG - Rouge - M, Maillot PSG - Bleu - L, etc.)"
          />
        ) : (
          <div className="space-y-2">
            {variants.map((variant) => (
              <div
                key={variant._id}
                className="flex items-center justify-between p-3 rounded-[var(--radiusLarge)] bg-[var(--colorNeutralBackground2)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="fui-body1-strong">{getVariantLabel(variant)}</p>
                  <div className="flex gap-3 mt-1">
                    {variant.sku && (
                      <span className="fui-caption1 font-mono text-[var(--colorNeutralForeground3)]">
                        SKU: {variant.sku}
                      </span>
                    )}
                    <span className="fui-caption1 text-[var(--colorNeutralForeground3)]">
                      Statut: {variant.status}
                    </span>
                    {variant.isDefault && (
                      <span className="fui-caption1 text-[var(--colorBrandForeground1)]">
                        Par défaut
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteVariant(variant._id)}
                  className="btn-ghost text-[var(--colorStatusDangerForeground1)]"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Surface>

      {variants.length > 0 && (
        <p className="fui-caption1 text-[var(--colorNeutralForeground3)]">
          💡 Astuce : Chaque variante peut avoir son propre SKU et code-barres. Pour l'instant, les variantes partagent le stock du produit parent (Phase 3 — l'inventaire par variante arrive en Phase 4).
        </p>
      )}
    </div>
  );
};

export default VariantManager;
