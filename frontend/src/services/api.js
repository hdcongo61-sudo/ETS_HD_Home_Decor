import axios from 'axios';

const api = axios.create({
  baseURL: 'https://ets-hd-home-decor.onrender.com',
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
