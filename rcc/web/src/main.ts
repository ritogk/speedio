import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
// import OpenAPIClientAxios from 'openapi-client-axios'
// import type { Client as ApiClient } from '@/types/openapi'

// // ここでlocalhost:5173/openapi.ymlを読み出している・・・いやいいのか。
// const api = new OpenAPIClientAxios({
//   definition: 'http://localhost:3000/public/openapi.yml'
// })
// api.init()

// const test = async () => {
//   const client = await api.getClient<ApiClient>()
//   await client.LocationsController_findAll()
// }
// test()

const app = createApp(App)

app.use(router)

app.mount('#app')
