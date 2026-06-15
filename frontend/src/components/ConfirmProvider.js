import React, { useEffect, useState } from 'react';
import Modal from './Modal';

/**
 * Imperative, promise-based confirm dialog — a styled replacement for the
 * native window.confirm. Usage anywhere (no hooks needed):
 *
 *   import { confirmDialog } from './ConfirmProvider';
 *   if (!(await confirmDialog('Supprimer ce client ?', { danger: true, confirmLabel: 'Supprimer' }))) return;
 *
 * Mount <ConfirmProvider /> once near the app root (inside ModalProvider).
 */
let externalConfirm = null;

export const confirmDialog = (message, options = {}) =>
  new Promise((resolve) => {
    // Delete-style confirmations (message mentions "supprim…") default to a red
    // "Supprimer" button. Callers can still override via options.
    const isDelete = /supprim/i.test(String(message || ''));
    const payload = {
      message,
      danger: isDelete,
      confirmLabel: isDelete ? 'Supprimer' : undefined,
      ...options,
    };
    if (externalConfirm) externalConfirm({ ...payload, resolve });
    else resolve(window.confirm(message)); // SSR / not-mounted fallback
  });

const ConfirmProvider = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    externalConfirm = (s) => setState(s);
    return () => { externalConfirm = null; };
  }, []);

  const close = (value) => {
    if (state?.resolve) state.resolve(value);
    setState(null);
  };

  if (!state) return null;

  return (
    <Modal
      isOpen
      onClose={() => close(false)}
      title={state.title || 'Confirmation'}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={() => close(false)}
            className="ms-button ms-button-secondary ms-button-md w-full justify-center sm:w-auto"
          >
            {state.cancelLabel || 'Annuler'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus
            className={`ms-button ms-button-md w-full justify-center sm:w-auto ${state.danger ? 'ms-button-danger' : 'ms-button-primary'}`}
          >
            {state.confirmLabel || 'Confirmer'}
          </button>
        </>
      }
    >
      <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>
        {state.message}
      </p>
    </Modal>
  );
};

export default ConfirmProvider;
