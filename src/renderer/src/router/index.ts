import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '../views/WorkspaceView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workspace', component: WorkspaceView },
    {
      path: '/tunnels',
      name: 'tunnels',
      component: () => import('../views/TunnelsView.vue')
    },
    {
      path: '/sync',
      name: 'sync',
      component: () => import('../views/SyncView.vue')
    },
    {
      path: '/teams',
      name: 'teams',
      component: () => import('../views/TeamsView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    }
  ]
})

export default router
