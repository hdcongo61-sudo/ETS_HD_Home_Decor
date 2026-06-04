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
  onStartDateChange,
  onEndDateChange,
  exporting = false,
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
          disabled={exporting}
          className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 touch-manipulation"
        >
          <FileDown size={18} />
          {exporting ? "Export..." : "Exporter Excel"}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--ms-blue)]/20 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            Choisissez la période à exporter
          </p>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">
            {filterLabel || "Période personnalisée"}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Date début
            </span>
            <input
              type="date"
              value={startDate || ""}
              max={endDate || undefined}
              onChange={(e) => onStartDateChange?.(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Date fin
            </span>
            <input
              type="date"
              value={endDate || ""}
              min={startDate || undefined}
              onChange={(e) => onEndDateChange?.(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Le fichier contient les ventes, encaissements, dépenses et profit pour les dates choisies.
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;
