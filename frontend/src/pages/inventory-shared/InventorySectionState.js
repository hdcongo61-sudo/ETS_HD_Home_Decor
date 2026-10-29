import React from 'react';
import SectionError from '../../components/SectionError';
import { LoadingSkeleton } from '../../components/business';

export default function InventorySectionState({ section, children }) {
  return (
    <div aria-busy={section.pending}>
      {section.error && <SectionError error={section.error} onRetry={section.reload} className="mb-3" />}
      {section.loaded && (section.error || section.pending) && (
        <p role="status" className="fui-caption1 mb-3">
          {section.pending ? 'Actualisation en cours. ' : ''}Dernières données chargées ; elles peuvent avoir changé.
        </p>
      )}
      {!section.loaded && section.pending && <LoadingSkeleton rows={4} />}
      {section.loaded && children}
    </div>
  );
}
