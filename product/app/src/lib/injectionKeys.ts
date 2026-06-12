import type { InjectionKey, Ref } from "vue";

/** パネルのスクロールコンテナ。サムネ遅延ロードのroot・カードスクロール追従に使う */
export const panelBodyKey: InjectionKey<Ref<HTMLElement | null>> =
  Symbol("panelBody");
