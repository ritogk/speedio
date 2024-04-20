import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import OpenAPIClientAxios from 'openapi-client-axios'
import type { Client as ApiClient } from '@/types/openapi'

const api = new OpenAPIClientAxios({
  definition: '/api/public/openapi.yml'
})
api.init()

const test = async () => {
  const client = await api.getClient<ApiClient>()
  client.defaults.baseURL = 'https://localhost:5173/api'
  await client.LocationsController_findAll()
}
test()

const app = createApp(App)

app.use(router)

app.mount('#app')
