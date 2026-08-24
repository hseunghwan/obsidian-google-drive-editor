import { ChromeIdentityAuthClient, type GoogleAuthClient } from './googleAuth';

const gisScriptUrl = 'https://accounts.google.com/gsi/client';
const webOAuthClientIdPlaceholder = 'REPLACE_WITH_WEB_OAUTH_CLIENT_ID';

/** 웹 앱은 Drive UI에서 사용자가 고른 파일만 다루므로 restricted scope가 필요 없다. */
export const webDriveScopes = ['https://www.googleapis.com/auth/drive.file'] as const;

export const webOAuthClientIdMissingMessage =
  'Google OAuth 웹 클라이언트 id가 설정되지 않았습니다. VITE_GOOGLE_WEB_OAUTH_CLIENT_ID를 설정하고 다시 빌드하세요.';
export const webAuthorizationRequiredMessage = 'Google Drive 접근 권한이 필요합니다.';
export const gisUnavailableMessage = 'Google 인증 스크립트를 불러올 수 없습니다.';

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GisErrorResponse {
  type?: string;
  message?: string;
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback(response: GisTokenResponse): void;
  error_callback?(error: GisErrorResponse): void;
}

interface GisOAuth2 {
  initTokenClient(config: GisTokenClientConfig): GisTokenClient;
}

/**
 * Google Identity Services 토큰 클라이언트로 access token을 받는다.
 * chrome.identity를 쓸 수 없는 웹 배포(Drive "연결 앱으로 열기" 진입)용 구현이다.
 */
export class GisAuthClient implements GoogleAuthClient {
  private token: { value: string; expiresAt: number } | null = null;
  private scriptPromise: Promise<void> | null = null;
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly clientId: string,
    private readonly scopes: readonly string[] = webDriveScopes
  ) {}

  async getAccessToken(interactive: boolean): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }

    // 같은 진입에서 두 번 요청하면 팝업이 두 개 뜬다
    this.inflight ??= this.requestToken(interactive).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async refreshAccessToken(staleToken: string): Promise<string> {
    if (this.token?.value === staleToken) {
      this.token = null;
    }
    return this.getAccessToken(false);
  }

  private async requestToken(interactive: boolean): Promise<string> {
    const clientId = this.clientId.trim();
    if (!clientId || clientId.includes('REPLACE_WITH') || clientId === webOAuthClientIdPlaceholder) {
      throw new Error(webOAuthClientIdMissingMessage);
    }

    await this.loadGisScript();
    const oauth2 = (globalThis as { google?: { accounts?: { oauth2?: GisOAuth2 } } }).google?.accounts
      ?.oauth2;
    if (!oauth2) {
      throw new Error(gisUnavailableMessage);
    }

    return new Promise<string>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: this.scopes.join(' '),
        callback: (response) => {
          if (!response.access_token) {
            reject(new Error(response.error_description ?? response.error ?? webAuthorizationRequiredMessage));
            return;
          }
          this.token = {
            value: response.access_token,
            expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000
          };
          resolve(response.access_token);
        },
        error_callback: (error) => {
          reject(new Error(error.message ?? error.type ?? webAuthorizationRequiredMessage));
        }
      });

      // prompt: ''는 이미 승인된 grant가 있으면 화면 없이 토큰을 준다.
      // 승인이 없으면 팝업이 필요하고, 사용자 제스처 없이는 브라우저가 막으므로 interactive에서만 허용한다.
      client.requestAccessToken(interactive ? {} : { prompt: '' });
    });
  }

  private loadGisScript(): Promise<void> {
    if ((globalThis as { google?: { accounts?: unknown } }).google?.accounts) {
      return Promise.resolve();
    }

    this.scriptPromise ??= new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${gisScriptUrl}"]`);
      const script = existing ?? document.createElement('script');
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error(gisUnavailableMessage)), { once: true });
      if (!existing) {
        script.src = gisScriptUrl;
        script.async = true;
        document.head.append(script);
      }
    });
    return this.scriptPromise;
  }
}

export function isChromeIdentityAvailable(): boolean {
  return typeof globalThis.chrome?.identity?.getAuthToken === 'function';
}

export interface DriveAuthClient extends GoogleAuthClient {
  refreshAccessToken(staleToken: string): Promise<string>;
}

/** 확장에서는 chrome.identity, 웹 배포에서는 GIS 토큰 클라이언트를 쓴다. */
export function createDriveAuthClient(chromeUnavailableMessage: string): DriveAuthClient {
  if (isChromeIdentityAvailable()) {
    return new ChromeIdentityAuthClient(chromeUnavailableMessage);
  }
  return new GisAuthClient(import.meta.env.VITE_GOOGLE_WEB_OAUTH_CLIENT_ID ?? '');
}
