import React from "react";
import { FileDown } from "lucide-react";
import Modal from "./Modal";

const ExportModal = ({
  show,
  onClose,
  onExport,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Date début
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 touch-manipulation"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Date fin
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 touch-manipulation"
          />
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;
