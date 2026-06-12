import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";

export default defineConfigWithVueTs(
  { name: "app/files-to-lint", files: ["**/*.{ts,mts,tsx,vue}"] },
  { name: "app/files-to-ignore", ignores: ["**/dist/**", "**/coverage/**"] },
  pluginVue.configs["flat/essential"],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: "app/code-style",
    rules: {
      // 関数はアロー関数で書く（チーム規約）
      "func-style": ["error", "expression"],
    },
  },
);
