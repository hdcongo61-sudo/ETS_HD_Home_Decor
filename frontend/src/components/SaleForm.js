import React, { useState, useEffect, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { getSaleTypeClass, getSaleTypeText } from '../utils/saleUtils';

const normalizeCollection = (value, nestedKeys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of nestedKeys) {
    if (Array.isArray(value?.[key])) {
      return value[key];
    }
  }
  return [];
};

const SaleForm = ({ clients = [], products: initialProducts = [], onSubmit }) => {
  const { auth } = useContext(AuthContext);
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
    'w-full min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow';

  const sectionTitleClass = 'text-sm font-semibold text-gray-900 uppercase tracking-wide';

  /** UI **/
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-lg font-semibold text-gray-900">Nouvelle vente</h3>
        <p className="text-sm text-gray-500 mt-0.5">Renseignez le client, les produits et le paiement.</p>
      </div>

      <div className="p-5 sm:p-6 space-y-8">
        {/* CLIENT */}
        <section className="space-y-3" aria-labelledby="sale-form-client">
          <h4 id="sale-form-client" className={sectionTitleClass}>
            Client
          </h4>
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/30 p-4 space-y-3">
            <input
              type="text"
              placeholder="Rechercher un client…"
              className={`${inputBase} bg-white`}
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              aria-label="Rechercher un client"
            />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className={`${inputBase} bg-white`}
              required
              aria-label="Sélectionner un client"
            >
              <option value="">Sélectionner un client…</option>
              {filteredClients.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {safeClients.length === 0 && (
              <p className="text-sm text-amber-600">Aucun client disponible.</p>
            )}
          </div>
        </section>

        {/* PRODUCTS */}
        <section className="space-y-4" aria-labelledby="sale-form-products">
          <div className="flex items-center justify-between">
            <h4 id="sale-form-products" className={sectionTitleClass}>
              Produits
            </h4>
            <span className="text-xs text-gray-500">{selectedProducts.length} ligne(s)</span>
          </div>

          <div className="space-y-4">
            {selectedProducts.map((item, index) => {
              const selectedProduct = products.find(p => p._id === item.product);
              return (
                <div
                  key={index}
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${
                    errors[index]
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-gray-200/80 bg-gray-50/30'
                  }`}
                >
                  <input
                    type="text"
                    placeholder="Rechercher un produit…"
                    className={`${inputBase} bg-white`}
                    value={productSearchTerms[index] || ''}
                    onChange={(e) => {
                      const newTerms = [...productSearchTerms];
                      newTerms[index] = e.target.value;
                      setProductSearchTerms(newTerms);
                    }}
                    aria-label={`Recherche produit ${index + 1}`}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <select
                        value={item.product}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className={`${inputBase} bg-white ${errors[index] ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                        aria-invalid={!!errors[index]}
                        aria-describedby={errors[index] ? `product-error-${index}` : undefined}
                      >
                        <option value="">Sélectionner…</option>
                        {getFilteredProducts(productSearchTerms[index], item.product).map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.stock})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="sr-only" htmlFor={`qty-${index}`}>Quantité</label>
                      <input
                        id={`qty-${index}`}
                        type="number"
                        min="1"
                        className={inputBase + ' bg-white'}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        placeholder="Qté"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="sr-only" htmlFor={`price-${index}`}>Prix unitaire (CFA)</label>
                      <input
                        id={`price-${index}`}
                        type="number"
                        className={inputBase + ' bg-white'}
                        value={item.price}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        placeholder="Prix"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end sm:justify-center">
                      {selectedProducts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProduct(index)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                          aria-label="Supprimer cette ligne"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedProduct && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200/80">
                      <img
                        src={selectedProduct.image || '/placeholder.png'}
                        alt=""
                        className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                      />
                      <div className="text-sm text-gray-600 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{selectedProduct.name}</p>
                        <p>Stock : {selectedProduct.stock} · Catalogue : {(selectedProduct.price || 0).toLocaleString('fr-FR')} CFA</p>
                      </div>
                    </div>
                  )}

                  {errors[index] && (
                    <p id={`product-error-${index}`} className="text-sm text-red-600" role="alert">
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
            className="w-full py-3 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
            placeholder="Commentaire ou remarque…"
            className={`${inputBase} min-h-[80px] resize-y`}
            rows={2}
            aria-describedby="sale-form-note"
          />
        </section>

        {manualSaleDateEnabled && (
          <section className="space-y-3" aria-labelledby="sale-form-date">
            <h4 id="sale-form-date" className={sectionTitleClass}>
              Date réelle de vente
            </h4>
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 p-4 space-y-2">
              <input
                type="datetime-local"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className={`${inputBase} bg-white`}
                aria-label="Date réelle de la vente"
              />
              <p className="text-xs text-sky-700">
                Optionnel. Utilisez ce champ pour rattraper des ventes notées sur papier avec leur vraie date.
              </p>
            </div>
          </section>
        )}

        {isAdmin && (
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
                    className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                      active
                        ? `${getSaleTypeClass(type)} border-current shadow-sm`
                        : 'border-gray-200 bg-gray-50/60 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
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
        <section className="space-y-3" aria-labelledby="sale-form-reminder">
          <h4 id="sale-form-reminder" className={sectionTitleClass}>
            Rappel de paiement
          </h4>
          {isFullyPaid && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              La vente est soldée. Le rappel de paiement est désactivé.
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={setReminder}
              onChange={(e) => setSetReminder(e.target.checked)}
              disabled={isFullyPaid}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Définir un rappel</span>
          </label>
          {setReminder && !isFullyPaid && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-3">
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className={inputBase + ' bg-white'}
                aria-label="Date et heure du rappel"
              />
              <textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Note du rappel…"
                className={`${inputBase} min-h-[72px] resize-y bg-white`}
                rows={2}
                aria-label="Note du rappel"
              />
            </div>
          )}
        </section>

        {/* PAYMENT METHOD */}
        <section className="space-y-3" aria-labelledby="sale-form-payment">
          <h4 id="sale-form-payment" className={sectionTitleClass}>
            Méthode de paiement
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-labelledby="sale-form-payment">
            {['cash', 'MobileMoney', 'credit'].map((m) => (
              <label
                key={m}
                className={`flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 border-2 rounded-xl cursor-pointer transition-all ${
                  paymentMethod === m
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-gray-50/50 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
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

          <div className="rounded-xl border border-gray-200/80 bg-gray-50/30 p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="sale-payment-amount" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className={`${inputBase} bg-white`}
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={() => setPaymentAmount(totalAmount > 0 ? String(totalAmount) : '')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium"
              >
                Paiement total
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5">
                <p className="text-gray-500">Total vente</p>
                <p className="font-semibold text-gray-900">{totalAmount.toLocaleString('fr-FR')} CFA</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5">
                <p className="text-gray-500">Payé</p>
                <p className="font-semibold text-green-700">{normalizedPaymentAmount.toLocaleString('fr-FR')} CFA</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5">
                <p className="text-gray-500">Reste</p>
                <p className="font-semibold text-amber-700">{remainingBalance.toLocaleString('fr-FR')} CFA</p>
              </div>
            </div>

            {isFullyPaid && (
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={markAsDelivered}
                  onChange={(e) => setMarkAsDelivered(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-green-800">
                  Confirmer la livraison immédiatement
                </span>
              </label>
            )}
          </div>
        </section>

        {/* TOTAL */}
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 px-5 py-4 flex justify-between items-center">
          <span className="font-semibold text-gray-800">Total</span>
          <span className="text-xl font-bold text-indigo-700 tabular-nums">
            {totalAmount.toLocaleString('fr-FR')} CFA
          </span>
        </div>

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full min-h-[48px] py-3 rounded-xl font-semibold text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${
            isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer la vente'}
        </button>

        {formError && (
          <div
            className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm text-center"
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
};

export default SaleForm;
