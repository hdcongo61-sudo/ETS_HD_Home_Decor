import React from "react";
import { FileDown } from "lucide-react";
import Modal from "./Modal";

const ExportModal = ({
  show,
  onClose,
  onExport,
  filterLabel,
  startDate,
  endDate,
}) => {
  return (
    <Modal
      isOpen={show}
      onClose={onClose}
      title="Exporter les données"
      size="sm"
      footer={
        <button
          type="button"
          onClick={onExport}
          className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 touch-manipulation"
        >
          <FileDown size={18} />
          Exporter (Excel/PDF)
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            Le fichier suivra le filtre actif du dashboard
          </p>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">
            {filterLabel || "Période filtrée"}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Date début
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {startDate || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Date fin
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {endDate || "—"}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;
