import React, { useState, useEffect } from "react";

/**
 * AccordionSection – On mobile (max-md) content is collapsible; on desktop always expanded.
 * No business logic. Used for secondary dashboard sections on mobile.
 */
const AccordionSection = ({ title, children, defaultOpenDesktop = true, className = "" }) => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      if (desktop) setOpen(true);
      else if (defaultOpenDesktop) setOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [defaultOpenDesktop]);

  const alwaysExpanded = isDesktop && defaultOpenDesktop;

  return (
    <section className={`border border-[var(--ms-border)] rounded-lg overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => !alwaysExpanded && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-[var(--ms-white)] hover:bg-[var(--ms-bg-subtle)] transition-colors ${!alwaysExpanded ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={open}
      >
        <span className="font-semibold text-[var(--ms-text)]">{title}</span>
        {!alwaysExpanded && (
          <span className="text-[var(--ms-text-muted)] transform transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        )}
      </button>
      {(alwaysExpanded || open) && <div className="border-t border-[var(--ms-border)]">{children}</div>}
    </section>
  );
};

export default AccordionSection;
