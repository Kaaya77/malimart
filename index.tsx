import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './src/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          60_000,   // treat data as fresh for 1 min by default
      gcTime:             5 * 60_000, // keep unused cache for 5 min
      retry:              1,
      refetchOnWindowFocus: false,  // avoid surprise refetches when switching tabs
    },
  },
});
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

// Service worker update strategy:
// registerType:'prompt' + skipWaiting:false means new SWs WAIT until we tell
// them to activate. When onNeedRefresh fires the new SW is sitting in "waiting"
// state — the old SW (and its cached chunks) is still fully in control.
// updateSW(true) sends SKIP_WAITING, activates the new SW, then reloads.
// This eliminates the race where skipWaiting:true would activate a new SW
// mid-page-load, clean up old chunk hashes, and leave lazy imports broken
// until a hard reset.
const updateSW = registerSW({
  onNeedRefresh() {
    // Safe to reload now: new SW is waiting with full new cache ready.
    updateSW(true);
  },
  onOfflineReady() {},
  onRegisteredSW(_url, registration) {
    // Check for updates every 5 minutes while the tab is open.
    registration && setInterval(() => registration.update(), 5 * 60_000);
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);