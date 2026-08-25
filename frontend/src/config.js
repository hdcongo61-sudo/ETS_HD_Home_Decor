// src/config.js
export const API_URL = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:5002/api'  // Backend URL
    : 'https://ets-hd-home-decor.onrender.com'  // Production URL
);
