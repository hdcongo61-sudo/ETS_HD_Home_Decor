import React from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLocations } from '../context/LocationContext';

/**
 * Sélecteur de boutique (Phase 2.8) affiché dans la barre supérieure.
 * Masqué tant qu'il n'y a qu'une seule boutique et qu'aucune n'est sélectionnée.
 */
const LocationSwitcher = () => {
  const { locations, activeLocation, chooseLocation } = useLocations();

  if (!locations || locations.length === 0) return null;

  return (
    <div className="relative flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--colorNeutralStroke2)] bg-transparent px-2 py-1">
      <MapPin className="h-3.5 w-3.5 text-[var(--colorNeutralForeground3)]" aria-hidden="true" />
      <select
        value={activeLocation ? String(activeLocation._id) : ''}
        onChange={(e) => chooseLocation(e.target.value || null)}
        aria-label="Boutique active"
        title="Changer de boutique"
        className="h-6 max-w-[180px] cursor-pointer appearance-none bg-transparent pr-4 text-[12px] font-medium text-[var(--colorNeutralForeground1)] outline-none"
      >
        {!activeLocation && <option value="">Choisir une boutique…</option>}
        {locations.map((loc) => (
          <option key={loc._id} value={String(loc._id)}>
            {loc.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-[var(--colorNeutralForeground3)]" aria-hidden="true" />
    </div>
  );
};

export default LocationSwitcher;
