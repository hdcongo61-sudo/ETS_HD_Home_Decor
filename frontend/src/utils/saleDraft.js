export const SALE_DRAFT_VERSION = 2;
export const SALE_DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;

export function saleDraftKey({ tenantId, userId, mode = 'sale' }) {
  if (!tenantId || !userId || !['sale', 'proforma'].includes(mode)) return '';
  return ['sale-draft', SALE_DRAFT_VERSION, tenantId, userId, mode].map(encodeURIComponent).join(':');
}

export function readSaleDraft(storage, key, now = Date.now()) {
  if (!key) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  let draft;
  try { draft = JSON.parse(raw); } catch { storage.removeItem(key); return null; }
  const age = now - Date.parse(draft?.updatedAt);
  if (draft?.version !== SALE_DRAFT_VERSION || !Number.isFinite(age) || age < 0 || age > SALE_DRAFT_TTL ||
      typeof draft.selectedClient !== 'string' || !Array.isArray(draft.selectedProducts) ||
      !draft.selectedProducts.every(line => line && typeof line.product === 'string' && Number.isFinite(Number(line.quantity)) && Number(line.quantity) >= 0 && Number.isFinite(Number(line.price)) && Number(line.price) >= 0)) {
    storage.removeItem(key);
    return null;
  }
  return draft;
}

export function hasSaleDraftContent(draft) {
  return Boolean(draft.selectedClient || draft.selectedProducts.some(line => line.product) || draft.note || draft.paymentAmount !== '' || draft.reminderNote || draft.saleDate);
}
