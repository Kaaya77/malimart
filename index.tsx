import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { registerSW } from 'virtual:pwa-register';

// Error monitoring — only loads if VITE_SENTRY_DSN is set in Vercel env vars.
// Dynamic import keeps Sentry out of the bundle entirely when unconfigured.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  import('@sentry/react').then(Sentry => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      // Don't report errors from browser extensions or third-party scripts
      allowUrls: [/malimart/],
    });
  }).catch(() => { /* monitoring is optional — never block the app */ });
}

// Register service worker with auto-reload on new deployment
// skipWaiting + clientsClaim in vite.config means the new SW installs immediately.
// onNeedRefresh fires when a new version is detected — we reload to activate it.
// Unregister any stale SW from previous builds before registering the new one
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => {
      // Only unregister if it's pointing at an old sw.js
      if (reg.active?.scriptURL && !reg.active.scriptURL.includes('/sw.js')) {
        reg.unregister();
      }
    });
  });
}

const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true); // true = force reload, clears stale cache and loads new bundle
  },
  onOfflineReady() {},
  onRegisteredSW(swScriptUrl, registration) {
    // Poll for updates every 60 seconds while the tab is open
    registration && setInterval(() => registration.update(), 60_000);
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);