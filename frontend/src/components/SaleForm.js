import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';

const SaleForm = ({ clients = [], onSubmit }) => {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([{ product: '', quantity: 1, price: 0 }]);
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

  // États pour la recherche
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [productSearchTerms, setProductSearchTerms] = useState(['']);

  const safeClients = Array.isArray(clients) ? clients : [];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/products');
        setProducts(response.data);
      } catch (error) {
        setFormError('Échec du chargement des produits');
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const total = selectedProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotalAmount(total);
  }, [selectedProducts]);

  // Filtrer les clients en fonction du terme de recherche
  const filteredClients = safeClients.filter(client =>
    client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // Filtrer les produits pour chaque ligne en fonction du terme de recherche
  const getFilteredProducts = (searchTerm) => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()))
  };

  const validatePrices = () => {
    const newErrors = selectedProducts.map((item, index) => {
      if (!item.product) return 'Sélectionnez un produit';

      const product = products.find(p => p._id === item.product);
      if (!product) return 'Produit invalide';

      if (isNaN(item.quantity)) {
        return "Quantité invalide";
      }
      if (item.quantity <= 0) return "Quantité doit être positive";
      if (item.quantity > product.stock) return `Stock insuffisant (${product.stock} disponibles)`;
      if (item.price < product.costPrice) return `Prix trop bas (min: ${product.costPrice} CFA)`;

      return null;
    });

    setErrors(newErrors);
    return newErrors.every(error => !error);
  };

  const handleProductChange = (index, productId) => {
    const newProducts = [...selectedProducts];
    const product = products.find(p => p._id === productId);

    newProducts[index] = {
      product: productId,
      quantity: 1,
      price: product?.price || 0
    };

    setSelectedProducts(newProducts);
    setErrors(errors.map((e, i) => i === index ? null : e));

    // Réinitialiser le terme de recherche pour cette ligne
    const newSearchTerms = [...productSearchTerms];
    newSearchTerms[index] = '';
    setProductSearchTerms(newSearchTerms);
  };

  const handleQuantityChange = (index, quantity) => {
    const newProducts = [...selectedProducts];
    const numQuantity = parseInt(quantity, 10) || 1;
    newProducts[index].quantity = Math.max(1, numQuantity);
    setSelectedProducts(newProducts);
  };

  const handlePriceChange = (index, price) => {
    const newProducts = [...selectedProducts];
    const numericPrice = Math.max(0, parseFloat(price) || 0);
    newProducts[index].price = numericPrice;
    setSelectedProducts(newProducts);
  };

  const addProduct = () => {
    setSelectedProducts([...selectedProducts, { product: '', quantity: 1, price: 0 }]);
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
    setSelectedProducts([{ product: '', quantity: 1, price: 0 }]);
    setPaymentMethod('cash');
    setTotalAmount(0);
    setErrors([]);
    setFormError('');
    setIsSubmitting(false);
    setClientSearchTerm('');
    setProductSearchTerms(['']);
    setNote('');
    setSetReminder(false);
    setReminderDate('');
    setReminderNote('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!selectedClient) {
      setFormError('Sélectionnez un client');
      setIsSubmitting(false);
      return;
    }

    if (!validatePrices()) {
      setFormError('Corrigez les erreurs dans le formulaire');
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit({
        client: selectedClient,
        products: selectedProducts.filter(p => p.product !== ''),
        paymentMethod,
        totalAmount,
        note,
        reminderDate: setReminder && reminderDate ? reminderDate : undefined,
        reminderNote: setReminder && reminderNote ? reminderNote : undefined
      });

      resetForm();
    } catch (error) {
      setFormError('Erreur lors de la création de la vente');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      {/* Client Selection with Search */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <div className="bg-blue-100 p-1.5 rounded-lg">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          Client
        </label>

        <div className="mb-3">
          <input
            type="text"
            placeholder="Rechercher un client..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            value={clientSearchTerm}
            onChange={(e) => setClientSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative">
          <select
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            required
          >
            <option value="" disabled className="text-gray-400">
              Choisir un client...
            </option>
            {filteredClients.map(client => (
              <option key={client._id} value={client._id}>
                {client.name || 'Aucun Client'}
              </option>
            ))}
          </select>
          {safeClients.length === 0 && (
            <div className="text-red-500 text-sm mt-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Aucun client disponible - Créez d'abord des clients
            </div>
          )}
        </div>
      </div>

      {/* Product Selection with Search */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
          <div className="bg-purple-100 p-1.5 rounded-lg">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          Produits
        </h3>

        {selectedProducts.map((item, index) => (
          <div key={index} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            {/* Barre de recherche pour les produits */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Rechercher un produit..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={productSearchTerms[index] || ''}
                onChange={(e) => {
                  const newSearchTerms = [...productSearchTerms];
                  newSearchTerms[index] = e.target.value;
                  setProductSearchTerms(newSearchTerms);
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Produit</label>
                <select
                  className={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors[index] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  value={item.product}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                >
                  <option value="">Sélectionner...</option>
                  {getFilteredProducts(productSearchTerms[index]).map(product => (
                    <option
                      key={product._id}
                      value={product._id}
                      className={product.stock < 1 ? 'text-red-500' : ''}
                    >
                      {product.name} ({product.stock} en stock)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Quantité</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Prix unitaire</label>
                <div className="relative">
                  <input
                    type="number"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
                    value={item.price || ''}
                    onChange={(e) => handlePriceChange(index, e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400 text-xs">CFA</span>
                </div>
              </div>

              <div className="flex items-end justify-end">
                {selectedProducts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProduct(index)}
                    className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {errors[index] && (
              <div className="text-red-600 text-xs flex items-center gap-2 mt-2">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {errors[index]}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addProduct}
          className="w-full px-4 py-2.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Ajouter un produit
        </button>
      </div>

      {/* Note Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <div className="bg-gray-100 p-1.5 rounded-lg">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          Note (optionnelle)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ajoutez une note à cette vente..."
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          rows="2"
          maxLength="500"
        />
        <div className="text-xs text-gray-500 mt-1">
          {note.length}/500 caractères
        </div>
      </div>

      {/* Payment Reminder Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <div className="bg-orange-100 p-1.5 rounded-lg">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          Rappel de Paiement
        </label>
        
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            id="setReminder"
            checked={setReminder}
            onChange={(e) => setSetReminder(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="setReminder" className="text-sm text-gray-700">
            Définir un rappel de paiement
          </label>
        </div>

        {setReminder && (
          <div className="space-y-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Date et heure du rappel *</label>
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={setReminder}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Note du rappel (optionnelle)</label>
              <textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Message personnalisé pour le rappel..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
                maxLength="200"
              />
              <div className="text-xs text-gray-500">
                {reminderNote.length}/200 caractères
              </div>
            </div>

            <p className="text-xs text-orange-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Le rappel sera affiché sur le tableau de bord
            </p>
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <div className="bg-green-100 p-1.5 rounded-lg">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          Paiement
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['cash', 'MobileMoney', 'credit'].map((method) => (
            <label
              key={method}
              className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === method
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
                }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method}
                checked={paymentMethod === method}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="hidden"
              />
              <span className="text-xs font-medium capitalize">
                {method === 'MobileMoney' ? 'Mobile Money' : method}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Total</span>
          </div>
          <span className="text-lg font-semibold text-blue-600">
            {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} CFA
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${isSubmitting
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            En cours...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Enregistrer la vente
          </>
        )}
      </button>

      {formError && (
        <div className="mt-4 text-red-600 text-xs flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {formError}
        </div>
      )}
    </form>
  );
};

SaleForm.propTypes = {
  clients: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        name: PropTypes.string.isRequired
      })
    ),
    PropTypes.object
  ]),
  onSubmit: PropTypes.func.isRequired
};


export default SaleForm;
