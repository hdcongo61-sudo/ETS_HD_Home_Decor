import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const token = localStorage.getItem('token');
  const [auth, setAuth] = useState({
    isAuthenticated: Boolean(token),
    user: null,
    isAdmin: false,
    isLoading: false
  });

  useEffect(() => {
    const checkAuth = async () => {
      if (!localStorage.getItem('token')) return;
      try {
        const { data } = await api.get('/users/me');
        setAuth({
          isAuthenticated: true,
          user: data,
          isAdmin: data.isAdmin,
          isLoading: false
        });
      } catch (error) {
        if (error.response?.status === 403) {
          const payload = {
            message: error.response.data?.message || 'Accès restreint. Veuillez contacter un administrateur.',
            accessStart: error.response.data?.accessStart || null,
            accessEnd: error.response.data?.accessEnd || null,
          };
          sessionStorage.setItem('accessRestrictionInfo', JSON.stringify(payload));
          localStorage.removeItem('token');
          window.location.replace('/access-restricted');
          return;
        }

        localStorage.removeItem('token');
        setAuth({
          isAuthenticated: false,
          user: null,
          isAdmin: false,
          isLoading: false
        });
      }
    };

    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ auth, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
