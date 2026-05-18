import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Optional: show a prompt to user to reload
  },
  onOfflineReady() {
    // Optional: show a prompt to user that app is ready offline
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