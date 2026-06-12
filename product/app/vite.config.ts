import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// 本番は CloudFront の /app/* ビヘイビアで配信する
export default defineConfig({
  base: "/app/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // 峠データ(slim版)は本番S3/CloudFrontにのみ存在するため、開発時はプロキシで取得する
    proxy: {
      "/targets": {
        target: "https://speedio.homisoftware.net",
        changeOrigin: true,
      },
    },
  },
});
