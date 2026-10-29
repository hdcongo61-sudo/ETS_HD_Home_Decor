import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { normalizeApiError } from '../utils/errorModel';

const SectionError = ({ error, onRetry, title, className = '' }) => {
  const normalized = normalizeApiError(error, 'Les données de cette section sont indisponibles.');

  return (
    <div className={`rounded-[var(--radiusLarge)] border border-[var(--colorStatusDangerStroke1)] bg-[var(--colorStatusDangerBackground1)] p-4 ${className}`} role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--colorStatusDangerForeground1)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--colorStatusDangerForeground1)]">{title || normalized.title}</p>
          <p className="mt-1 text-sm text-[var(--colorNeutralForeground2)]">{normalized.message}</p>
          {normalized.requestId && <p className="mt-2 text-xs text-[var(--colorNeutralForeground3)]">Référence : {normalized.requestId}</p>}
          {onRetry && normalized.retryable && (
            <button type="button" onClick={onRetry} className="ms-button ms-button-secondary ms-button-sm mt-3">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Réessayer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SectionError;

