import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          primary: '#4F8EF7',
          secondary: '#7C4DFF',
          surface: '#16181D',
          background: '#0F1115'
        }
      },
      light: {
        dark: false,
        colors: {
          primary: '#2962FF',
          secondary: '#6200EA'
        }
      }
    }
  }
})
