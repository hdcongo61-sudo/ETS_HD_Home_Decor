import React, { useEffect } from 'react';

/**
 * Shared modal: mobile-first (bottom sheet on small screens, centered on desktop).
 * - Safe area padding, touch-friendly close (min 44px), scrollable body, optional sticky footer.
 * - Accepts both `isOpen` and `show` for compatibility.
 */
const Modal = ({
  isOpen,
  show,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  contentClassName = '',
  noPadding = false,
  'aria-label': ariaLabel,
}) => {
  const open = isOpen ?? show;
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel || title}
    >
      {/* Backdrop: tap to close (Apple-style dimmed) */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[4px] transition-opacity duration-apple ease-apple"
        onClick={onClose}
        aria-hidden
      />

      {/* Container: bottom sheet on mobile, centered on desktop */}
      <div className="flex min-h-full items-end justify-center px-0 pt-0 pb-0 sm:items-center sm:p-4 sm:pb-8">
        <div
          className={`
            relative w-full ${sizeClasses[size]} flex flex-col
            bg-white dark:bg-gray-900 shadow-apple-lg
            rounded-t-apple-xl sm:rounded-apple-xl
            max-h-[94vh] sm:max-h-[88vh]
            border border-gray-200/80 dark:border-gray-700
            safe-area-bottom
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle (mobile only, Apple-style) */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-2 shrink-0">
            <div
              className="w-9 h-1 rounded-full bg-gray-300/90 dark:bg-gray-600"
              aria-hidden
            />
          </div>

          {/* Header: sticky */}
          <div className="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-6 pt-0 sm:pt-6 pb-4 border-b border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] sm:text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-[15px] text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-apple text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-apple ease-apple touch-manipulation"
              aria-label="Fermer"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body: scrollable */}
          <div
            className={`
              flex-1 overflow-y-auto overscroll-contain
              ${noPadding ? '' : 'px-4 sm:px-6 py-4 sm:py-5'}
              ${contentClassName}
            `}
          >
            {children}
          </div>

          {/* Footer: optional, sticky */}
          {footer && (
            <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end sm:items-center rounded-b-2xl safe-area-bottom">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
