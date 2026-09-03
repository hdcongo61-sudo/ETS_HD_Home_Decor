import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';
import AuthContext from './AuthContext';

const DashboardDataContext = createContext();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const DashboardDataProvider = ({ children }) => {
  const { auth } = useContext(AuthContext);
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const cacheTimestamp = useRef(null);
  const loadingPromise = useRef(null);
  const cacheOwnerRef = useRef(null);

  // Le cache est propre à chaque utilisateur : un vendeur ne doit jamais
  // recevoir les données (admin) d'un utilisateur précédemment connecté,
  // sinon ses cartes « CA du jour » resteraient vides.
  const cacheOwner = auth?.user?._id
    ? `${auth.user._id}:${auth?.isAdmin ? 'admin' : 'member'}`
    : 'anon';

  useEffect(() => {
    if (cacheOwnerRef.current !== cacheOwner) {
      cacheOwnerRef.current = cacheOwner;
      setOverviewData(null);
      cacheTimestamp.current = null;
    }
  }, [cacheOwner]);

  const isCacheValid = useCallback(() => {
    if (!cacheTimestamp.current || !overviewData) return false;
    return Date.now() - cacheTimestamp.current < CACHE_TTL;
  }, [overviewData]);

  const fetchOverviewData = useCallback(async (range = '30days', forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      return overviewData;
    }

    // If already loading, return the existing promise
    if (loadingPromise.current) {
      return loadingPromise.current;
    }

    setLoading(true);

    // Create and store the loading promise
    loadingPromise.current = (async () => {
      try {
        const response = await api.get('/dashboard/overview', {
          params: { range }
        });

        const data = response.data;
        setOverviewData(data);
        cacheTimestamp.current = Date.now();
        return data;
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
        throw err;
      } finally {
        setLoading(false);
        loadingPromise.current = null;
      }
    })();

    return loadingPromise.current;
  }, [overviewData, isCacheValid]);

  const invalidateCache = useCallback(() => {
    setOverviewData(null);
    cacheTimestamp.current = null;
  }, []);

  const updatePartialData = useCallback((updates) => {
    setOverviewData((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  const value = {
    overviewData,
    loading,
    fetchOverviewData,
    invalidateCache,
    updatePartialData,
    isCacheValid: isCacheValid(),
  };

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
};

export const useDashboardData = () => {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider');
  }
  return context;
};

export default DashboardDataContext;
