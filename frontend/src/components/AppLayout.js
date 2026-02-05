import React from 'react';

/**
 * AppLayout – Wrapper for consistent mobile/desktop SaaS layout.
 * No business logic. Provides:
 * - Responsive max-width and padding
 * - Safe-area insets for notched devices (iOS/Android)
 * - Consistent vertical spacing
 */
const AppLayout = ({ children, className = '', fullWidth = false }) => {
  return (
    <div
      className={`
        w-full
        mx-auto
        px-4 sm:px-5 md:px-6 lg:px-8
        py-5 sm:py-6 md:py-8
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
    </div>
  );
};

export default AppLayout;
