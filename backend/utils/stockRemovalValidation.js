const STOCK_REMOVAL_REASONS = ['casse', 'cadeau', 'vol', 'peremption', 'usage_personnel', 'correction', 'autre'];
const validateStockRemoval = ({ productId, quantity, reason, note }) => {
  const qty = Number(quantity);
  const text = typeof note === 'string' ? note.trim() : '';
  if (!productId) return { code: 'PRODUCT_REQUIRED', message: 'Produit manquant.' };
  if ((typeof quantity !== 'string' && typeof quantity !== 'number') || !Number.isSafeInteger(qty) || qty < 1) return { code: 'INVALID_STOCK_QUANTITY', message: 'La quantité doit être un nombre entier supérieur à zéro.' };
  if (!STOCK_REMOVAL_REASONS.includes(reason)) return { code: 'STOCK_REASON_REQUIRED', message: 'Choisissez un motif valide pour cette sortie.' };
  if (reason === 'autre' && !text) return { code: 'STOCK_NOTE_REQUIRED', message: 'Précisez le motif de cette sortie.' };
  if (text.length > 300) return { code: 'STOCK_NOTE_TOO_LONG', message: 'La note ne peut pas dépasser 300 caractères.' };
  return null;
};
module.exports = { validateStockRemoval };
