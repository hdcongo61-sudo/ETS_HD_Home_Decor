import React, { useState, useEffect, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { getCompanyIdentity } from '../utils/appBranding';
import { generateProformaPdf } from '../utils/proformaPdf';
import { getSaleTypeText } from '../utils/saleUtils';
import { useFeature } from './FeatureGate';
import { FEATURE_KEYS } from '../config/features';

const normalizeCollection = (value, nestedKeys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of nestedKeys) {
    if (Array.isArray(value?.[key])) {
      return value[key];
    }
  }
  return [];
};

const SaleForm = ({
  clients = [],
  products: initialProducts = [],
  onSubmit,
  onProformaCreated,
  formId = 'sale-form',
  hideSubmit = false,
}) => {
  const { auth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const manualSaleDateEnabled = isAdmin && Boolean(auth?.user?.adminPreferences?.manualSaleDateEnabled);
  const safeClients = useMemo(() => normalizeCollection(clients, ['clients', 'data']), [clients]);
  const normalizedInitialProducts = useMemo(
    () => normalizeCollection(initialProducts, ['products', 'data']),
    [initialProducts]
  );
  const [products, setProducts] = useState(normalizedInitialProducts);
  const [selectedProducts, setSelectedProducts] = useState([{ product: '', quantity: '', price: 0 }]);
  const [selectedClient, setSelectedClient] = useState('');
  const [saleType, setSaleType] = useState('normal');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [setReminder, setSetReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [productSearchTerms, setProductSearchTerms] = useState(['']);
  const [markAsDelivered, setMarkAsDelivered] = useState(false);
  const canProforma = useFeature(FEATURE_KEYS.PROFORMA);
  const [documentMode, setDocumentMode] = useState('sale');
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date.toISOString().slice(0, 10);
  });

	
  useEffect(() => {
    if (normalizedInitialProducts.length > 0) {
      setProducts(normalizedInitialProducts);
    }
  }, [normalizedInitialProducts]);

  /** Fetch products **/
  useEffect(() => {
    if (normalizedInitialProducts.length > 0) {
      return undefined;
    }

    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        setProducts(normalizeCollection(res.data, ['products', 'data']));
      } catch {
        setFormError('Impossible de charger les produits.');
      }
    };
    fetchProducts();
    return undefined;
  }, [normalizedInitialProducts]);

  /** Calculate total **/
  useEffect(() => {
    const total = selectedProducts.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.price) || 0;
      return sum + q * p;
    }, 0);
    setTotalAmount(total);
  }, [selectedProducts]);

  const normalizedPaymentAmount = Math.max(0, Number(paymentAmount) || 0);
  const remainingBalance = Math.max(0, totalAmount - normalizedPaymentAmount);
  const isFullyPaid = totalAmount > 0 && normalizedPaymentAmount === totalAmount;

  useEffect(() => {
    if (!isFullyPaid && markAsDelivered) {
      setMarkAsDelivered(false);
    }
  }, [isFullyPaid, markAsDelivered]);

  useEffect(() => {
    if (isFullyPaid && setReminder) {
      setSetReminder(false);
      setReminderDate('');
      setReminderNote('');
    }
  }, [isFullyPaid, setReminder]);

  /** Filter clients & products **/
  const filteredClients = safeClients.filter(c =>
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );
  const getFilteredProducts = (term, selectedProductId = '') =>
    products.filter((product) => {
      const matchesSearch = (product.name || '').toLowerCase().includes(term.toLowerCase());
      const hasStock = Number(product.stock) > 0;
      const isCurrentSelection = product._id === selectedProductId;
      return matchesSearch && (hasStock || isCurrentSelection);
    });

  /** Validation **/
  const validatePrices = () => {
    const newErrors = selectedProducts.map((item) => {
      if (!item.product) return 'Sélectionnez un produit';
      const product = products.find(p => p._id === item.product);
      if (!product) return 'Produit invalide';
      if (!item.quantity || item.quantity <= 0) return 'Quantité invalide';
      if (item.quantity > product.stock) return `Stock insuffisant (${product.stock} disponibles)`;
      if (item.price < product.costPrice) return `Prix trop bas (min: ${product.costPrice} CFA)`;
      return null;
    });
    setErrors(newErrors);
    return newErrors.every(e => !e);
  };

  /** Handlers **/
  const handleProductChange = (index, id) => {
    const newArr = [...selectedProducts];
    const product = products.find(p => p._id === id);
    newArr[index] = {
      product: id,
      quantity: newArr[index]?.quantity ?? '',
      price: product?.price || 0,
    };
    setSelectedProducts(newArr);
    setProductSearchTerms(prev => prev.map((t, i) => (i === index ? '' : t)));
  };

  const handleQuantityChange = (index, val) => {
    const newArr = [...selectedProducts];
    const q = parseInt(val, 10);
    newArr[index].quantity = Number.isNaN(q) ? '' : Math.max(1, q);
    setSelectedProducts(newArr);
  };

  const handlePriceChange = (index, val) => {
    const newArr = [...selectedProducts];
    newArr[index].price = Math.max(0, parseFloat(val) || 0);
    setSelectedProducts(newArr);
  };

  const addProduct = () => {
    setSelectedProducts([...selectedProducts, { product: '', quantity: '', price: 0 }]);
    setErrors([...errors, null]);
    setProductSearchTerms([...productSearchTerms, '']);
  };

  const removeProduct = (index) => {
    if (selectedProducts.length > 1) {
      setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
      setErrors(errors.filter((_, i) => i !== index));
      setProductSearchTerms(productSearchTerms.filter((_, i) => i !== index));
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setSelectedProducts([{ product: '', quantity: '', price: 0 }]);
    setSaleType('normal');
    setPaymentMethod('cash');
    setPaymentAmount('');
    setNote('');
    setSaleDate('');
    setSetReminder(false);
    setReminderDate('');
    setReminderNote('');
    setMarkAsDelivered(false);
    setTotalAmount(0);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    if (!selectedClient) {
      setFormError('Sélectionnez un client.');
      setIsSubmitting(false);
      return;
    }
    if (!validatePrices()) {
      setFormError('Corrigez les erreurs du formulaire.');
      setIsSubmitting(false);
      return;
    }

    if (documentMode === 'proforma') {
      try {
        const client = safeClients.find((item) => item._id === selectedClient);
        const items = selectedProducts.map((item) => {
          const product = products.find((candidate) => candidate._id === item.product);
          return {
            name: product?.name || 'Produit',
            quantity: Number(item.quantity),
            price: Number(item.price),
          };
        });
        const { data: proforma } = await api.post('/proformas', {
          client: selectedClient,
          products: selectedProducts.map((item) => ({
            product: item.product,
            quantity: Number(item.quantity),
            price: Number(item.price),
          })),
          note,
          validUntil,
        });
        onProformaCreated?.(proforma);
        window.dispatchEvent(new CustomEvent('proformaCreated', { detail: proforma }));
        try {
          await generateProformaPdf({
            client: proforma.client || client || {},
            items: (proforma.products || items).map((item) => ({
              name: item.productName || item.name || item.product?.name || 'Produit',
              quantity: item.quantity,
              price: item.price,
            })),
            note: proforma.note,
            validUntil: proforma.validUntil,
            sellerName: auth?.user?.name || auth?.user?.email || '',
            company: getCompanyIdentity(appSettings.branding),
            reference: proforma.reference,
            issueDate: proforma.createdAt,
          });
        } catch (pdfError) {
          console.error('Unable to generate saved proforma PDF:', pdfError);
          setFormError('Proforma enregistrée, mais le téléchargement du PDF a échoué.');
        }
      } catch (error) {
        console.error('Unable to generate proforma PDF:', error);
        setFormError('Impossible de générer la facture proforma.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (normalizedPaymentAmount > totalAmount) {
      setFormError('Le montant payé ne peut pas dépasser le total de la vente.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        client: selectedClient,
        products: selectedProducts.filter(p => p.product).map(p => ({
          product: p.product,
          quantity: Number(p.quantity),
          price: Number(p.price),
        })),
        saleType,
        paymentMethod,
        initialPaymentAmount: normalizedPaymentAmount,
        markAsDelivered: isFullyPaid && markAsDelivered,
        note,
        saleDate: manualSaleDateEnabled && saleDate ? saleDate : undefined,
        reminderDate: setReminder && !isFullyPaid ? reminderDate : undefined,
        reminderNote: setReminder && !isFullyPaid ? reminderNote : undefined,
      };
      await onSubmit(payload);
      resetForm();
    } catch {
      setFormError('Erreur lors de la création de la vente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBase =
    'form-control text-gray-900 placeholder:text-gray-400';

  const sectionTitleClass = 'text-sm font-semibold text-[var(--ms-text)] uppercase tracking-[0.12em]';

  /** UI **/
  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="form-shell"
    >
      {/* Header */}
      <div className="border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-5 py-4 sm:px-6 sm:py-5">
        <h3 className="text-lg font-semibold text-[var(--ms-text-strong)]">
          {documentMode === 'sale' ? 'Nouvelle vente' : 'Facture proforma'}
        </h3>
        <p className="text-sm text-[var(--ms-text-muted)] mt-0.5">
          {documentMode === 'sale'
            ? 'Renseignez le client, les produits et le paiement.'
            : 'Préparez une proposition commerciale sans enregistrer de vente.'}
        </p>
        {!hideSubmit && canProforma && <div className="mt-4 grid grid-cols-2 gap-1 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] p-1">
          {[
            { key: 'sale', label: 'Vente' },
            { key: 'proforma', label: 'Proforma' },
          ].map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => {
                setDocumentMode(mode.key);
                setFormError('');
              }}
              className={`min-h-[40px] rounded-[var(--radiusMedium)] text-sm font-semibold transition-colors ${
                documentMode === mode.key
                  ? 'bg-[var(--ms-blue)] text-white shadow-[var(--ms-shadow-sm)]'
                  : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>}
      </div>

      <div className="p-5 sm:p-6 space-y-8">
        {/* CLIENT */}
        <section className="space-y-3" aria-labelledby="sale-form-client">
          <h4 id="sale-form-client" className={sectionTitleClass}>
            Client
          </h4>
          <div className="form-panel p-4 space-y-3">
            <input
              type="text"
              placeholder="Rechercher un client…"
              className={inputBase}
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              aria-label="Rechercher un client"
            />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className={inputBase}
              required
              aria-label="Sélectionner un client"
            >
              <option value="">Sélectionner un client…</option>
              {filteredClients.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {safeClients.length === 0 && (
              <p className="text-sm text-[var(--ms-warning)]">Aucun client disponible.</p>
            )}
          </div>
        </section>

        {/* PRODUCTS */}
        <section className="space-y-4" aria-labelledby="sale-form-products">
          <div className="flex items-center justify-between">
            <h4 id="sale-form-products" className={sectionTitleClass}>
              Produits
            </h4>
            <span className="text-xs text-[var(--ms-text-muted)]">{selectedProducts.length} ligne(s)</span>
          </div>

          <div className="space-y-4">
            {selectedProducts.map((item, index) => {
              const selectedProduct = products.find(p => p._id === item.product);
              const productSearchTerm = productSearchTerms[index] || '';
              const hasProductSearch = productSearchTerm.trim().length > 0;
              const filteredProducts = hasProductSearch
                ? getFilteredProducts(productSearchTerm, item.product).slice(0, 30)
                : [];
              return (
                <div
                  key={index}
                  className={`rounded-[20px] border p-4 space-y-3 transition-colors ${
                    errors[index]
                      ? 'border-[var(--ms-danger)]/30 bg-[#FDF3F4]'
                      : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">
                      Article {index + 1}
                    </span>
                    {selectedProducts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--ms-danger)] transition-colors hover:bg-[#FDF3F4]"
                        aria-label={`Supprimer l'article ${index + 1}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Retirer
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Rechercher un produit…"
                    className={inputBase}
                    value={productSearchTerm}
                    onChange={(e) => {
                      const newTerms = [...productSearchTerms];
                      newTerms[index] = e.target.value;
                      setProductSearchTerms(newTerms);
                    }}
                    aria-label={`Recherche produit ${index + 1}`}
                  />

                  {hasProductSearch && (
                    <div
                      className={`overflow-hidden rounded-xl border bg-[var(--ms-white)] ${
                        errors[index] ? 'border-[var(--ms-danger)]/50' : 'border-[var(--ms-border)]'
                      }`}
                      role="listbox"
                      aria-label={`Choix produit ${index + 1}`}
                      aria-invalid={!!errors[index]}
                      aria-describedby={errors[index] ? `product-error-${index}` : undefined}
                    >
                      {filteredProducts.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto">
                          {filteredProducts.map((p) => {
                            const isSelected = p._id === item.product;
                            return (
                              <button
                                key={p._id}
                                type="button"
                                onClick={() => handleProductChange(index, p._id)}
                                className={`flex w-full items-center gap-3 border-b border-[var(--ms-border)] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--ms-bg-subtle)] ${
                                  isSelected ? 'bg-[var(--ms-blue-soft)]' : 'bg-transparent'
                                }`}
                                role="option"
                                aria-selected={isSelected}
                              >
                                <img
                                  src={p.image || '/placeholder.png'}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-lg border border-[var(--ms-border)] object-cover"
                                  loading="lazy"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-[var(--ms-text)]">
                                    {p.name}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-[var(--ms-text-muted)]">
                                    Stock : {p.stock} · Prix : {(p.price || 0).toLocaleString('fr-FR')} CFA
                                  </span>
                                </span>
                                {isSelected && (
                                  <span className="shrink-0 rounded-full bg-[var(--ms-blue)] px-2 py-1 text-xs font-semibold text-white">
                                    Choisi
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-sm text-[var(--ms-text-muted)]">
                          Aucun produit disponible.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]" htmlFor={`qty-${index}`}>Quantité</label>
                      <input
                        id={`qty-${index}`}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        className={inputBase}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        placeholder="Qté"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]" htmlFor={`price-${index}`}>Prix unitaire (CFA)</label>
                      <input
                        id={`price-${index}`}
                        type="number"
                        inputMode="decimal"
                        className={inputBase}
                        value={item.price}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        placeholder="Prix"
                      />
                    </div>
                  </div>

                  {selectedProduct && (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-3">
                      <img
                        src={selectedProduct.image || '/placeholder.png'}
                        alt=""
                        className="w-14 h-14 object-cover rounded-md border border-[var(--ms-border)]"
                      />
                      <div className="text-sm text-[var(--ms-text-muted)] min-w-0">
                        <p className="font-medium text-[var(--ms-text)] truncate">{selectedProduct.name}</p>
                        <p>Stock : {selectedProduct.stock} · Catalogue : {(selectedProduct.price || 0).toLocaleString('fr-FR')} CFA</p>
                      </div>
                    </div>
                  )}

                  {errors[index] && (
                    <p id={`product-error-${index}`} className="text-sm text-[var(--ms-danger)]" role="alert">
                      {errors[index]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addProduct}
            className="form-button-secondary flex w-full items-center justify-center gap-2 text-sm"
          >
            <span className="text-lg leading-none" aria-hidden>+</span>
            Ajouter un produit
          </button>
        </section>

        {/* NOTE */}
        <section className="space-y-2" aria-labelledby="sale-form-note">
          <label id="sale-form-note" className={sectionTitleClass}>
            Note (optionnelle)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Commentaire ou remarque..."
            className={`${inputBase} min-h-[80px] resize-y`}
            rows={2}
            aria-describedby="sale-form-note"
          />
        </section>

        {documentMode === 'proforma' && (
          <section className="space-y-3" aria-labelledby="proforma-validity">
            <h4 id="proforma-validity" className={sectionTitleClass}>
              Validité de l’offre
            </h4>
            <div className="form-panel p-4 space-y-2">
              <input
                type="date"
                value={validUntil}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputBase}
                required
              />
              <p className="form-help">Cette date apparaîtra sur la facture proforma.</p>
            </div>
          </section>
        )}

        {documentMode === 'sale' && manualSaleDateEnabled && (
          <section className="space-y-3" aria-labelledby="sale-form-date">
            <h4 id="sale-form-date" className={sectionTitleClass}>
              Date réelle de vente
            </h4>
            <div className="form-panel p-4 space-y-2">
              <input
                type="datetime-local"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className={inputBase}
                aria-label="Date réelle de la vente"
              />
              <p className="form-help">
                Optionnel. Utilisez ce champ pour rattraper des ventes notées sur papier avec leur vraie date.
              </p>
            </div>
          </section>
        )}

        {documentMode === 'sale' && isAdmin && (
          <section className="space-y-3" aria-labelledby="sale-form-type">
            <h4 id="sale-form-type" className={sectionTitleClass}>
              Type de vente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="sale-form-type">
              {['normal', 'wholesale'].map((type) => {
                const active = saleType === type;

                return (
                  <label
                    key={type}
                    className={`cursor-pointer rounded-[20px] border p-4 transition-all ${
                      active
                        ? 'border-[var(--ms-text-strong)] bg-[var(--ms-text-strong)] text-[var(--ms-white)] shadow-[var(--ms-shadow)]'
                        : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:border-[var(--ms-border-strong)] hover:bg-[var(--ms-surface-muted)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="saleType"
                      value={type}
                      checked={active}
                      onChange={(e) => setSaleType(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{getSaleTypeText(type)}</p>
                        <p className="mt-1 text-xs opacity-80">
                          {type === 'wholesale'
                            ? 'Commande en gros visible séparément dans les statistiques.'
                            : 'Commande standard affichée comme vente normale.'}
                        </p>
                      </div>
                      <span className={`mt-0.5 h-3.5 w-3.5 rounded-full border ${active ? 'border-current bg-current' : 'border-gray-300 bg-white'}`} />
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* REMINDER */}
        {documentMode === 'sale' && <section className="space-y-3" aria-labelledby="sale-form-reminder">
          <h4 id="sale-form-reminder" className={sectionTitleClass}>
            Rappel de paiement
          </h4>
          {isFullyPaid && (
            <div className="rounded-lg border border-[var(--ms-success)]/20 bg-[#F1FAF1] px-4 py-3 text-sm text-[var(--ms-success)]">
              La vente est soldee. Le rappel de paiement est desactive.
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={setReminder}
              onChange={(e) => setSetReminder(e.target.checked)}
              disabled={isFullyPaid}
              className="form-check rounded"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Définir un rappel</span>
          </label>
          {setReminder && !isFullyPaid && (
            <div className="form-panel p-4 space-y-3">
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className={inputBase}
                aria-label="Date et heure du rappel"
              />
              <textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Note du rappel…"
                className={`${inputBase} min-h-[72px] resize-y`}
                rows={2}
                aria-label="Note du rappel"
              />
            </div>
          )}
        </section>}

        {/* PAYMENT METHOD */}
        {documentMode === 'sale' && <section className="space-y-3" aria-labelledby="sale-form-payment">
          <h4 id="sale-form-payment" className={sectionTitleClass}>
            Méthode de paiement
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-labelledby="sale-form-payment">
            {['cash', 'MobileMoney', 'credit'].map((m) => (
              <label
                key={m}
                className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 transition-all ${
                  paymentMethod === m
                    ? 'border-[var(--ms-text-strong)] bg-[var(--ms-text-strong)] text-[var(--ms-white)] shadow-[var(--ms-shadow)]'
                    : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:border-[var(--ms-border-strong)] hover:bg-[var(--ms-surface-muted)]'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m}
                  checked={paymentMethod === m}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium capitalize">
                  {m === 'MobileMoney' ? 'Mobile Money' : m === 'credit' ? 'Crédit' : 'Espèces'}
                </span>
              </label>
            ))}
          </div>

          <div className="form-panel p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="sale-payment-amount" className="form-label mb-1.5 block">
                  Montant payé maintenant
                </label>
                <input
                  id="sale-payment-amount"
                  type="number"
                  min="0"
                  max={totalAmount || undefined}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className={inputBase}
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={() => setPaymentAmount(totalAmount > 0 ? String(totalAmount) : '')}
                className="form-button-secondary"
              >
                Paiement total
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-[var(--ms-white)] border border-[var(--ms-border)] px-3 py-2.5">
                <p className="text-[var(--ms-text-muted)]">Total vente</p>
                <p className="font-semibold text-[var(--ms-text)]">{totalAmount.toLocaleString('fr-FR')} CFA</p>
              </div>
              <div className="rounded-lg bg-[var(--ms-white)] border border-[var(--ms-border)] px-3 py-2.5">
                <p className="text-[var(--ms-text-muted)]">Paye</p>
                <p className="font-semibold text-[var(--ms-success)]">{normalizedPaymentAmount.toLocaleString('fr-FR')} CFA</p>
              </div>
              <div className="rounded-lg bg-[var(--ms-white)] border border-[var(--ms-border)] px-3 py-2.5">
                <p className="text-[var(--ms-text-muted)]">Reste</p>
                <p className="font-semibold text-[var(--ms-warning)]">{remainingBalance.toLocaleString('fr-FR')} CFA</p>
              </div>
            </div>

            {isFullyPaid && (
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--ms-success)]/20 bg-[#F1FAF1] px-4 py-3">
                <input
                  type="checkbox"
                  checked={markAsDelivered}
                  onChange={(e) => setMarkAsDelivered(e.target.checked)}
                  className="form-check rounded"
                />
                <span className="text-sm font-medium text-[var(--ms-success)]">
                  Confirmer la livraison immediatement
                </span>
              </label>
            )}
          </div>
        </section>}

        {/* TOTAL */}
        <div className="flex items-center justify-between rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-5 py-4">
          <span className="font-semibold text-[var(--ms-text)]">Total</span>
          <span className="text-xl font-bold text-[var(--ms-text-strong)] tabular-nums">
            {totalAmount.toLocaleString('fr-FR')} CFA
          </span>
        </div>

        {!hideSubmit && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="form-button-primary w-full"
          >
            {isSubmitting
              ? documentMode === 'proforma'
                ? 'Génération du PDF...'
                : 'Enregistrement...'
              : documentMode === 'proforma'
                ? 'Télécharger la proforma'
                : 'Enregistrer la vente'}
          </button>
        )}

        {formError && (
          <div
            className="p-4 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] text-[var(--ms-danger)] text-sm text-center"
            role="alert"
          >
            {formError}
          </div>
        )}
      </div>
    </form>
  );
};

SaleForm.propTypes = {
  clients: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        name: PropTypes.string.isRequired,
      })
    ),
    PropTypes.object,
  ]),
  products: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        name: PropTypes.string,
      })
    ),
    PropTypes.object,
  ]),
  onSubmit: PropTypes.func.isRequired,
  onProformaCreated: PropTypes.func,
  formId: PropTypes.string,
  hideSubmit: PropTypes.bool,
};

export default SaleForm;
