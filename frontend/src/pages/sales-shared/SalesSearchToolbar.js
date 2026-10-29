import React, { useId } from 'react';
import { Search, X } from 'lucide-react';

export default function SalesSearchToolbar({ value, onChange, filters = [], onReset, count }) {
  const id = useId();
  return <div className="mb-4 space-y-3">
    <label htmlFor={id} className="block text-sm font-semibold text-[var(--ms-text)]">Rechercher une vente</label>
    <div className="relative">
      <Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-[var(--ms-text-muted)]" />
      <input id={id} type="search" value={value} onChange={event => onChange(event.target.value)}
        placeholder="Référence, nom ou téléphone du client" className="w-full min-h-[44px] rounded-md border border-[var(--ms-border)] bg-white pl-10 pr-3 py-2 text-base text-[var(--ms-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]" />
    </div>
    <p role="status" aria-live="polite" className="text-sm text-[var(--ms-text-muted)]">
      {count} vente{count === 1 ? '' : 's'} affichée{count === 1 ? '' : 's'} · {filters.length ? 'Filtres actifs ci-dessous' : 'Toutes les dates'}
    </p>
    {(filters.length > 0 || value) && <div className="flex flex-wrap items-center gap-2" aria-label="Recherche et filtres actifs">
      {value && <button type="button" className="ms-button ms-button-secondary min-h-[44px]" onClick={() => onChange('')} aria-label="Effacer la recherche">Recherche : {value}<X aria-hidden="true" className="ml-2 h-4 w-4" /></button>}
      {filters.map(filter => <button key={filter.key} type="button" className="ms-button ms-button-secondary min-h-[44px]" onClick={filter.onRemove} aria-label={'Retirer le filtre ' + filter.label}>{filter.label}<X aria-hidden="true" className="ml-2 h-4 w-4" /></button>)}
      <button type="button" className="ms-button ms-button-secondary min-h-[44px]" onClick={onReset}>Tout effacer</button>
    </div>}
  </div>;
}
