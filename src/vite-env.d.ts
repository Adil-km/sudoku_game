/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LAYA_API_URL?: string;
  readonly VITE_LAYA_PROXY_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
