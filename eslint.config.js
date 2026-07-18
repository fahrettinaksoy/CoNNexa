import antfu from '@antfu/eslint-config'
import prettier from 'eslint-config-prettier'

// Kod stili kuralları @antfu'dan; BİÇİMLENDİRME Prettier'e devredildi
// (`stylistic: false`). ESLint = kod kalitesi/kurallar, Prettier = biçim.
// `eslint-config-prettier` en sonda çakışan tüm biçim kurallarını kapatır.
export default antfu({
  vue: true,
  typescript: true,

  // Biçimlendirmeyi Prettier yapar; antfu'nun stylistic kurallarını kapat.
  stylistic: false,

  // Biçimlendiriciler kapalı: markdown/toml/yaml (docs, Cargo.toml, workflow'lar)
  // bu kuralların kapsamı dışında.
  markdown: false,
  yaml: false,
  toml: false,
  jsonc: false,

  ignores: ['dist', 'src-tauri/target', 'src-tauri/gen', '**/*.d.ts']
}).append(prettier)
