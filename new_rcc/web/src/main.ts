import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { useApiClient, UseApiClientKey } from './core/api/api-client'

import 'leaflet/dist/leaflet.css'

const test = async () => {
  const app = createApp(App)

  const apiClient = useApiClient()
  await apiClient.setup()
  app.provide(UseApiClientKey, apiClient)
  app.use(VueQueryPlugin)
  app.use(router)

  app.mount('#app')
}
test()
