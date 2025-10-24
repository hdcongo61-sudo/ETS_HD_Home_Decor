import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';

const SaleForm = ({ clients = [], onSubmit }) => {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([{ product: '', quantity: '', price: 0 }]);
  const [selectedClient, setSelectedClient] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [totalAmount, setTotalAmount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [setReminder, setSetReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [productSearchTerms, setProductSearchTerms] = useState(['']);

  const safeClients = Array.isArray(clients) ? clients : [];

  /** Fetch products **/
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        setProducts(res.data);
      } catch {
        setFormError('Impossible de charger les produits.');
      }
    };
    fetchProducts();
  }, []);

  /** Calculate total **/
  useEffect(() => {
    const total = selectedProducts.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.price) || 0;
      return sum + q * p;
    }, 0);
    setTotalAmount(total);
  }, [selectedProducts]);

  /** Filter clients & products **/
  const filteredClients = safeClients.filter(c =>
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );
  const getFilteredProducts = (term) =>
    products.filter(p => p.name.toLowerCase().includes(term.toLowerCase()));

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
    setPaymentMethod('cash');
    setNote('');
    setSetReminder(false);
    setReminderDate('');
    setReminderNote('');
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

    try {
      const payload = {
        client: selectedClient,
        products: selectedProducts.filter(p => p.product).map(p => ({
          product: p.product,
          quantity: Number(p.quantity),
          price: Number(p.price),
        })),
        paymentMethod,
        totalAmount,
        note,
        reminderDate: setReminder ? reminderDate : undefined,
        reminderNote: setReminder ? reminderNote : undefined,
      };
      await onSubmit(payload);
      resetForm();
    } catch {
      setFormError('Erreur lors de la création de la vente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** UI **/
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-8 transition-all"
    >
      {/* CLIENT */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M16 7a4 4 0 11-8 0m8 0a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          Client
        </h3>

        <div className="space-y-2">
          <input
            type="text"
            placeholder="Rechercher un client..."
            className="w-full px-3 py-2 border rounded-xl border-gray-300 focus:ring-2 focus:ring-blue-500"
            value={clientSearchTerm}
            onChange={(e) => setClientSearchTerm(e.target.value)}
          />

          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Sélectionner un client...</option>
            {filteredClients.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          {safeClients.length === 0 && (
            <p className="text-xs text-red-500 mt-1">Aucun client disponible.</p>
          )}
        </div>
      </section>

      {/* PRODUCTS */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M5 8h14M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          Produits
        </h3>

        {selectedProducts.map((item, index) => {
          const selectedProduct = products.find(p => p._id === item.product);
          return (
            <div
              key={index}
              className="p-4 mb-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3"
            >
              <input
                type="text"
                placeholder="Rechercher un produit..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                value={productSearchTerms[index] || ''}
                onChange={(e) => {
                  const newTerms = [...productSearchTerms];
                  newTerms[index] = e.target.value;
                  setProductSearchTerms(newTerms);
                }}
              />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <select
                  value={item.product}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 ${
                    errors[index] ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Sélectionner...</option>
                  {getFilteredProducts(productSearchTerms[index]).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.stock})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                  placeholder="Qté"
                />

                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  value={item.price}
                  onChange={(e) => handlePriceChange(index, e.target.value)}
                  placeholder="Prix unitaire"
                />

                <div className="flex justify-end">
                  {selectedProducts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {selectedProduct && (
                <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                  <img
                    src={selectedProduct.image || '/placeholder.png'}
                    alt={selectedProduct.name}
                    className="w-16 h-16 object-cover rounded-lg border"
                  />
                  <div className="text-xs text-gray-600">
                    <p className="font-semibold text-sm">{selectedProduct.name}</p>
                    <p>Stock: {selectedProduct.stock}</p>
                    <p>Prix catalogue: {selectedProduct.price?.toLocaleString()} CFA</p>
                  </div>
                </div>
              )}

              {errors[index] && (
                <p className="text-xs text-red-500 mt-2">{errors[index]}</p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addProduct}
          className="w-full py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl flex justify-center gap-2 text-sm"
        >
          ＋ Ajouter un produit
        </button>
      </section>

      {/* NOTE */}
      <section>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Note (optionnelle)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ajoutez une note..."
          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
          rows="2"
        />
      </section>

      {/* REMINDER */}
      <section>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Rappel de Paiement
        </label>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={setReminder}
            onChange={(e) => setSetReminder(e.target.checked)}
          />
          <span className="text-sm text-gray-700">Définir un rappel</span>
        </div>

        {setReminder && (
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-3">
            <input
              type="datetime-local"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={reminderNote}
              onChange={(e) => setReminderNote(e.target.value)}
              placeholder="Note du rappel..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              rows="2"
            />
          </div>
        )}
      </section>

      {/* PAYMENT */}
      <section>
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          Méthode de Paiement
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['cash', 'MobileMoney', 'credit'].map((m) => (
            <label
              key={m}
              className={`flex justify-center items-center py-2 border rounded-xl cursor-pointer ${
                paymentMethod === m ? 'bg-blue-50 border-blue-500' : 'border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="payment"
                value={m}
                checked={paymentMethod === m}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="hidden"
              />
              <span className="text-sm capitalize">
                {m === 'MobileMoney' ? 'Mobile Money' : m}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* TOTAL */}
      <section className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex justify-between items-center">
        <span className="font-semibold text-gray-700">Total</span>
        <span className="text-lg font-bold text-blue-600">
          {totalAmount.toLocaleString('fr-FR')} CFA
        </span>
      </section>

      {/* SUBMIT */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 rounded-xl font-medium ${
          isSubmitting
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isSubmitting ? 'En cours...' : 'Enregistrer la vente'}
      </button>

      {formError && (
        <p className="text-sm text-red-600 mt-3 text-center bg-red-50 border border-red-200 py-2 rounded-xl">
          {formError}
        </p>
      )}
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
  onSubmit: PropTypes.func.isRequired,
};

export default SaleForm;
