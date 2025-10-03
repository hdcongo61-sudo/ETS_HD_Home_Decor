import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    user: null,
    isAdmin: false,
    isLoading: true // Ajout d'un état de chargement
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const { data } = await api.get('/users/me');
          setAuth({
            isAuthenticated: true,
            user: data,
            isAdmin: data.isAdmin,
            isLoading: false
          });
        } else {
          setAuth(prev => ({ ...prev, isLoading: false }));
        }
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
      {!auth.isLoading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
