import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  ssr: true, // SSGを実行するにはSSRを有効にする必要あり。
  nitro: {
    preset: "static",
    prerender: {
      routes: ["/"],
      // /app/ は別ビルドの峠サーチャー本体（CloudFrontで同居配信）なのでクロール対象外
      ignore: ["/app"],
    },
  },
  runtimeConfig: {
    public: {
      // 本番は同一ドメインの /app/ に峠サーチャー本体を配信する。
      // ローカルで両方起動するときは NUXT_PUBLIC_APP_URL=http://localhost:5173/app/ を指定
      appUrl: "/app/",
    },
  },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      htmlAttrs: { lang: "ja" },
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap",
        },
      ],
    },
  },
});
