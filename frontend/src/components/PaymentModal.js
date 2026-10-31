import React, { useEffect, useContext, useState, useRef } from 'react';
import { formatCfa } from '../utils/format';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import Modal from './Modal';
import AuthContext from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorModel';

const noop = () => {};
const formatAmount = (value) => formatCfa(value);

export const PaymentForm = ({
  sale,
  onAddPayment,
  formId = 'sale-payment-form',
  onSubmittingChange = noop,
  onSuccess = noop,
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
  const submissionLock = useRef(false);
  const amountRef = useRef(null);

  const totalPaid = sale?.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  const balance = Math.max((Number(sale?.totalAmount) || 0) - totalPaid, 0);
  const enteredAmount = Number(amount);
  const validAmount = Number.isFinite(enteredAmount) && enteredAmount > 0 && enteredAmount <= balance;
  const paidProgress = Number(sale?.totalAmount) > 0 ? Math.min(100, Math.max(0, Math.round(totalPaid / Number(sale.totalAmount) * 100))) : 0;
  const canMarkAsDelivered =
    sale?.deliveryStatus !== 'delivered' &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > 0 &&
    validAmount && enteredAmount === balance;

  useEffect(() => {
    submissionLock.current = false;
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
    if (submissionLock.current) return;
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError('Saisissez un montant supérieur à 0 CFA.');
      amountRef.current?.focus();
      return;
    }

    if (paymentAmount > balance) {
      setError(`Le montant ne peut pas dépasser le solde restant (${formatAmount(balance)}).`);
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      await onAddPayment({
        amount: paymentAmount,
        method,
        paymentDate: manualPaymentDateEnabled && paymentDate ? paymentDate : undefined,
        markAsDelivered,
      });
      window.dispatchEvent(new CustomEvent('paymentCreated'));
      onSuccess({ amount: paymentAmount, balance: Math.max(0, balance - paymentAmount) });
    } catch (submissionError) {
      submissionLock.current = false;
      const fallbackMessage = "Impossible d'ajouter le paiement. Veuillez réessayer.";
      setError(getErrorMessage(submissionError, fallbackMessage));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sale) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]/50 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-[var(--ms-text-muted)]">Client</span>
          <span className="font-medium text-[var(--ms-text-strong)]">
            {sale.client?.name || 'Non spécifié'}
          </span>

          <span className="text-[var(--ms-text-muted)]">Total</span>
          <span className="font-semibold text-[var(--ms-text-strong)]">
            {formatAmount(sale.totalAmount)}
          </span>

          <span className="text-[var(--ms-text-muted)]">Déjà payé</span>
          <span className="text-[var(--ms-success)] font-medium">
            {formatAmount(totalPaid)}
          </span>

          <span className="text-[var(--ms-text-muted)]">Solde restant</span>
          <span className={`font-semibold ${balance > 0 ? 'text-[var(--ms-danger)]' : 'text-[var(--ms-success)]'}`}>
            {formatAmount(balance)}
          </span>
        </div>

        <div className="mt-4" role="progressbar" aria-label="Part de la vente déjà payée" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidProgress}>
          <div className="mb-1 flex justify-between text-xs text-[var(--ms-text-muted)]"><span>Déjà payé</span><span>{paidProgress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--colorNeutralBackground3)]">
            <div className="h-full rounded-full bg-[var(--colorStatusSuccessForeground1)]" style={{ width: paidProgress + '%' }} />
          </div>
        </div>

        {sale.payments?.length > 0 && (
          <div className="mt-4 border-t border-[var(--ms-border)] pt-3">
            <h3 className="text-sm font-medium text-[var(--ms-text)] mb-2">
              Historique des paiements
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 pr-1">
              {sale.payments.map((p, i) => (
                <div
                  key={p._id || i}
                  className="flex justify-between items-center bg-[var(--ms-white)] p-2.5 rounded-lg border border-[var(--ms-border)] shadow-[var(--ms-shadow-sm)]"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <div
                      className={`p-1.5 rounded-lg ${
                        p.method === 'cash'
                          ? 'bg-[var(--ms-blue-soft)] text-[var(--ms-blue)]'
                          : p.method === 'MobileMoney'
                          ? 'bg-[var(--ms-success)]/15 text-[var(--ms-success)]'
                          : 'bg-purple-100 text-purple-600'
                      }`}
                    >
                      💳
                    </div>
                    <span className="capitalize">
                      {p.method === 'MobileMoney' ? 'Mobile Money' : p.method}
                    </span>
                    <span className="text-xs text-[var(--ms-text-muted)]">
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('fr-FR') : ''}
                    </span>
                  </div>
                  <span className="font-semibold text-[var(--ms-success)]">
                    {formatAmount(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <form id={formId} onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} className="space-y-5">
        <fieldset disabled={isSubmitting || balance <= 0 || submissionLock.current} className="min-w-0 space-y-5">
        {balance <= 0 && <p role="status" className="text-sm text-[var(--ms-success)]">Cette vente est déjà soldée. Aucun paiement supplémentaire n’est nécessaire.</p>}
        {manualPaymentDateEnabled && (
          <div>
            <label className="block text-sm font-medium text-[var(--ms-text)] mb-2">
              Date réelle du paiement
            </label>
            <input
              type="datetime-local"
              value={paymentDate}
              onChange={(e) => {
                setPaymentDate(e.target.value);
                setError('');
              }}
              className="form-control"
            />
            <p className="mt-2 text-xs text-[var(--ms-text-muted)]">
              Optionnel. Utilisez-la pour rattraper un paiement encaissé plus tôt.
            </p>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor={`${formId}-amount`} className="block text-sm font-medium text-[var(--ms-text)]">
              Montant à payer
            </label>
            {balance > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAmount(String(balance));
                  setError('');
                }}
                className="text-xs font-semibold text-[var(--ms-blue)] hover:underline"
              >
                Solde complet ({formatAmount(balance)})
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id={`${formId}-amount`}
              ref={amountRef}
              type="number"
              step="0.01"
              min="0.01"
              max={balance}
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="0"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={`${formId}-preview${error ? ` ${formId}-error` : ''}`}
              className="form-control pr-14 text-lg font-semibold"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--ms-text-muted)]">CFA</span>
          </div>
        </div>

        <p id={`${formId}-preview`} role="status" className="rounded-md border border-[var(--ms-border)] p-3 text-sm">
          {validAmount ? `Après ce paiement : ${formatAmount(balance - enteredAmount)} restant${balance === enteredAmount ? ' — vente soldée' : ''}.` : `Solde disponible : ${formatAmount(balance)}.`}
        </p>

        {canMarkAsDelivered && (
          <button
            type="button"
            onClick={() => setMarkAsDelivered((current) => !current)}
            className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
              markAsDelivered
                ? 'border-green-300 bg-[var(--ms-success)]/10'
                : 'border-[var(--ms-border)] bg-[var(--ms-white)] hover:border-[var(--ms-border-strong)]'
            }`}
            aria-pressed={markAsDelivered}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ms-text-strong)]">
                  Marquer comme livrée automatiquement
                </p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                  Cette vente sera marquée livrée dès que ce paiement solde le total.
                </p>
              </div>
              <span
                className={`mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  markAsDelivered ? 'bg-[var(--ms-success)]/100 justify-end' : 'bg-gray-300 justify-start'
                }`}
              >
                <span className="mx-1 h-4 w-4 rounded-full bg-[var(--ms-white)] shadow-[var(--ms-shadow-sm)]" />
              </span>
            </div>
          </button>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--ms-text)] mb-3">
            Méthode de paiement
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['cash', 'MobileMoney', 'credit'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setMethod(opt)}
                aria-pressed={method === opt}
                className={`min-h-[44px] p-3 rounded-md border-2 text-sm font-medium transition-all touch-manipulation ${
                  method === opt
                    ? 'border-[var(--ms-blue)] bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)]'
                    : 'border-[var(--ms-border)] bg-[var(--ms-white)] hover:border-[var(--ms-border-strong)]'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`p-2 rounded-lg ${
                      opt === 'cash'
                        ? 'bg-[var(--ms-blue-soft)] text-[var(--ms-blue)]'
                        : opt === 'MobileMoney'
                        ? 'bg-[var(--ms-success)]/15 text-[var(--ms-success)]'
                        : 'bg-purple-100 text-purple-600'
                    }`}
                  >
                    {opt === 'cash' ? <Banknote className="h-5 w-5" aria-hidden="true" /> : opt === 'MobileMoney' ? <Smartphone className="h-5 w-5" aria-hidden="true" /> : <CreditCard className="h-5 w-5" aria-hidden="true" />}
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
          <div id={`${formId}-error`} role="alert" className="p-3 bg-[var(--ms-danger)]/10 border border-red-200 text-[var(--ms-danger)] rounded-md text-sm flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {error}
          </div>
        )}
        </fieldset>
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
      onClose={() => { if (!isSubmitting) onClose(); }}
      title="Ajouter un paiement"
      subtitle={sale.client?.name ? `${sale.client.name} · Solde: ${formatAmount(balance)}` : undefined}
      size="sm"
      mobileFullscreen
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="ms-button ms-button-secondary ms-button-md w-full justify-center sm:w-auto"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="sale-payment-form"
            disabled={isSubmitting || balance <= 0}
            className="ms-button ms-button-primary ms-button-md w-full justify-center sm:w-auto"
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
