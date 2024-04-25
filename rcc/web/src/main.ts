import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useApiClient, UseApiClientKey } from './core/api-client'

const test = async () => {
  const app = createApp(App)

  const apiClient = useApiClient()
  await apiClient.setup()
  app.provide(UseApiClientKey, apiClient)
  app.use(router)

  app.mount('#app')
}
test()
