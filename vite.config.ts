import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    // Vuetify treeshaking — yalnız kullanılan bileşenleri on-demand import eder.
    vuetify({ autoImport: true })
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },

  // ironrdp-wasm dinamik import edilir; Vite'ın önden paketlemesine gerek yok.
  // noVNC top-level await kullandığından dev-zamanı esbuild hedefi de esnext.
  optimizeDeps: {
    exclude: ['ironrdp-wasm'],
    esbuildOptions: {
      target: 'esnext'
    }
  },

  /**
   * Tauri hedefi sabit bir modern WebView'dir. noVNC (WebCodecs) top-level await
   * kullandığından hedef `esnext` (TLA destekli); Windows'ta WebView2 zaten
   * güncel Chromium'dur.
   */
  build: {
    target: 'esnext',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
}))
