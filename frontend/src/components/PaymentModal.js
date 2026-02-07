import React, { useState, useEffect } from 'react';
import Modal from './Modal';

const PaymentModal = ({ show, onClose, sale, onAddPayment }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setAmount('');
      setMethod('cash');
      setError('');
      setIsSubmitting(false);
    }
  }, [show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Montant invalide');
      return;
    }

    if (paymentAmount > sale.balance) {
      setError(`Le montant ne peut pas dépasser le solde restant (${sale.balance.toFixed(2)} CFA)`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onAddPayment({ amount: paymentAmount, method });
    } catch (submissionError) {
      const fallbackMessage = "Impossible d'ajouter le paiement. Veuillez réessayer.";
      const apiMessage =
        submissionError?.response?.data?.message || submissionError?.message;
      setError(apiMessage || fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sale) return null;

  const totalPaid = sale.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  const balance = (Number(sale.totalAmount) || 0) - totalPaid;

  return (
    <Modal
      isOpen={show}
      onClose={onClose}
      title="Ajouter un paiement"
      subtitle={sale.client?.name ? `${sale.client.name} · Solde: ${balance.toFixed(0)} CFA` : undefined}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors touch-manipulation disabled:opacity-70"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="sale-payment-form"
            disabled={isSubmitting}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Enregistrer
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-6">
              {/* Summary */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium text-gray-900">
                    {sale.client?.name || 'Non spécifié'}
                  </span>

                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900">
                    {sale.totalAmount?.toFixed()} CFA
                  </span>

                  <span className="text-gray-500">Déjà payé</span>
                  <span className="text-green-600 font-medium">
                    {totalPaid.toFixed()} CFA
                  </span>

                  <span className="text-gray-500">Solde restant</span>
                  <span
                    className={`font-semibold ${
                      balance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {balance.toFixed()} CFA
                  </span>
                </div>

                {sale.payments?.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Historique des paiements
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 pr-1">
                      {sale.payments.map((p, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <div
                              className={`p-1.5 rounded-lg ${
                                p.method === 'cash'
                                  ? 'bg-blue-100 text-blue-600'
                                  : p.method === 'MobileMoney'
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-purple-100 text-purple-600'
                              }`}
                            >
                              💳
                            </div>
                            <span className="capitalize">
                              {p.method === 'MobileMoney'
                                ? 'Mobile Money'
                                : p.method}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(p.paymentDate).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <span className="font-semibold text-green-600">
                            {p.amount.toFixed()} CFA
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Form */}
              <form id="sale-payment-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant à payer
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={balance}
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setError('');
                      }}
                      placeholder="0.00"
                      required
                      className="w-full min-h-[44px] px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all pr-12"
                    />
                    <span className="absolute right-3 top-3 text-gray-500 text-sm">
                      CFA
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Méthode de paiement
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['cash', 'MobileMoney', 'credit'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setMethod(opt)}
                        className={`min-h-[44px] p-3 rounded-xl border-2 text-sm font-medium transition-all touch-manipulation ${
                          method === opt
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`p-2 rounded-lg ${
                              opt === 'cash'
                                ? 'bg-blue-100 text-blue-600'
                                : opt === 'MobileMoney'
                                ? 'bg-green-100 text-green-600'
                                : 'bg-purple-100 text-purple-600'
                            }`}
                          >
                            💰
                          </div>
                          <span className="text-xs font-medium capitalize">
                            {opt === 'MobileMoney'
                              ? 'Mobile Money'
                              : opt === 'credit'
                              ? 'Crédit'
                              : 'Espèces'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {error}
                  </div>
                )}
              </form>
      </div>
    </Modal>
  );
};

export default PaymentModal;
