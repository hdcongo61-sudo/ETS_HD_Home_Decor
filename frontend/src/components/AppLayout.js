import React from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * AppLayout – Wrapper for consistent mobile/desktop SaaS layout.
 * No business logic. Provides:
 * - Responsive max-width and padding
 * - Safe-area insets for notched devices (iOS/Android)
 * - Consistent vertical spacing
 */
const AppLayout = ({ children, className = '', fullWidth = false }) => {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`
        app-page-frame w-full mx-auto
        px-4 sm:px-5 md:px-6 lg:px-8
        py-4 sm:py-6 md:py-8
        safe-area-padding
        ${fullWidth ? 'max-w-full' : 'max-w-[1600px]'}
        ${className}
      `}
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
    >
      {children}
    </motion.div>
  );
};

export default AppLayout;
