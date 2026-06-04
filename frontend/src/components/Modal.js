import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

let openModalCount = 0;
let previousBodyOverflow = '';

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
  panelClassName = '',
  footerClassName = '',
  noPadding = false,
  closeOnBackdrop = true,
  hideCloseButton = false,
  headerAction = null,
  icon = null,
  mobileFullscreen = false,
  'aria-label': ariaLabel,
}) => {
  const open = isOpen ?? show;
  const titleId = useId();
  const subtitleId = useId();
  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-2xl',
    lg: 'sm:max-w-4xl',
    xl: 'sm:max-w-6xl',
    full: 'sm:max-w-[min(1180px,calc(100vw-2rem))]',
  };

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    if (openModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModalCount += 1;

    return () => {
      document.removeEventListener('keydown', handleEscape);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[260] overflow-hidden"
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel || (title ? undefined : 'Fenêtre de dialogue')}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={subtitle ? subtitleId : undefined}
    >
      <motion.div
        className="fixed inset-0 bg-[rgba(32,31,30,0.36)] backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />

      <div className="pointer-events-none relative flex h-full min-h-full items-end justify-center px-0 pt-[env(safe-area-inset-top)] sm:items-center sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
          className={`
            pointer-events-auto relative flex w-full ${sizeClasses[size] || sizeClasses.md} flex-col overflow-hidden
            bg-[var(--ms-white)] text-[var(--ms-text)]
            ${mobileFullscreen ? 'h-[100dvh] rounded-none' : 'max-h-[92dvh] rounded-t-lg'}
            border border-[var(--ms-border)] sm:max-h-[min(88dvh,860px)] sm:rounded-lg
            shadow-[var(--ms-shadow-lg)]
            safe-area-bottom
            ${panelClassName}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 justify-center pb-2 pt-2.5 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-[var(--ms-border)]" aria-hidden />
          </div>

          <div className="shrink-0 border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 pb-4 pt-0 sm:px-6 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {icon && (
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] text-[var(--ms-text)]">
                    {icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 id={titleId} className="truncate text-[17px] font-semibold text-[var(--ms-text-strong)] sm:text-xl">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p id={subtitleId} className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--ms-text-muted)] sm:text-[15px]">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {headerAction}
                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="ms-icon-button"
                    aria-label="Fermer"
                  >
                    <X size={20} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            className={`
              min-h-0 flex-1 overflow-y-auto overscroll-contain
              ${noPadding ? '' : 'px-4 py-4 sm:px-6 sm:py-5'}
              ${contentClassName}
            `}
          >
            {children}
          </div>

          {footer && (
            <div className={`shrink-0 border-t border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3 sm:px-6 sm:py-4 ${footerClassName}`}>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                {footer}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(
    <AnimatePresence mode="wait">
      {modal}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
