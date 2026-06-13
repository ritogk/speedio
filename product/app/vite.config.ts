import { fileURLToPath, URL } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const LOCAL_TARGETS = resolve(__dirname, "../../data/targets");

// 本番は CloudFront の /app/* ビヘイビアで配信する
export default defineConfig({
  base: "/app/",
  plugins: [
    {
      name: "local-targets",
      configureServer(server) {
        server.middlewares.use("/targets", (req, res, next) => {
          const local = resolve(LOCAL_TARGETS, `.${req.url!}`);
          if (existsSync(local)) {
            res.setHeader("Content-Type", "application/json");
            res.end(readFileSync(local));
            return;
          }
          next();
        });
      },
    },
    vue(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    proxy: {
      "/targets": {
        target: "https://speedio.homisoftware.net",
        changeOrigin: true,
      },
    },
  },
});
