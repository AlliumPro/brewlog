import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a silent reload while the brew form is half filled
      // throws away what the user typed. The new version is offered instead.
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'BrewLog — coffee brewing journal',
        // Anything past ~12 characters is truncated under the home-screen icon
        short_name: 'BrewLog',
        description: 'A private record of what you brewed and how it tasted.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Both mirror --color-bg; the splash screen uses them before any CSS is parsed
        background_color: '#fbf9fc',
        theme_color: '#fbf9fc',
        icons: [
          { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
          // Without a maskable variant Android crops the rounded square to a circle and
          // takes the glyph with it
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // A client-side route is not a file: anything unknown returns the shell instead of 404
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/docs/],
        runtimeCaching: [
          {
            // NetworkFirst, never CacheFirst: this journal is behind a password, and a cache
            // that outlives the session would hand the next person the previous one's data.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 5 },
          },
        ],
      },
      // A service worker in dev serves stale code and turns debugging into guesswork
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    modules: {
      // Class names are consumed as JS identifiers, so only the camelCase form is exposed.
      localsConvention: 'camelCaseOnly',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // The virtual module only exists once the PWA plugin has run; tests that pull in the
    // layout would otherwise fail to resolve it.
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
  },
});
