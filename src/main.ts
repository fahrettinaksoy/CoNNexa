import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { installConnexaBridge } from './bridge/connexa'
import { i18n } from './i18n'
import { vuetify } from './plugins/vuetify'
import router from './router'

import '@xterm/xterm/css/xterm.css'
import './assets/main.css'

// window.connexa köprüsünü mount'tan ÖNCE kur (store'lar init'te çağırıyor).
installConnexaBridge()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(vuetify)

app.mount('#app')
