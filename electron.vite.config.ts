import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    // Treeshaking — https://vuetifyjs.com/en/features/treeshaking/
    // `autoImport` her .vue dosyasında yalnızca gerçekten kullanılan Vuetify
    // bileşenlerini (ve iç direktiflerini) on-demand import eder; kütüphanenin
    // tamamını (`import * as components`) bundle'lamak yerine. Böylece bundle
    // yalnızca kullanılan bileşenleri içerir ve bakım gerektirmeden küçük kalır.
    plugins: [vue(), vuetify({ autoImport: true })]
  }
})
