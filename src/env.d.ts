/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chrome 확장 OAuth client id (manifest에 주입된다) */
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  /** 웹 배포에서 GIS 토큰 클라이언트가 쓰는 Web application OAuth client id */
  readonly VITE_GOOGLE_WEB_OAUTH_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
