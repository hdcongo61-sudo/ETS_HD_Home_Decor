// components/GlobalExpenseModal.js
import React, { useCallback, useState } from 'react';
import { Check, Loader2, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useModal } from '../context/ModalContext';
import Modal from './Modal';
import ExpenseForm from './ExpenseForm';
import { confirmDialog } from './ConfirmProvider';
import { getErrorMessage } from '../utils/errorModel';

const GlobalExpenseModal = () => {
  const { activeModal, closeModal } = useModal();
  const isOpen = activeModal === 'expense';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const requestClose = useCallback(async () => {
    if (isSubmitting) return;
    if (isDirty) {
      const discard = await confirmDialog('Les informations saisies seront perdues.', {
        title: 'Abandonner cette dépense ?',
        confirmLabel: 'Abandonner',
        danger: true,
      });
      if (!discard) return;
    }
    setIsDirty(false);
    closeModal();
  }, [closeModal, isDirty, isSubmitting]);

  const handleSubmit = async (payload) => {
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/expenses', payload, { __queueOffline: true });
      setIsDirty(false);
      closeModal();
      if (data?.queued) {
        toast.success('Dépense enregistrée hors-ligne — sera synchronisée.');
      } else {
        toast.success('Dépense enregistrée — données à jour.');
        window.dispatchEvent(new CustomEvent('expenseCreated'));
      }
      return true;
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error(getErrorMessage(error, "Erreur lors de l'enregistrement de la dépense."));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title="Nouvelle dépense"
      subtitle="Saisissez le montant, la catégorie et le motif. Le mode de paiement est facultatif."
      size="lg"
      mobileFullscreen
      suppressGlobal={false}
      icon={<Receipt size={20} />}
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={isSubmitting}
            className="ms-button ms-button-secondary ms-button-md w-full disabled:opacity-60 sm:w-auto"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-expense-form"
            disabled={isSubmitting}
            className="ms-button ms-button-primary ms-button-md w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check size={18} />
                Enregistrer la dépense
              </>
            )}
          </button>
        </>
      }
    >
      <div onInputCapture={() => setIsDirty(true)} onChangeCapture={() => setIsDirty(true)}>
        <ExpenseForm
          onSubmit={handleSubmit}
          submitting={isSubmitting}
          formId="global-expense-form"
          hideSubmit
        />
      </div>
    </Modal>
  );
};

export default GlobalExpenseModal;
