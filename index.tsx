import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Telegram WebApp integration (SAFE & OPTIONAL) ---
declare global {
  interface Window {
    Telegram?: any;
  }
}

const tg = window.Telegram?.WebApp;

if (tg) {
  // Tell Telegram the app is ready
  tg.ready();

  // Expand to fullscreen
  tg.expand();

  // Optional: improve game UX
  tg.disableVerticalSwipes?.();
  tg.lockOrientation?.();

  // Debug: user info (remove later if not needed)
  console.log('Telegram user:', tg.initDataUnsafe?.user);
}
// ----------------------------------------------------

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
