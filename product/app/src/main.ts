// エントリポイント。WebGL2必須チェック（MapLibre 5の要件）の上でアプリを起動する。

import "maplibre-gl/dist/maplibre-gl.css";
import "@/assets/styles/tokens.css";
import "@/assets/styles/base.css";

import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "@/App.vue";
import { gsiDemProtocol } from "@/map/gsidemProtocol";

const probe = document.createElement("canvas").getContext("webgl2");
if (!probe) {
  document.getElementById("app")!.innerHTML =
    '<div style="padding:20px;font-size:13px;line-height:1.7"><b>エラー:</b> このブラウザ/環境はWebGL2が無効のため3D地図を表示できません。ブラウザのハードウェアアクセラレーション設定を確認してください。</div>';
} else {
  gsiDemProtocol.register();
  createApp(App).use(createPinia()).mount("#app");
}
