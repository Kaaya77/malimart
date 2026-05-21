import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with auto-reload on new deployment
// skipWaiting + clientsClaim in vite.config means the new SW installs immediately.
// onNeedRefresh fires when a new version is detected — we reload to activate it.
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