import React, { useEffect, useRef, useState } from 'react';
import { inventoryApi } from '../../features/inventory/api';
import SectionError from '../SectionError';
const idOf = value => typeof value === 'object' ? value?._id : value;
export default function InventoryAdjustmentForm({ products, location, onSaved, onBusyChange }) {
  const [form, setForm] = useState({ productId: '', quantity: '', unitCost: '', reason: '' });
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState('');
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setBalance(null); setBalanceError(null);
    if (!form.productId || !location?._id) return;
    setBalanceLoading(true);
    inventoryApi.balances({ productId: form.productId, locationId: location._id }).then(({ data }) => {
      if (!active) return;
      const rows = Array.isArray(data) ? data : data.balances || [];
      setBalance(rows.find(row => row.variantId?.isDefault && String(idOf(row.locationId)) === String(location._id)) || null);
    }).catch(failure => { if (active) setBalanceError(failure); }).finally(() => { if (active) setBalanceLoading(false); });
    return () => { active = false; };
  }, [form.productId, location?._id, attempt]);
  const change = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setReview(false); setValidation(''); setResult(null); };
  const qty = Number(form.quantity);
  const cost = Number(form.unitCost);
  const known = balance && Number.isFinite(Number(balance.onHand));
  const submit = async event => {
    event.preventDefault();
    if (lock.current) return;
    if (!location?._id) { setValidation('La boutique active est indisponible. Actualisez la page.'); return; }
    if (!form.productId || !Number.isFinite(qty) || qty === 0) { setValidation('Choisissez un produit et une quantité signée non nulle.'); return; }
    if (!form.reason.trim()) { setValidation('Le motif de cet ajustement est obligatoire.'); return; }
    if (!Number.isFinite(cost) || cost < 0) { setValidation('Le coût unitaire doit être un nombre positif ou nul.'); return; }
    if (known && Number(balance.onHand) + qty < 0) { setValidation('Stock insuffisant : ' + balance.onHand + ' unités en stock pour cette boutique.'); return; }
    if (balanceLoading || balanceError) { setValidation('Chargez le solde avant de confirmer.'); return; }
    if (!review) { setReview(true); return; }
    lock.current = true; setSaving(true); onBusyChange?.(true); setError(null);
    let data;
    try {
      ({ data } = await inventoryApi.adjust({ productId: form.productId, quantity: qty, unitCost: cost, note: form.reason.trim() }));
    } catch (failure) {
      setError(failure);
      if (failure.response?.status === 409) { setReview(false); setAttempt(value => value + 1); }
      lock.current = false; setSaving(false); onBusyChange?.(false); return;
    }
    setResult(data.balance); setReview(false); setBalance(data.balance || null);
    setForm(previous => ({ ...previous, quantity: '', reason: '' }));
    lock.current = false; setSaving(false); onBusyChange?.(false);
    onSaved(data);
  };
  return <form onSubmit={submit} noValidate className="mb-4 space-y-4 rounded-md border border-[var(--ms-border)] p-4" aria-busy={saving}>
    <p className="font-semibold">Boutique concernée : {location?.name || 'Indisponible'}</p>
    <p className="text-sm text-[var(--ms-text-muted)]">Quantité positive : entrée. Quantité négative : sortie. Ajustement de la variante par défaut du produit.</p>
    {error && <SectionError error={error} title="Ajustement non enregistré" />}
    {validation && <p role="alert" className="text-sm text-[var(--ms-danger)]">{validation}</p>}
    {result && <p role="status" className="font-semibold">Ajustement enregistré. Stock confirmé : {result.onHand} unités.</p>}
    <fieldset disabled={saving || review} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label>Produit<select className="form-control min-h-[44px]" value={form.productId} onChange={event => change('productId', event.target.value)}><option value="">Choisir un produit…</option>{products.map(product => <option key={product._id} value={product._id}>{product.name}{product.sku ? ' (' + product.sku + ')' : ''}</option>)}</select></label>
      <label>Quantité signée<input type="number" step="any" className="form-control min-h-[44px]" value={form.quantity} onChange={event => change('quantity', event.target.value)} /></label>
      <label>Coût unitaire (CFA, optionnel)<input type="number" min="0" step="any" className="form-control min-h-[44px]" value={form.unitCost} onChange={event => change('unitCost', event.target.value)} /></label>
      <label>Motif obligatoire<textarea maxLength={300} className="form-control min-h-[88px]" value={form.reason} onChange={event => change('reason', event.target.value)} /></label>
    </fieldset>
    {balanceLoading && <p role="status">Chargement du solde de cette boutique…</p>}
    {balanceError && <SectionError error={balanceError} title="Solde indisponible" onRetry={() => setAttempt(value => value + 1)} />}
    {form.productId && !balanceLoading && !balanceError && <div className="rounded-md border border-[var(--ms-border)] p-3" aria-label="Aperçu de l’ajustement">
      {known ? <p>Stock actuel : {balance.onHand} · Variation : {Number.isFinite(qty) ? qty : 'À vérifier'} · Stock après : {Number.isFinite(qty) ? Number(balance.onHand) + qty : 'À vérifier'}</p> : <p>Solde non initialisé ou variante par défaut indisponible. Le stock final sera calculé et contrôlé par le serveur ; aucun solde nul n’est supposé.</p>}
    </div>}
    {review && <p role="status">Vérifiez la boutique, le produit, le motif et la variation avant confirmation.</p>}
    <div className="flex flex-wrap justify-end gap-2">
      {review && <button type="button" disabled={saving} className="ms-button ms-button-secondary min-h-[44px]" onClick={() => { setReview(false); setError(null); }}>Modifier</button>}
      <button type="submit" disabled={saving || balanceLoading || Boolean(balanceError) || !location?._id} className="ms-button ms-button-primary min-h-[44px]">{saving ? 'Enregistrement…' : review ? 'Confirmer l’ajustement' : 'Vérifier l’ajustement'}</button>
    </div>
  </form>;
}
