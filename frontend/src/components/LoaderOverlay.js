import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoaderOverlay = ({ show = false, text = 'Chargement...' }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 bg-opacity-40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="w-16 h-16 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-white text-lg font-medium tracking-wide">{text}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoaderOverlay;
