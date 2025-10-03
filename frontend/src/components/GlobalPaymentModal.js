// components/GlobalPaymentModal.js
import React, { useState, useEffect } from 'react';
import { useModal } from '../context/ModalContext';
import api from '../services/api';

const GlobalPaymentModal = () => {
  const { activeModal, closeModal } = useModal();
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = activeModal === 'payment';

  useEffect(() => {
    if (isOpen) {
      fetchPendingSales();
    }
  }, [isOpen]);

  const fetchPendingSales = async () => {
    try {
      const response = await api.get('/sales?status=pending');
      setSales(response.data);
    } catch (error) {
      console.error('Error fetching pending sales:', error);
    }
  };

  const calculateBalance = (sale) => {
    const totalPaid = sale.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    return sale.totalAmount - totalPaid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!selectedSale) {
      setError('Veuillez sélectionner une vente');
      setIsLoading(false);
      return;
    }

    const paymentAmount = parseFloat(amount);
    const sale = sales.find(s => s._id === selectedSale);
    const balance = calculateBalance(sale);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Montant invalide');
      setIsLoading(false);
      return;
    }

    if (paymentAmount > balance) {
      setError(`Le montant ne peut pas dépasser le solde restant (${balance.toFixed(2)} CFA)`);
      setIsLoading(false);
      return;
    }

    try {
      await api.post(`/sales/${selectedSale}/payments`, {
        amount: paymentAmount,
        method
      });

      closeModal();
      setSelectedSale('');
      setAmount('');
      setError('');
      
      // Rafraîchir la page si nécessaire
    //   window.location.reload();
    } catch (error) {
      setError('Erreur lors de l\'ajout du paiement');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Ajouter un Paiement</h2>
          <button
            onClick={closeModal}
            className="text-gray-500 hover:bg-gray-100 p-2 rounded-full"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Sale Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Vente</label>
            <select
              value={selectedSale}
              onChange={(e) => {
                setSelectedSale(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
              required
            >
              <option value="">Sélectionner une vente...</option>
              {sales.map(sale => {
                const balance = calculateBalance(sale);
                return balance > 0 ? (
                  <option key={sale._id} value={sale._id}>
                    {sale.client?.name} - Solde: {balance.toFixed()} CFA
                  </option>
                ) : null;
              })}
            </select>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
              placeholder="0.00"
              required
            />
          </div>

          {/* Payment Method */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Méthode</label>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'MobileMoney', 'credit'].map((methodOption) => (
                <button
                  key={methodOption}
                  type="button"
                  onClick={() => setMethod(methodOption)}
                  className={`p-2 rounded-xl border text-sm ${
                    method === methodOption
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {methodOption === 'cash' ? 'Espèces' :
                   methodOption === 'MobileMoney' ? 'Mobile Money' : 'Crédit'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 text-red-600 text-sm p-3 bg-red-50 rounded-xl">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-xl"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl disabled:bg-gray-400"
            >
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GlobalPaymentModal;
