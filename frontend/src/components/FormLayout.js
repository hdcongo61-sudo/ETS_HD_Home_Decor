import React from "react";

/**
 * FormLayout – Responsive form grid: 1 column on mobile, 2 columns on md+.
 * No business logic. Use for long forms.
 */
export const FormLayout = ({ children, className = "" }) => (
  <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 ${className}`}>
    {children}
  </div>
);

/**
 * FormLayoutFullWidth – Single full-width row (e.g. for one field spanning both columns).
 */
export const FormLayoutFullWidth = ({ children, className = "" }) => (
  <div className={`md:col-span-2 ${className}`}>{children}</div>
);

/**
 * FormActionsSticky – Sticky bottom bar for form actions on mobile (Enregistrer, Annuler).
 * Renders inline on desktop, sticky at bottom on mobile.
 */
export const FormActionsSticky = ({ children, className = "" }) => (
  <div
    className={`
      flex flex-wrap items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--ms-border)]
      sticky bottom-0 left-0 right-0 z-10 bg-[var(--ms-white)] -mx-4 px-4 py-3
      md:static md:bg-transparent md:-mx-0 md:px-0 md:py-0 md:border-t md:mt-6
      safe-area-padding
      ${className}
    `}
    style={{
      paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
    }}
  >
    {children}
  </div>
);

export default FormLayout;
