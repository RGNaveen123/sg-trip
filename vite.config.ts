import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'maskable-512.png'],
      manifest: {
        name: 'Singapore Trip — 17–21 Dec',
        short_name: 'SG Trip',
        description: 'Offline-first trip planner for the Singapore trip.',
        theme_color: '#07120F',
        background_color: '#07120F',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 700, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/upload\.wikimedia\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'place-photos', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            urlPattern: /^https:\/\/en\.wikipedia\.org\/api\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'place-info', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
