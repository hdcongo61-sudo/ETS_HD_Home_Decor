import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileDown, X } from "lucide-react";

const ExportModal = ({
  show,
  onClose,
  onExport,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}) => {
  const modalRef = useRef();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50"
        >
          <motion.div
            ref={modalRef}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-md border dark:border-gray-700"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Exporter les Données</h2>
              <button onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Date début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Date fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <button
                onClick={onExport}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <FileDown size={18} />
                Exporter (Excel/PDF)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExportModal;
