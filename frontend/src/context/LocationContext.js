import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/api';
import AuthContext from './AuthContext';

export const ACTIVE_LOCATION_STORAGE_KEY = 'ets_hd_active_location_id';

const LocationContext = createContext();

/**
 * Boutiques/entrepôts de l'organisation et boutique active (Phase 2.8).
 * Le changement de boutique recharge la page : le header X-Location-Id des
 * appels suivants et l'espace de cache hors ligne sont réajustés.
 */
export const LocationProvider = ({ children }) => {
  const { auth } = useContext(AuthContext);
  const [locations, setLocations] = useState([]);
  const [activeLocationId, setActiveLocationId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY) || null; } catch { return null; }
  });

  useEffect(() => {
    if (!auth?.isAuthenticated || !auth?.tenantId) {
      setLocations([]);
      return undefined;
    }
    let cancelled = false;
    api.get('/locations')
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data.filter((l) => l && l.isActive !== false) : [];
        setLocations(list);
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      });
    return () => { cancelled = true; };
  }, [auth?.isAuthenticated, auth?.tenantId]);

  // Si la boutique mémorisée n'appartient plus à l'organisation (changement de tenant).
  useEffect(() => {
    if (locations.length > 0 && activeLocationId && !locations.some((l) => String(l._id) === String(activeLocationId))) {
      try { localStorage.removeItem(ACTIVE_LOCATION_STORAGE_KEY); } catch {}
      setActiveLocationId(null);
    }
  }, [locations, activeLocationId]);

  const chooseLocation = useCallback((id) => {
    try {
      if (id) localStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, String(id));
      else localStorage.removeItem(ACTIVE_LOCATION_STORAGE_KEY);
    } catch {}
    setActiveLocationId(id ? String(id) : null);
    // Recharge : les données sont re-fetchées avec le bon X-Location-Id.
    window.location.reload();
  }, []);

  const activeLocation = useMemo(
    () => locations.find((l) => String(l._id) === String(activeLocationId)) || null,
    [locations, activeLocationId]
  );

  return (
    <LocationContext.Provider value={{ locations, activeLocation, activeLocationId, chooseLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocations = () => useContext(LocationContext);
export default LocationContext;
