import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import OpenAPIClientAxios from 'openapi-client-axios'
import type { Client as ApiClient } from '@/types/openapi'

const test = async () => {
  const apiPrefix = import.meta.env.VITE_API_PREFIX
  const api = new OpenAPIClientAxios({
    definition: `/${apiPrefix}/public/openapi.yml`
  })
  // NOTE: initを実行するとなぜかopenapi.ymlを2回fetchしてしまう
  // api.init()
  const client = await api.getClient<ApiClient>()
  client.defaults.baseURL = apiPrefix
  await client.LocationsController_findAll()
}
test()

const app = createApp(App)

app.use(router)

app.mount('#app')
