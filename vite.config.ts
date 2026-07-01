import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Dev-only implementation of the two Vercel edge functions (api/gemini.ts,
// api/gemini-token.ts). `vite dev` doesn't run Vercel functions, so without
// this every AI feature (chat, image generation, descriptions) 404s locally.
const geminiDevApi = (apiKey: string): Plugin => ({
  name: 'gemini-dev-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/gemini')) return next();
      const fail = (status: number, error: string) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error }));
      };
      if (!apiKey) return fail(503, 'GEMINI_API_KEY not set in .env.local');
      try {
        // Ephemeral token minting for the Live (voice) API
        if (req.url.startsWith('/api/gemini-token')) {
          const r = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              uses: 1,
              expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
            }),
          });
          res.statusCode = r.status;
          res.setHeader('content-type', 'application/json');
          res.end(await r.text());
          return;
        }
        // Generic proxy: /api/gemini/<upstream path>?<qs>
        const url = new URL(req.url, 'http://localhost');
        const gpath = url.pathname.replace(/^\/api\/gemini\/?/, '');
        const upstream = new URL(`https://generativelanguage.googleapis.com/${gpath}`);
        url.searchParams.forEach((v, k) => { if (k.toLowerCase() !== 'key') upstream.searchParams.set(k, v); });
        upstream.searchParams.set('key', apiKey);

        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const r = await fetch(upstream, {
          method: req.method,
          headers: {
            'content-type': String(req.headers['content-type'] || 'application/json'),
            'x-goog-api-key': apiKey,
          },
          body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : Buffer.concat(chunks),
        });
        res.statusCode = r.status;
        res.setHeader('content-type', r.headers.get('content-type') || 'application/json');
        // Stream through — chat uses SSE (streamGenerateContent?alt=sse)
        const reader = r.body?.getReader();
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        }
        res.end();
      } catch (e: any) {
        fail(500, e?.message || 'proxy error');
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const pick = (k: string) =>
    env[k] || env['VITE_' + k] || process.env[k] || process.env['VITE_' + k] || '';

  // SECURITY: GEMINI_API_KEY must come from env (Vercel → Settings → Environment
  // Variables). The previous hardcoded fallback was committed to a public repo
  // and must be treated as compromised — rotate it in Google AI Studio.
  // The Supabase URL + anon key are public-by-design (shipped to every browser,
  // protected by Row Level Security). Fallbacks kept so deploys keep working
  // until the env vars are configured in Vercel — then these can be removed too.
  const SUPABASE_URL     = pick('SUPABASE_URL')     || 'https://ubpapxdmqlepynonhaeo.supabase.co';
  const SUPABASE_ANON_KEY = pick('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicGFweGRtcWxlcHlub25oYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODU2NTQsImV4cCI6MjA4MTA2MTY1NH0.kjkY_jrvek-7pp2KWQytVzxxK9LL2SL1sPhsMLnGBSY';

  return {
    server: { port: 3000, host: '0.0.0.0' },

    plugins: [
      geminiDevApi(pick('GEMINI_API_KEY')),
      react({
        // Faster JSX transform — no React import needed
        jsxRuntime: 'automatic',

      }),
      tailwindcss(),
      VitePWA({
        // 'prompt' means the new SW waits for all tabs to close before activating.
        // 'autoUpdate' + skipWaiting was causing stale-chunk 404s on refresh
        // (new SW activated mid-page, cleaned old chunks, lazy imports broke).
        registerType: 'prompt',
        workbox: {
          // Do NOT skipWaiting or clientsClaim — let the new SW wait until
          // all existing tabs are closed before it takes over. This prevents
          // the race where skipWaiting activates a new SW while the page still
          // holds references to old chunk hashes that cleanupOutdatedCaches just
          // deleted, causing silent module-load failures that look like a full
          // Supabase disconnect until a hard reset.
          skipWaiting: false,
          clientsClaim: false,
          cleanupOutdatedCaches: true,
          // EGRESS/PERF: don't force every new visitor to download heavy
          // feature chunks upfront. pdf-gen (594KB), charts (365KB),
          // seller/admin features and AI chunks load on demand from the
          // CDN only when actually used. Cuts SW install payload ~60%.
          globIgnores: [
            '**/pdf-gen-*.js',
            '**/charts-*.js',
            '**/ai-sdk-*.js',
            '**/AIChatAssistant-*.js',
            '**/SellerPage-*.js',
            '**/AdminPage-*.js',
            '**/ProductEditPage-*.js',
          ],
          // Cache strategies per asset type
          runtimeCaching: [
            {
              // Image CDN — stale-while-revalidate
              urlPattern: /^https:\/\/(images\.unsplash\.com|cdn-icons-png\.flaticon\.com|ui-avatars\.com)\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'external-images',
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Supabase Storage — cache-first (product images don't change)
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-storage',
                expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Supabase auth + RPC — always hit the network, no timeout, no cache.
              // Auth token refresh and POST RPCs cannot be meaningfully cached (the
              // Cache Storage API only caches GET responses). A short networkTimeout
              // was silently killing product-load and auth-rehydration on slow
              // connections because the SW error propagated back to the Supabase
              // client as a network failure. NetworkOnly removes the SW entirely
              // from this path — the app's own queryCache handles stale-while-
              // revalidate for reads, and auth is already persisted in localStorage.
              urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|auth|realtime)\//,
              handler: 'NetworkOnly',
            },
            {
              // Google Fonts
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              },
            },
          ],
        },
        manifest: {
          name: 'MaliMart',
          short_name: 'MaliMart',
          description: "Tanzania's premier marketplace",
          theme_color: '#1acd86',
          background_color: '#faf9f6',
          display: 'standalone',
          icons: [
            { src: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ],

    define: {      'process.env.SUPABASE_URL':    JSON.stringify(SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
    },

    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      // Don't emit <link rel="modulepreload"> for heavy on-demand chunks —
      // they'd force every first-time visitor to download ~1.7MB they may
      // never use. Mirrors the service-worker globIgnores above.
      modulePreload: {
        resolveDependencies: (_url: string, deps: string[]) =>
          deps.filter(d => !/(pdf-gen|charts|ai-sdk|AIChatAssistant|SellerPage|AdminPage|ProductEditPage)/.test(d)),
      },
      // Target modern browsers — smaller output, no legacy polyfills
      target: 'es2020',
      // Minify with esbuild (10x faster than terser, nearly same size)
      minify: 'esbuild',
      cssMinify: true,
      // Raise warning limit — we know about the chunks, they're lazy
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Granular manual chunks — keep initial load tiny
          manualChunks(id) {
            // Vite's runtime helpers are virtual modules — without a pin,
            // Rollup may host them inside ANY chunk. (__vitePreload landed
            // inside pdf-gen, statically chaining 594KB to the entry.)
            if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload-polyfill') || id.includes('commonjsHelpers')) return 'react-core';

            // Tiny shared utils used across many chunks — pin them to the core
            // chunk so they never get trapped inside a heavy lazy chunk
            // (clsx living inside `charts` was forcing the entry to import
            // the whole 365KB chart bundle at startup).
            if (/node_modules[\\/](clsx|use-sync-external-store|tslib|scheduler)[\\/]/.test(id)) return 'react-core';

            // Core React runtime — always needed
            if (id.includes('react-dom') || id.includes('react-router')) return 'react-core';
            if (id.includes('node_modules/react/')) return 'react-core';

            // Heavy chart library + its exclusive dependency family — lazy loaded.
            // node_modules only: app files must never be captured here.
            if (id.includes('node_modules') && (
              id.includes('recharts') ||
              /[\\/]d3-[a-z-]+[\\/]/.test(id) ||
              /node_modules[\\/](react-redux|redux|redux-thunk|@reduxjs|immer|reselect|decimal\.js-light|es-toolkit|internmap|victory)/.test(id)
            )) return 'charts';

            // PDF generation — only loaded when user downloads receipt
            if (id.includes('node_modules') && (id.includes('jspdf') || id.includes('html2canvas'))) return 'pdf-gen';

            // Gemini AI SDK — only the npm package. (Matching the substring
            // 'gemini' also captured services/geminiService.ts, statically
            // chaining this 275KB chunk to the entry. App files stay with
            // their lazy importers.)
            if (id.includes('@google/genai')) return 'ai-sdk';

            // Supabase — deferred after auth check
            if (id.includes('@supabase/')) return 'supabase';

            // Animation — needed early but separable
            if (id.includes('framer-motion')) return 'motion';

            // Icons — tree-shaken by rollup but group them
            if (id.includes('lucide-react')) return 'icons';

            // DOMPurify — security, small
            if (id.includes('dompurify') || id.includes('purify')) return 'security-libs';

            // NOTE: app files (Seller*, Admin*, AIChatAssistant, …) are NOT
            // manually grouped. Rollup already creates a chunk per lazy route
            // (SellerPage-*, AdminPage-*, AIChatAssistant-*). Forcing app
            // files into named chunks let Rollup host SHARED modules (the
            // supabase client, AppContext, UI kit) inside `seller-features`,
            // which made the entry statically depend on the whole 375KB chunk.
          },
        },
      },
    },

    // Dependency pre-bundling — optimize what Vite resolves at dev time
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        'framer-motion',
        'lucide-react',
        'p-retry',
      ],
      exclude: [
        // Never pre-bundle — always lazy loaded
        'recharts',
        'jspdf',
        'html2canvas',
        '@google/genai',
      ],
    },
  };
});
