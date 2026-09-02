import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useModal } from '../context/ModalContext';

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
  suppressGlobal = true,
  'aria-label': ariaLabel,
}) => {
  const open = isOpen ?? show;
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reduceMotion = useReducedMotion();
  const { suppressGlobalModals } = useModal();
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
    previouslyFocusedRef.current = document.activeElement;
    // Page-level modals suppress the global FAB/modals. The global sale/payment
    // modals themselves must opt out, otherwise opening one suppresses (and
    // closes) itself via GlobalModals.
    const releaseSuppression = suppressGlobal ? suppressGlobalModals() : null;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (panelRef.current && !panelRef.current.contains(document.activeElement)) return;
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => {
      // Ne jamais voler une interaction déjà commencée : si l'utilisateur a
      // déjà cliqué dans le panneau (focus déjà à l'intérieur), on ne déplace
      // pas le focus — sinon le premier clic sur un champ est « avalé » (le
      // focus saute vers le premier élément et il faut re-cliquer).
      if (panelRef.current && panelRef.current.contains(document.activeElement)) return;
      const preferred = panelRef.current?.querySelector('[autofocus], [data-autofocus]');
      const first = panelRef.current?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]');
      try {
        (preferred || first || panelRef.current)?.focus({ preventScroll: true });
      } catch (_) {
        (preferred || first || panelRef.current)?.focus();
      }
    });
    if (openModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModalCount += 1;

    return () => {
      releaseSuppression?.();
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      if (previouslyFocusedRef.current?.isConnected) {
        try {
          previouslyFocusedRef.current.focus({ preventScroll: true });
        } catch (_) {
          previouslyFocusedRef.current.focus();
        }
      }
    };
  }, [open, suppressGlobalModals, suppressGlobal]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-x-0 bottom-0 top-0 md:top-[var(--app-nav-offset,0px)] z-[260] overflow-hidden"
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel || (title ? undefined : 'Fenêtre de dialogue')}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={subtitle ? subtitleId : undefined}
    >
      <motion.div
        className="fixed inset-x-0 bottom-0 top-0 z-0 md:top-[var(--app-nav-offset,0px)] bg-[rgba(32,31,30,0.42)] backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={closeOnBackdrop ? () => onCloseRef.current?.() : undefined}
        aria-hidden
      />

      <div className="sa-overlay-sheet pointer-events-none relative z-10 flex h-full min-h-full items-end justify-center sm:items-center">
        <motion.div
          ref={panelRef}
          tabIndex={-1}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 24, scale: reduceMotion ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.985 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 34, mass: 0.85 }}
          className={`
            pointer-events-auto relative flex w-full ${sizeClasses[size] || sizeClasses.md} flex-col overflow-hidden
            bg-[var(--ms-white)] text-[var(--ms-text)]
            ${mobileFullscreen ? 'h-full rounded-none' : 'max-h-[92dvh] rounded-t-2xl'}
            border border-[var(--colorNeutralStroke1)] sm:max-h-[min(88dvh,860px)] sm:rounded-2xl
            shadow-[var(--shadow16)]
            sa-sheet-panel
            ${panelClassName}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 justify-center pb-2 pt-2.5 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-[var(--ms-border)]" aria-hidden />
          </div>

          <div className="shrink-0 border-b border-[var(--colorNeutralStroke3)] bg-[var(--ms-white)] px-4 pb-4 pt-0 sm:px-6 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {icon && (
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[var(--colorBrandForeground1)]"
                    style={{ background: 'var(--ms-blue-soft)' }}
                  >
                    {icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 id={titleId} className="truncate text-[17px] font-semibold tracking-tight text-[var(--ms-text-strong)] sm:text-lg">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p id={subtitleId} className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--ms-text-muted)]">
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
                    onClick={() => onCloseRef.current?.()}
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
            <div className={`shrink-0 border-t border-[var(--colorNeutralStroke3)] bg-[var(--ms-white)] px-4 py-3 sm:px-6 sm:py-4 ${footerClassName}`}>
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
