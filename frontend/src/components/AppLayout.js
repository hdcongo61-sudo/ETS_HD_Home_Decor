import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`
        app-page-frame w-full mx-auto
        px-3 sm:px-4 md:px-5 lg:px-6
        py-3 sm:py-4 md:py-5
        safe-area-padding
        ${fullWidth ? 'max-w-full' : 'max-w-[1600px]'}
        ${className}
      `}
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        // Mobile: clears the fixed bottom tab bar; desktop: normal spacing.
        paddingBottom: 'var(--page-bottom-pad)',
      }}
    >
      {children}
    </motion.div>
  );
};

export default AppLayout;
