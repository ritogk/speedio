import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'
import fs from 'fs'

export default ({ mode }: { mode: string }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }

  const apiPath = process.env.VITE_API_PATH
  const apiPrefix = '/' + process.env.VITE_API_PREFIX
  return defineConfig({
    plugins: [vue(), VueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      open: true, // 起動時にブラウザを開く
      port: 5173,
      https: {
        key: fs.readFileSync('./.cert/localhost-key.pem'),
        cert: fs.readFileSync('./.cert/localhost.pem')
      },
      proxy: {
        [apiPrefix]: {
          target: apiPath,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${apiPrefix}`), '') // プロキシ先のパスを動的に書き換える
        }
      }
    }
  })
}
