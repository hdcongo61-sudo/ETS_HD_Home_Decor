import React from 'react';
import { Search, X } from 'lucide-react';

const cx = (...classes) => classes.filter(Boolean).join(' ');

export const Workspace = React.memo(({ children, className = '' }) => (
  <div className={cx('ms-workspace', className)}>{children}</div>
));

export const PageHeader = React.memo(({ eyebrow, title, description, meta, actions }) => (
  <header className="ms-page-header">
    <div className="min-w-0">
      {eyebrow && <p className="ms-eyebrow">{eyebrow}</p>}
      <h1 className="ms-page-title">{title}</h1>
      {description && <p className="ms-page-description">{description}</p>}
      {meta && <div className="ms-page-meta">{meta}</div>}
    </div>
    {actions && <div className="ms-page-actions">{actions}</div>}
  </header>
));

export const CommandBar = React.memo(({ children, className = '' }) => (
  <div className={cx('ms-command-bar', className)}>{children}</div>
));

export const Button = React.memo(({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}) => (
  <button
    {...props}
    className={cx('ms-button', `ms-button-${variant}`, `ms-button-${size}`, className)}
  >
    {children}
  </button>
));

export const IconButton = React.memo(({ label, children, className = '', ...props }) => (
  <button {...props} className={cx('ms-icon-button', className)} aria-label={label} title={label}>
    {children}
  </button>
));

export const Surface = React.memo(({ children, className = '' }) => (
  <section className={cx('ms-surface', className)}>{children}</section>
));

export const ChartCard = React.memo(({ title, description, actions, children, className = '' }) => (
  <section className={cx('ms-chart-card', className)}>
    {(title || description || actions) && (
      <div className="ms-chart-card-header">
        <div className="min-w-0">
          {title && <h2 className="ms-section-title">{title}</h2>}
          {description && <p className="ms-section-description">{description}</p>}
        </div>
        {actions && <div className="ms-chart-card-actions">{actions}</div>}
      </div>
    )}
    <div className="ms-chart-card-body">{children}</div>
  </section>
));

export const DataTable = React.memo(({ children, className = '' }) => (
  <div className={cx('ms-table-wrap', className)}>{children}</div>
));

export const StatusBadge = React.memo(({ tone = 'neutral', children, className = '' }) => (
  <span className={cx('ms-status-badge', `ms-status-${tone}`, className)}>{children}</span>
));

export const KPICard = React.memo(({ title, value, context, icon, tone = 'neutral' }) => (
  <article className="ms-kpi-card">
    <div>
      <p className="ms-kpi-title">{title}</p>
      <p className="ms-kpi-value">{value}</p>
      {context && <p className="ms-kpi-context">{context}</p>}
    </div>
    {icon && <div className={cx('ms-kpi-icon', `ms-kpi-icon-${tone}`)}>{icon}</div>}
  </article>
));

export const EmptyState = React.memo(({ title, description, action }) => (
  <div className="ms-empty-state">
    <p className="ms-empty-title">{title}</p>
    {description && <p className="ms-empty-description">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
));

export const LoadingSkeleton = React.memo(({ rows = 4 }) => (
  <div className="ms-loading-skeleton" aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <span key={index} />
    ))}
  </div>
));

export const SearchBox = React.memo(({ label = 'Rechercher', className = '', ...props }) => (
  <label className={cx('ms-search-box', className)}>
    <span className="sr-only">{label}</span>
    <Search className="ms-search-box-icon" aria-hidden="true" />
    <input {...props} aria-label={label} />
  </label>
));

export const RightDetailPanel = React.memo(({
  isOpen,
  title,
  subtitle,
  children,
  footer,
  onClose,
  labelledBy = 'right-detail-panel-title',
}) => {
  if (!isOpen) return null;

  return (
    <div className="ms-panel-layer" role="presentation">
      <button type="button" className="ms-panel-scrim" aria-label="Fermer le panneau" onClick={onClose} />
      <aside className="ms-right-panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="ms-panel-header">
          <div className="min-w-0">
            <h2 id={labelledBy} className="ms-panel-title">{title}</h2>
            {subtitle && <p className="ms-panel-subtitle">{subtitle}</p>}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="ms-panel-body">{children}</div>
        {footer && <div className="ms-panel-footer">{footer}</div>}
      </aside>
    </div>
  );
});
