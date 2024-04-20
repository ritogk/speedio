import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
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
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true, // サーバーのオリジンを変更する
        rewrite: (path) => path.replace(/^\/api/, '') // プロキシ先のパスに書き換える
      }
    }
  }
})
