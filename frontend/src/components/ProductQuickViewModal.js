// src/components/ProductQuickViewModal.js
// Aperçu rapide d'un produit depuis la liste (desktop uniquement).
// Aucun appel réseau : toutes les données proviennent déjà de la liste.
import React from 'react';
import { ExternalLink, Package, Pencil } from 'lucide-react';
import Modal from './Modal';
import { StatusBadge } from './business';
import { productPath } from '../utils/paths';

const formatCfa = (value) => `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

const getStockStatus = (stock) => {
  const numeric = Number(stock) || 0;
  if (numeric <= 0) return { tone: 'danger', label: 'Rupture' };
  if (numeric < 5) return { tone: 'warning', label: 'Stock bas' };
  return { tone: 'success', label: 'Disponible' };
};

const InfoTile = ({ label, value, tone, hint }) => (
  <div
    className="rounded-[var(--radiusMedium)] border p-3"
    style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground2)' }}
  >
    <p className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
    <p className="fui-body1-strong mt-0.5 tabular-nums" style={{ color: tone || 'var(--colorNeutralForeground1)' }}>{value}</p>
    {hint && <p className="fui-caption2 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>{hint}</p>}
  </div>
);

const InfoRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <span className="fui-caption1 shrink-0" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</span>
    <span className="text-right text-sm font-medium" style={{ color: 'var(--colorNeutralForeground1)' }}>{children}</span>
  </div>
);

const ProductQuickViewModal = ({ product, onClose, onEdit }) => {
  if (!product) return null;

  const price = Number(product.price) || 0;
  const cost = product.costPrice != null && product.costPrice !== '' ? Number(product.costPrice) : null;
  const hasCost = cost != null && cost > 0;
  const stock = Number(product.stock) || 0;
  const unitProfit = hasCost ? price - cost : null;
  const marginPct = hasCost ? ((price - cost) / cost) * 100 : null;
  const stockValue = stock * price;
  const stockStatus = getStockStatus(product.stock);
  const stockTone =
    stockStatus.tone === 'success'
      ? 'var(--colorStatusSuccessForeground1)'
      : stockStatus.tone === 'warning'
        ? 'var(--colorStatusWarningForeground1)'
        : 'var(--colorStatusDangerForeground1)';
  const profitTone =
    unitProfit == null
      ? null
      : unitProfit >= 0
        ? 'var(--colorStatusSuccessForeground1)'
        : 'var(--colorStatusDangerForeground1)';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={product.name || 'Aperçu du produit'}
      subtitle="Aperçu rapide — informations essentielles"
      icon={<Package className="h-5 w-5" aria-hidden />}
      size="md"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <a
            href={productPath(product)}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-button ms-button-secondary ms-button-sm"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Fiche complète
          </a>
          <div className="flex flex-wrap items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onEdit(product);
                }}
                className="ms-button ms-button-secondary ms-button-sm"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Modifier
              </button>
            )}
            <button type="button" onClick={onClose} className="ms-button ms-button-primary ms-button-sm">
              Fermer
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Image + badges + description */}
        <div className="flex items-start gap-3">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-20 w-20 shrink-0 rounded-[var(--radiusLarge)] border border-slate-100 bg-slate-50 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[var(--radiusLarge)] border border-slate-100 bg-slate-100 text-slate-500">
              <Package className="h-8 w-8" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={stockStatus.tone}>{stockStatus.label}</StatusBadge>
              {product.category && <StatusBadge tone="brand">{product.category}</StatusBadge>}
            </div>
            <p className="fui-caption1 mt-2 line-clamp-3" style={{ color: 'var(--colorNeutralForeground3)' }}>
              {product.description || 'Aucune description.'}
            </p>
          </div>
        </div>

        {/* Chiffres clés */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <InfoTile label="Prix de vente" value={formatCfa(price)} />
          {hasCost && <InfoTile label="Prix de revient" value={formatCfa(cost)} />}
          {hasCost ? (
            <>
              <InfoTile
                label="Bénéfice / unité"
                value={`${unitProfit >= 0 ? '+' : '−'}${formatCfa(Math.abs(unitProfit))}`}
                tone={profitTone}
              />
              <InfoTile label="Marge" value={`${marginPct.toFixed(1)} %`} tone={profitTone} />
            </>
          ) : (
            <InfoTile label="Bénéfice / unité" value="—" hint="Prix de revient non renseigné" />
          )}
          <InfoTile
            label="Stock"
            value={stock.toLocaleString('fr-FR')}
            tone={stockTone}
            hint={product.minStockLevel != null ? `Minimum : ${product.minStockLevel}` : undefined}
          />
          <InfoTile label="Valeur du stock" value={formatCfa(stockValue)} />
        </div>

        {/* Autres informations */}
        <div className="divide-y divide-[color:var(--colorNeutralStroke3)]">
          <InfoRow label="Conteneur">{product.container?.trim() || 'Non défini'}</InfoRow>
          <InfoRow label="Entrepôt">{product.warehouse?.trim() || 'Non défini'}</InfoRow>
          <InfoRow label="Fournisseur">
            {product.supplierName || 'Non défini'}
            {product.supplierPhone && (
              <span className="fui-caption1 block" style={{ color: 'var(--colorNeutralForeground3)' }}>
                {product.supplierPhone}
              </span>
            )}
          </InfoRow>
          {product.sku && (
            <InfoRow label="SKU">
              <span className="font-mono">{product.sku}</span>
            </InfoRow>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProductQuickViewModal;
