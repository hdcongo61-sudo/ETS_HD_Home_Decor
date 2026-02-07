// components/GlobalPaymentModal.js
import React, { useState, useEffect } from 'react';
import { useModal } from '../context/ModalContext';
import api from '../services/api';
import Modal from './Modal';

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
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Ajouter un paiement"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors touch-manipulation"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-payment-form"
            disabled={isLoading}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed touch-manipulation"
          >
            {isLoading ? 'En cours...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="global-payment-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Sale Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Vente</label>
          <select
            value={selectedSale}
            onChange={(e) => {
              setSelectedSale(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 touch-manipulation"
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Montant (CFA)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            className="w-full min-h-[44px] px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 touch-manipulation"
            placeholder="0.00"
            required
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Méthode</label>
          <div className="grid grid-cols-3 gap-2">
            {['cash', 'MobileMoney', 'credit'].map((methodOption) => (
              <button
                key={methodOption}
                type="button"
                onClick={() => setMethod(methodOption)}
                className={`min-h-[44px] px-2 py-2 rounded-xl border text-sm font-medium touch-manipulation ${
                  method === methodOption
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {methodOption === 'cash' ? 'Espèces' :
                 methodOption === 'MobileMoney' ? 'Mobile Money' : 'Crédit'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default GlobalPaymentModal;
