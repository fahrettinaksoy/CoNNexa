import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vitest/config'

// Ağırlıklı olarak saf mantık testleri (.ts). Uzak erişim / kripto / ayrıştırma
// mantığının çoğu Rust arka uçtadır (bkz. `src-tauri` `cargo test`); burada
// frontend tarafındaki saf yardımcılar test edilir.
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      // Kapsam yalnız saf mantık (.ts) üzerinden ölçülür; .vue bileşenleri birim
      // testinin hedefi değildir.
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/main.ts',
        'src/**/types.ts',
        'src/bridge/**',
        'src/plugins/**',
        'src/i18n/**'
      ]
      // Eşikler kapsam büyüdükçe (ratchet) eklenir; şimdilik yalnız raporlanır.
    },
    server: {
      deps: {
        // Vuetify inline edilir; aksi halde bileşen import'ları Node ESM
        // yükleyicisine düşüp `.css` uzantısında patlar.
        inline: ['vuetify']
      }
    }
  }
})
