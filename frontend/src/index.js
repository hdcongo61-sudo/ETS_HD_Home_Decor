import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Import crucial ici
import { bootstrapBrandTheme } from './utils/appBranding';
import {
  register as registerServiceWorker,
  unregister as unregisterServiceWorker
} from './serviceWorkerRegistration';

// Theme the very first paint from the last-known brand colour (avoids a flash
// of the default accent before app settings load).
bootstrapBrandTheme();

const root = createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (process.env.NODE_ENV === 'production') {
  registerServiceWorker({
    onUpdate: (registration) => {
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  });
} else {
  unregisterServiceWorker();
}
