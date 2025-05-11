import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  ssr: true, // SSGを実行するにはSSRを有効にする必要あり。
  nitro: {
    preset: "static",
    // MEMO: ページが複数ある場合はルートを指定する必要あり
    prerender: {
      routes: ["/", "/about"],
    },
  },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
  },
});
