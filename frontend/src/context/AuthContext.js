import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const token = localStorage.getItem('token');
  const [auth, setAuth] = useState({
    isAuthenticated: Boolean(token),
    user: null,
    isAdmin: false,
    isSuperAdmin: false,
    tenantId: localStorage.getItem('tenantId') || null,
    isLoading: true,
  });

  useEffect(() => {
    const checkAuth = async () => {
      if (!localStorage.getItem('token')) {
        setAuth((prev) => ({ ...prev, isLoading: false }));
        return;
      }
      try {
        const { data } = await api.get('/users/me');
        const tenantId = data.tenantId || null;
        if (tenantId) localStorage.setItem('tenantId', tenantId);
        else localStorage.removeItem('tenantId');

        setAuth({
          isAuthenticated: true,
          user: data,
          isAdmin: Boolean(data.isAdmin),
          isSuperAdmin: Boolean(data.isSuperAdmin),
          tenantId,
          isLoading: false,
        });
      } catch (error) {
        if (error.response?.status === 403) {
          const code = error.response.data?.code;

          // Tenant suspension / expiry — show specific message
          if (code === 'TENANT_SUSPENDED' || code === 'TENANT_EXPIRED') {
            const payload = {
              message: error.response.data?.message,
              code,
              trialEndsAt: error.response.data?.trialEndsAt || null,
            };
            sessionStorage.setItem('tenantRestrictionInfo', JSON.stringify(payload));
            localStorage.removeItem('token');
            localStorage.removeItem('tenantId');
            window.location.replace('/access-restricted');
            return;
          }

          // Time-window access restriction
          const payload = {
            message: error.response.data?.message || 'Accès restreint.',
            accessStart: error.response.data?.accessStart || null,
            accessEnd: error.response.data?.accessEnd || null,
          };
          sessionStorage.setItem('accessRestrictionInfo', JSON.stringify(payload));
          localStorage.removeItem('token');
          localStorage.removeItem('tenantId');
          window.location.replace('/access-restricted');
          return;
        }

        localStorage.removeItem('token');
        localStorage.removeItem('tenantId');
        setAuth({ isAuthenticated: false, user: null, isAdmin: false, isSuperAdmin: false, tenantId: null, isLoading: false });
      }
    };

    checkAuth();
  }, []);

  // Intercept setAuth to keep tenantId in localStorage in sync
  const setAuthWithStorage = (nextAuth) => {
    setAuth((prev) => {
      const resolved = typeof nextAuth === 'function' ? nextAuth(prev) : nextAuth;
      if (resolved.tenantId) localStorage.setItem('tenantId', resolved.tenantId);
      else localStorage.removeItem('tenantId');
      return resolved;
    });
  };

  return (
    <AuthContext.Provider value={{ auth, setAuth: setAuthWithStorage }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
