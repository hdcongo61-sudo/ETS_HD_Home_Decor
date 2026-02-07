import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLoader from './AppLoader';

const LoaderOverlay = ({ show = false, text = 'Chargement...' }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center"
          >
            <AppLoader fullScreen={false} text={text} textClassName="text-white" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoaderOverlay;
