import React from "react";
import Modal from "./Modal";
import { Button } from "./business";

export default function ErrorModal({ message, onRetry, onClose }) {
  return (
    <Modal
      isOpen={!!message}
      onClose={onClose}
      title="Erreur"
      size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          {onRetry && (
            <Button variant="primary" size="sm" onClick={() => { onRetry(); onClose(); }}>
              Reessayer
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      }
    >
      <p className="text-[var(--ms-text)]">{message}</p>
    </Modal>
  );
}
