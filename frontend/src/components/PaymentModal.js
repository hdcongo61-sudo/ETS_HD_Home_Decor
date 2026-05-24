import React, { useEffect, useContext, useState } from 'react';
import Modal from './Modal';
import AuthContext from '../context/AuthContext';

const formatAmount = (value) => `${Number(value || 0).toFixed(0)} CFA`;

export const PaymentForm = ({
  sale,
  onAddPayment,
  formId = 'sale-payment-form',
  onSubmittingChange = () => {},
  onSuccess = () => {},
}) => {
  const { auth } = useContext(AuthContext);
  const manualPaymentDateEnabled =
    Boolean(auth?.user?.isAdmin) &&
    Boolean(auth?.user?.adminPreferences?.manualPaymentDateEnabled);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [markAsDelivered, setMarkAsDelivered] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPaid = sale?.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  const balance = Math.max((Number(sale?.totalAmount) || 0) - totalPaid, 0);
  const enteredAmount = Number.parseFloat(amount);
  const canMarkAsDelivered =
    sale?.deliveryStatus !== 'delivered' &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > 0 &&
    enteredAmount >= balance - 0.009;

  useEffect(() => {
    setAmount('');
    setMethod('cash');
    setPaymentDate('');
    setMarkAsDelivered(false);
    setError('');
    setIsSubmitting(false);
    onSubmittingChange(false);
  }, [onSubmittingChange, sale?._id]);

  useEffect(() => {
    if (!canMarkAsDelivered && markAsDelivered) {
      setMarkAsDelivered(false);
    }
  }, [canMarkAsDelivered, markAsDelivered]);

  useEffect(() => {
    onSubmittingChange(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Montant invalide');
      return;
    }

    if (paymentAmount > balance) {
      setError(`Le montant ne peut pas dépasser le solde restant (${formatAmount(balance)})`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onAddPayment({
        amount: paymentAmount,
        method,
        paymentDate: manualPaymentDateEnabled && paymentDate ? paymentDate : undefined,
        markAsDelivered,
      });
      onSuccess();
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">Client</span>
          <span className="font-medium text-gray-900">
            {sale.client?.name || 'Non spécifié'}
          </span>

          <span className="text-gray-500">Total</span>
          <span className="font-semibold text-gray-900">
            {formatAmount(sale.totalAmount)}
          </span>

          <span className="text-gray-500">Déjà payé</span>
          <span className="text-green-600 font-medium">
            {formatAmount(totalPaid)}
          </span>

          <span className="text-gray-500">Solde restant</span>
          <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatAmount(balance)}
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
                  key={p._id || i}
                  className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm"
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
                      {p.method === 'MobileMoney' ? 'Mobile Money' : p.method}
                    </span>
                    <span className="text-xs text-gray-400">
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('fr-FR') : ''}
                    </span>
                  </div>
                  <span className="font-semibold text-green-600">
                    {formatAmount(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        {manualPaymentDateEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date réelle du paiement
            </label>
            <input
              type="datetime-local"
              value={paymentDate}
              onChange={(e) => {
                setPaymentDate(e.target.value);
                setError('');
              }}
              className="w-full min-h-[44px] px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
            <p className="mt-2 text-xs text-gray-500">
              Optionnel. Utilisez-la pour rattraper un paiement encaissé plus tôt.
            </p>
          </div>
        )}

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
            <span className="absolute right-3 top-3 text-gray-500 text-sm">CFA</span>
          </div>
        </div>

        {canMarkAsDelivered && (
          <button
            type="button"
            onClick={() => setMarkAsDelivered((current) => !current)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
              markAsDelivered
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            aria-pressed={markAsDelivered}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Marquer comme livrée automatiquement
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Cette vente sera marquée livrée dès que ce paiement solde le total.
                </p>
              </div>
              <span
                className={`mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  markAsDelivered ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
                }`}
              >
                <span className="mx-1 h-4 w-4 rounded-full bg-white shadow-sm" />
              </span>
            </div>
          </button>
        )}

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
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

const PaymentModal = ({ show, onClose, sale, onAddPayment }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalPaid = sale?.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  const balance = Math.max((Number(sale?.totalAmount) || 0) - totalPaid, 0);

  if (!sale) return null;

  return (
    <Modal
      isOpen={show}
      onClose={onClose}
      title="Ajouter un paiement"
      subtitle={sale.client?.name ? `${sale.client.name} · Solde: ${formatAmount(balance)}` : undefined}
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
      <PaymentForm
        sale={sale}
        onAddPayment={onAddPayment}
        formId="sale-payment-form"
        onSubmittingChange={setIsSubmitting}
      />
    </Modal>
  );
};

export default PaymentModal;
