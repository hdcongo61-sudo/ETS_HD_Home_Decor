import React from "react";
import Modal from "./Modal";

export default function ErrorModal({ message, onRetry, onClose }) {
  return (
    <Modal
      isOpen={!!message}
      onClose={onClose}
      title="Erreur"
      size="sm"
      footer={
        <>
          {onRetry && (
            <button
              type="button"
              onClick={() => {
                onRetry();
                onClose();
              }}
              className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
            >
              Réessayer
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 touch-manipulation"
          >
            Fermer
          </button>
        </>
      }
    >
      <p className="text-gray-700 dark:text-gray-300">{message}</p>
    </Modal>
  );
}
