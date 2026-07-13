// components/GlobalExpenseModal.js
import React, { useCallback, useState } from 'react';
import { Check, Loader2, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useModal } from '../context/ModalContext';
import Modal from './Modal';
import ExpenseForm from './ExpenseForm';
import { confirmDialog } from './ConfirmProvider';

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
      await api.post('/expenses', payload);
      setIsDirty(false);
      closeModal();
      toast.success('Dépense enregistrée — données à jour.');
      window.dispatchEvent(new CustomEvent('expenseCreated'));
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error(error.response?.data?.message || "Erreur lors de l'enregistrement de la dépense.");
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
      subtitle="Enregistrez une sortie sans quitter votre page actuelle."
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
