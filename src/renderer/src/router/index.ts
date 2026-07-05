import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '../views/WorkspaceView.vue'

/**
 * Uygulama tek görünümlüdür: Çalışma alanı daima temel katmandır. Ayarlar,
 * ekipler, senkron ve tüneller ayrı route değil; çalışma alanının üzerine
 * sağdan kayan side sheet panelleridir (bkz. [[ui store]], App.vue).
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', name: 'workspace', component: WorkspaceView }]
})

export default router
