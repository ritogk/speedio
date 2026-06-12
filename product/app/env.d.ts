/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** LPのURL（同一ドメイン配信なのでデフォルトは "/"） */
  readonly VITE_LP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
