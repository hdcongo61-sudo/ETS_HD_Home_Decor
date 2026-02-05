import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const totalPaid = sale.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const balance = sale.totalAmount - totalPaid;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="modal"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                Ajouter un paiement
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Fermer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-6">
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
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm"
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
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
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
                      <motion.button
                        key={opt}
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setMethod(opt)}
                        className={`p-3 rounded-xl border-2 text-sm transition-all ${
                          method === opt
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white hover:border-gray-300'
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
                      </motion.button>
                    ))}
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    {error}
                  </motion.div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="min-h-[44px] px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    Annuler
                  </button>
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`min-h-[44px] px-5 py-2.5 rounded-xl flex items-center gap-2 text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${
                      isSubmitting
                        ? 'bg-indigo-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Traitement...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Enregistrer
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaymentModal;
