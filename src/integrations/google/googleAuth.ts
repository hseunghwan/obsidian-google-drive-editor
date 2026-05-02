export const driveScopes = ['https://www.googleapis.com/auth/drive'] as const;
export const chromeIdentityUnavailableMessage = 'Google Drive 연결은 Chrome 확장으로 로드한 뒤 사용할 수 있습니다.';

export interface GoogleAuthClient {
  getAccessToken(interactive: boolean): Promise<string>;
}

export class ChromeIdentityAuthClient implements GoogleAuthClient {
  async getAccessToken(interactive: boolean): Promise<string> {
    const identity = getChromeIdentity();
    if (!identity) {
      throw new Error(chromeIdentityUnavailableMessage);
    }

    const result = await identity.getAuthToken({
      interactive,
      scopes: [...driveScopes]
    });

    if (!result.token) {
      throw new Error('Google access token was not returned.');
    }

    return result.token;
  }
}

function getChromeIdentity(): typeof chrome.identity | null {
  const chromeApi = globalThis.chrome;
  if (!chromeApi?.identity || typeof chromeApi.identity.getAuthToken !== 'function') {
    return null;
  }

  return chromeApi.identity;
}
