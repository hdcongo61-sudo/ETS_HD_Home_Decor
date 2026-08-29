import React, { useState, useEffect } from 'react';
import { variantApi } from '../services/variantApi';
import { Package } from 'lucide-react';

/**
 * VariantPicker — sélecteur de variante pour le formulaire de vente
 *
 * Affiche un sélecteur si le produit a des variantes (taille, couleur, etc.).
 * Retourne la variante sélectionnée via onChange.
 */
const VariantPicker = ({ productId, productName, onVariantSelect }) => {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState('');

  useEffect(() => {
    if (!productId) return;

    loadVariants();
  }, [productId]);

  const loadVariants = async () => {
    try {
      setLoading(true);
      const { data } = await variantApi.list(productId);
      setVariants(data || []);

      // Auto-select default variant or first one
      if (data && data.length > 0) {
        const defaultVariant = data.find(v => v.isDefault) || data[0];
        setSelectedVariantId(defaultVariant._id);
        onVariantSelect?.(defaultVariant);
      }
    } catch (error) {
      console.error('Error loading variants:', error);
      setVariants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVariantChange = (variantId) => {
    setSelectedVariantId(variantId);
    const variant = variants.find(v => v._id === variantId);
    onVariantSelect?.(variant);
  };

  const getVariantLabel = (variant) => {
    const options = variant.optionValues || {};
    const entries = Object.entries(options);
    if (entries.length === 0) return 'Standard';
    return entries.map(([key, value]) => value).join(' / ');
  };

  // No variants = no picker
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-[var(--colorNeutralBackground3)] rounded-[var(--radiusMedium)]" />
      </div>
    );
  }

  if (variants.length === 0) {
    return null;
  }

  // Only 1 variant (default) = no picker needed
  if (variants.length === 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="fui-label flex items-center gap-2">
        <Package size={14} />
        Variante
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {variants.map((variant) => {
          const isSelected = selectedVariantId === variant._id;
          return (
            <button
              key={variant._id}
              type="button"
              onClick={() => handleVariantChange(variant._id)}
              className={`
                p-3 rounded-[var(--radiusMedium)] text-sm font-medium transition-all
                border-2
                ${isSelected
                  ? 'border-[var(--colorBrandBackground)] bg-[var(--colorBrandBackground)] text-white'
                  : 'border-[var(--colorNeutralStroke1)] bg-[var(--colorNeutralBackground1)] text-[var(--colorNeutralForeground1)] hover:border-[var(--colorBrandBackground)] hover:bg-[var(--colorNeutralBackground2)]'
                }
              `}
            >
              {getVariantLabel(variant)}
            </button>
          );
        })}
      </div>

      {selectedVariantId && (
        <p className="fui-caption1 text-[var(--colorNeutralForeground3)]">
          {variants.find(v => v._id === selectedVariantId)?.sku && (
            <>SKU: {variants.find(v => v._id === selectedVariantId).sku}</>
          )}
        </p>
      )}
    </div>
  );
};

export default VariantPicker;
