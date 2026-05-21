import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const pick = (k: string) =>
    env[k] || env['VITE_' + k] || process.env[k] || process.env['VITE_' + k] || '';

  const GEMINI_API_KEY   = pick('GEMINI_API_KEY');
  const SUPABASE_URL     = pick('SUPABASE_URL');
  const SUPABASE_ANON_KEY = pick('SUPABASE_ANON_KEY');

  return {
    server: { port: 3000, host: '0.0.0.0' },

    plugins: [
      react({
        // Faster JSX transform — no React import needed
        jsxRuntime: 'automatic',

      }),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          // Cache strategies per asset type
          runtimeCaching: [
            {
              // Image CDN — stale-while-revalidate
              urlPattern: /^https:\/\/(images\.unsplash\.com|cdn-icons-png\.flaticon\.com|ui-avatars\.com|picsum\.photos)\//,
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
              // Supabase API — network-first (always fresh data)
              urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|auth|realtime)\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
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

    define: {
      'process.env.API_KEY':         JSON.stringify(GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY':  JSON.stringify(GEMINI_API_KEY),
      'process.env.SUPABASE_URL':    JSON.stringify(SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
    },

    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
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
            // Core React runtime — always needed
            if (id.includes('react-dom') || id.includes('react-router')) return 'react-core';
            if (id.includes('node_modules/react/')) return 'react-core';

            // Heavy chart library — lazy loaded
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';

            // PDF generation — only loaded when user downloads receipt
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf-gen';

            // Gemini AI — only loaded when AI chat opens
            if (id.includes('@google/genai') || id.includes('gemini')) return 'ai-sdk';

            // Supabase — deferred after auth check
            if (id.includes('@supabase/')) return 'supabase';

            // Animation — needed early but separable
            if (id.includes('framer-motion')) return 'motion';

            // Icons — tree-shaken by rollup but group them
            if (id.includes('lucide-react')) return 'icons';

            // DOMPurify — security, small
            if (id.includes('dompurify') || id.includes('purify')) return 'security-libs';

            // Seller-only features — heavy, only sellers visit
            if (
              id.includes('SellerPage') ||
              id.includes('SellerInventory') ||
              id.includes('SellerAnalytics') ||
              id.includes('AdvancedAnalytics') ||
              id.includes('ProductForm') ||
              id.includes('BulkEditModal') ||
              id.includes('CSVImport') ||
              id.includes('AutoDiscountModal')
            ) return 'seller-features';

            // Admin-only features
            if (
              id.includes('AdminPage') ||
              id.includes('AdminAIHero') ||
              id.includes('AdminGrowth') ||
              id.includes('AdminModeration') ||
              id.includes('AdminVendorVerification') ||
              id.includes('SecurityMonitor')
            ) return 'admin-features';

            // AI chat — large, optional
            if (id.includes('AIChatAssistant')) return 'ai-chat';
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
