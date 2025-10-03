// src/config.js
export const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5001/api'  // Backend URL
  : '/api';  // Production URL