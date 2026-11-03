import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isCapacitor = process.env.BUILD_TARGET === 'capacitor'

// The Base44 plugin only does something when a Base44 app URL is configured (Base44 editor/hosting).
// Without it the plugin just prints "Proxy not enabled", so it is only loaded when the variable is set.
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
const useBase44 = Boolean(env.VITE_BASE44_APP_BASE_URL || process.env.VITE_BASE44_APP_BASE_URL)

export default defineConfig({
  // 'info' so the terminal shows "Local: http://localhost:1738/" (it was hidden with 'error')
  logLevel: 'info',
  // The '@/' import alias used all over src/. It used to come from the Base44 plugin, so it is
  // defined here explicitly now that the plugin is optional.
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  plugins: [
    useBase44 && base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    // ✅ Skip PWA kapag Capacitor build
    !isCapacitor && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Melotrip',
        short_name: 'Melotrip',
        description: 'Plan and share beach, city, mountain, and group trips across the Philippines.',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),  // ✅ alisin ang false values
  server: {
    port: 1738,
    strictPort: true, // fail loudly instead of silently switching to another port
  },
});
