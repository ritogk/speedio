import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../pages/Home.vue'
import SubView from '../pages/Sub.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/sub',
      name: 'sub',
      component: SubView
    }
  ]
})

export default router
