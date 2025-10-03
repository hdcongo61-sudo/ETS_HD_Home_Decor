// components/GlobalSaleModal.js
import React, { useState, useEffect } from 'react';
import { useModal } from '../context/ModalContext';
import api from '../services/api';

const GlobalSaleModal = () => {
  const { activeModal, closeModal } = useModal();
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([{ product: '', quantity: 1, price: 0 }]);
  const [selectedClient, setSelectedClient] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [totalAmount, setTotalAmount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [setReminder, setSetReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  const isOpen = activeModal === 'sale';
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeProducts = Array.isArray(products) ? products : [];

  const resetForm = () => {
    setSelectedProducts([{ product: '', quantity: 1, price: 0 }]);
    setSelectedClient('');
    setPaymentMethod('cash');
    setTotalAmount(0);
    setErrors([]);
    setFormError('');
    setIsSubmitting(false);
    setNote('');
    setSetReminder(false);
    setReminderDate('');
    setReminderNote('');
  };

  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/clients');
      
    //   // DEBUG: Afficher la structure complète de la réponse
    //   console.log('Full API response:', response);
    //   console.log('Response data:', response.data);
    //   console.log('Type of response.data:', typeof response.data);
    //   console.log('Is array?', Array.isArray(response.data));
      
      if (Array.isArray(response.data)) {
        setClients(response.data);
        // console.log('Clients set successfully:', response.data.length, 'clients loaded');
      } else if (response.data && Array.isArray(response.data.clients)) {
        setClients(response.data.clients);
        // console.log('Clients found in response.data.clients:', response.data.clients.length, 'clients loaded');
      } else if (response.data && Array.isArray(response.data.data)) {
        setClients(response.data.data);
        // console.log('Clients found in response.data.data:', response.data.data.length, 'clients loaded');
      } else {
        const clientsArray = Object.values(response.data || {});
        if (Array.isArray(clientsArray)) {
          setClients(clientsArray);
        //   console.log('Clients converted from object:', clientsArray.length, 'clients loaded');
        } else {
          setClients([]);
        //   console.warn('No clients array found in response, setting empty array');
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      console.error('Error details:', error.response);
      setClients([]);
      setFormError('Erreur lors du chargement des clients: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
    //   console.log('Products response:', response.data);
      
      if (Array.isArray(response.data)) {
        setProducts(response.data);
      } else if (response.data && Array.isArray(response.data.products)) {
        setProducts(response.data.products);
      } else if (response.data && Array.isArray(response.data.data)) {
        setProducts(response.data.data);
      } else {
        const productsArray = Object.values(response.data || {});
        setProducts(Array.isArray(productsArray) ? productsArray : []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('Modal opened, fetching clients and products...');
      fetchClients();
      fetchProducts();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    const total = selectedProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotalAmount(total);
  }, [selectedProducts]);

  const validatePrices = () => {
    const newErrors = selectedProducts.map((item, index) => {
      if (!item.product) return 'Sélectionnez un produit';

      const product = safeProducts.find(p => p._id === item.product);
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
    const product = safeProducts.find(p => p._id === productId);

    newProducts[index] = {
      product: productId,
      quantity: 1,
      price: product?.price || 0
    };

    setSelectedProducts(newProducts);
    setErrors(errors.map((e, i) => i === index ? null : e));
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
  };

  const removeProduct = (index) => {
    if (selectedProducts.length > 1) {
      setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
      setErrors(errors.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

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
      await api.post('/sales', {
        client: selectedClient,
        products: selectedProducts.filter(p => p.product !== ''),
        paymentMethod,
        totalAmount,
        note,
        reminderDate: setReminder && reminderDate ? reminderDate : undefined,
        reminderNote: setReminder && reminderNote ? reminderNote : undefined
      });

      closeModal();
      resetForm();
      
      window.dispatchEvent(new CustomEvent('saleCreated'));
    } catch (error) {
      console.error('Error creating sale:', error);
      setFormError(error.response?.data?.message || 'Erreur lors de la création de la vente');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Nouvelle Vente</h2>
          <button
            onClick={closeModal}
            className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="p-6">
            {/* Debug Info - À retirer en production */}
            {/* <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <strong>Debug Info:</strong> {safeClients.length} clients chargés | 
                {safeProducts.length} produits chargés | 
                Statut: {isLoading ? 'Chargement...' : 'Prêt'}
              </div>
            </div> */}

            {/* Client Selection */}
            <div className="mb-6">
              {/* <label className="block text-sm font-medium text-gray-700 mb-3">
                Client {isLoading && <span className="text-blue-500">(Chargement...)</span>}
              </label> */}
              
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-gray-600">Chargement des clients...</span>
                </div>
              ) : (
                <>
                  <select
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    required
                    disabled={safeClients.length === 0}
                  >
                    <option value="">Choisir un client...</option>
                    {safeClients.map(client => (
                      <option key={client._id || client.id} value={client._id || client.id}>
                        {client.name || 'Client sans nom'} 
                        {client.email ? ` (${client.email})` : ''}
                      </option>
                    ))}
                  </select>
                  
                  {safeClients.length === 0 && !isLoading && (
                    <div className="text-red-500 text-sm mt-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Aucun client disponible. 
                      <button 
                        type="button" 
                        onClick={fetchClients}
                        className="text-blue-500 underline ml-1"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Products Section */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Produits</h3>
              
              {selectedProducts.map((item, index) => (
                <div key={index} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600">Produit</label>
                      <select
                        className={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                          errors[index] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        value={item.product}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                      >
                        <option value="">Sélectionner...</option>
                        {safeProducts.map(product => (
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
                        step="1"
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
              <label className="block text-sm font-medium text-gray-700 mb-3">Note (optionnelle)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-3">Rappel de Paiement</label>
              
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
              <label className="block text-sm font-medium text-gray-700 mb-3">Méthode de Paiement</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {['cash', 'MobileMoney', 'credit'].map((method) => (
                  <label
                    key={method}
                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${
                      paymentMethod === method
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
              disabled={isSubmitting || isLoading}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                isSubmitting || isLoading
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
        </div>
      </div>
    </div>
  );
};

export default GlobalSaleModal;
