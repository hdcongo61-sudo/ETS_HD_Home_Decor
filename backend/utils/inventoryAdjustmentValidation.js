const validateInventoryAdjustment = ({ productId, quantity, unitCost = 0, note = '' }) => {
  if (!productId) return { code: 'PRODUCT_REQUIRED', message: 'Choisissez un produit.' };
  if ((typeof quantity !== 'number' && typeof quantity !== 'string') || !Number.isFinite(Number(quantity)) || Number(quantity) === 0) return { code: 'INVALID_ADJUSTMENT_QUANTITY', message: 'Une quantité signée non nulle est requise.' };
  if (typeof note !== 'string' || !note.trim()) return { code: 'ADJUSTMENT_REASON_REQUIRED', message: 'Le motif de cet ajustement est obligatoire.' };
  if (note.trim().length > 300) return { code: 'ADJUSTMENT_REASON_TOO_LONG', message: 'Le motif ne peut pas dépasser 300 caractères.' };
  if ((typeof unitCost !== 'number' && typeof unitCost !== 'string') || !Number.isFinite(Number(unitCost)) || Number(unitCost) < 0) return { code: 'INVALID_UNIT_COST', message: 'Le coût unitaire doit être positif ou nul.' };
  return null;
};
module.exports = { validateInventoryAdjustment };
