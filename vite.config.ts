import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Vercel exposes env vars via process.env at build time. We forward selected ones
// into the client bundle as `process.env.*` (legacy convention used in this codebase)
// AND read both prefixed (VITE_*) and unprefixed names so a deployer can set either.
//
// SECURITY NOTE: anything inlined here ships in the public JS bundle. Only put
// values here that are safe to expose (Supabase anon key, Gemini API key — see
// DEPLOY_VERCEL.md for the trade-off on the Gemini key).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // IMPORTANT: loadEnv() only reads .env files, NOT process.env. On Vercel,
  // env vars set in the dashboard live in process.env at build time, so we
  // must check both sources here or the values never get inlined into the bundle.
  const pick = (k: string) =>
    env[k] || env['VITE_' + k] || process.env[k] || process.env['VITE_' + k] || '';
  const GEMINI_API_KEY = pick('GEMINI_API_KEY');
  const SUPABASE_URL = pick('SUPABASE_URL');
  const SUPABASE_ANON_KEY = pick('SUPABASE_ANON_KEY');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Force new SW to take over old tabs the moment it installs.
        // Without these, users see stale bundles for one refresh cycle after every deploy.
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'MaliMart',
          short_name: 'MaliMart',
          description: 'A premier Tanzanian e-commerce platform connecting local sellers with buyers.',
          theme_color: '#10B981',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            ui: ['framer-motion', 'lucide-react'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
            gemini: ['@google/genai'],
            pdf: ['jspdf', 'html2canvas'],
          },
        },
      },
    },
  };
});
