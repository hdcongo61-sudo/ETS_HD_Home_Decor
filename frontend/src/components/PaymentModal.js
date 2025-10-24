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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            key="modal"
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Ajouter un paiement
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
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
                        className={`p-3 rounded-xl border text-sm transition-all ${
                          method === opt
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-gray-300 bg-white hover:border-gray-400'
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
                    className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-70"
                  >
                    Annuler
                  </button>
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-white transition-all ${
                      isSubmitting
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
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
