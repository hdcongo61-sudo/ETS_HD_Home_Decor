import React, { useId, useRef, useState } from 'react';
import Modal from '../Modal';
import SectionError from '../SectionError';
import { catalogApi } from '../../features/catalog/api';
export const STOCK_REMOVAL_REASONS = [
  { value: 'casse', label: 'Casse / abîmé' }, { value: 'cadeau', label: 'Cadeau / échantillon' },
  { value: 'vol', label: 'Vol' }, { value: 'peremption', label: 'Péremption' },
  { value: 'usage_personnel', label: 'Usage personnel' }, { value: 'correction', label: 'Correction de stock' },
  { value: 'autre', label: 'Autre' },
];
const units = value => Number(value).toLocaleString('fr-FR') + ' u';
export default function StockRemovalDialog({ product, onClose, onSaved }) {
  const id = useId();
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [review, setReview] = useState(false);
  const [validation, setValidation] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const qty = Number(quantity);
  const stock = Number(product.stock);
  const validQty = quantity.trim() !== '' && Number.isSafeInteger(qty) && qty > 0;
  const validStock = Number.isFinite(stock) && stock >= 0;
  const validate = () => {
    const errors = {};
    if (!STOCK_REMOVAL_REASONS.some(item => item.value === reason)) errors.reason = 'Choisissez le motif de cette sortie.';
    if (!validQty) errors.quantity = 'Saisissez un nombre entier supérieur à zéro.';
    else if (!validStock) errors.quantity = 'Stock indisponible. Actualisez la fiche avant de poursuivre.';
    else if (qty > stock) errors.quantity = 'Stock insuffisant : ' + units(stock) + ' disponibles, ' + units(qty) + ' demandées.';
    if (reason === 'autre' && !note.trim()) errors.note = 'Précisez le motif de cette sortie.';
    setValidation(errors);
    return Object.keys(errors).length === 0;
  };
  const submit = async event => {
    event.preventDefault();
    if (lock.current || !validate()) return;
    if (!review) { setReview(true); return; }
    lock.current = true; setSaving(true); setError(null);
    let data;
    try {
      const response = await catalogApi.addStockMovement({ productId: product._id, quantity: qty, reason, note: note.trim() });
      data = response.data;
    } catch (failure) {
      setError(failure); lock.current = false; setSaving(false); return;
    }
    // Once recorded, keep submission locked even if refreshing the parent fails.
    onSaved(data);
  };
  return <Modal isOpen onClose={() => { if (!lock.current) onClose(); }} mobileFullscreen size="sm"
    title={review ? 'Vérifier la sortie de stock' : 'Enregistrer une sortie de stock'} subtitle={product.name}>
    <form onSubmit={submit} noValidate className="space-y-4" aria-busy={saving}>
      {error && <SectionError error={error} title="Sortie non enregistrée" />}
      <p className="text-sm text-[var(--ms-text-muted)]">Cette opération retire des unités du stock sans enregistrer de vente.</p>
      {product.warehouse && <p className="text-sm">Entrepôt : {product.warehouse}</p>}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Aperçu du stock">
        {[['Stock actuel', validStock ? units(stock) : 'Indisponible'], ['Sortie', validQty ? '−' + units(qty) : 'À vérifier'], ['Stock après', validQty && validStock && qty <= stock ? units(stock - qty) : 'À vérifier']].map(([label, value]) => <div key={label} className="rounded-md border border-[var(--ms-border)] p-3"><dt className="text-sm text-[var(--ms-text-muted)]">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
      </dl>
      <fieldset disabled={saving || review} className="space-y-4">
        <div><label htmlFor={id + '-reason'} className="form-label mb-1 block">Motif obligatoire</label>
          <select id={id + '-reason'} className="form-control min-h-[44px]" value={reason} onChange={event => setReason(event.target.value)} aria-invalid={Boolean(validation.reason)} aria-describedby={validation.reason ? id + '-reason-error' : undefined}>
            <option value="">Choisir un motif…</option>{STOCK_REMOVAL_REASONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>{validation.reason && <p id={id + '-reason-error'} role="alert" className="text-sm text-[var(--ms-danger)]">{validation.reason}</p>}
        </div>
        <div><label htmlFor={id + '-quantity'} className="form-label mb-1 block">Quantité à retirer</label>
          <input id={id + '-quantity'} type="number" min="1" step="1" inputMode="numeric" className="form-control min-h-[44px]" value={quantity} onChange={event => setQuantity(event.target.value)} aria-invalid={Boolean(validation.quantity)} aria-describedby={validation.quantity ? id + '-quantity-error' : undefined} />
          {validation.quantity && <p id={id + '-quantity-error'} role="alert" className="text-sm text-[var(--ms-danger)]">{validation.quantity}</p>}
        </div>
        <div><label htmlFor={id + '-note'} className="form-label mb-1 block">{reason === 'autre' ? 'Précision obligatoire' : 'Note (optionnelle)'}</label>
          <textarea id={id + '-note'} className="form-control min-h-[88px]" maxLength={300} value={note} onChange={event => setNote(event.target.value)} aria-invalid={Boolean(validation.note)} aria-describedby={validation.note ? id + '-note-error' : undefined} />
          {validation.note && <p id={id + '-note-error'} role="alert" className="text-sm text-[var(--ms-danger)]">{validation.note}</p>}
        </div>
      </fieldset>
      {review && <p role="status" className="text-sm">Vérifiez le motif et le stock après la sortie, puis confirmez.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={saving} onClick={review ? () => { setReview(false); setError(null); } : onClose} className="ms-button ms-button-secondary min-h-[44px]">{review ? 'Modifier' : 'Annuler'}</button>
        <button type="submit" disabled={saving} className="ms-button ms-button-primary min-h-[44px]">{saving ? 'Enregistrement…' : review ? 'Confirmer la sortie' : 'Vérifier la sortie'}</button>
      </div>
    </form>
  </Modal>;
}
