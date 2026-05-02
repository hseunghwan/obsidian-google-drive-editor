export const driveScopes = ['https://www.googleapis.com/auth/drive.file'] as const;
export const chromeIdentityUnavailableMessage = 'Google Drive 연결은 Chrome 확장으로 로드한 뒤 사용할 수 있습니다.';
export const chromeOAuthClientIdMissingMessage =
  'Google OAuth client id가 설정되지 않았습니다. .env.local에 VITE_GOOGLE_OAUTH_CLIENT_ID를 설정하고 npm run build를 다시 실행한 뒤 확장을 Reload하세요.';
export const chromeOAuthClientIdInvalidMessage =
  'Google OAuth client id가 현재 Chrome 확장과 맞지 않습니다. Google Cloud OAuth client가 Chrome Extension 유형인지, 등록된 확장 ID가 chrome://extensions의 unpacked extension ID와 같은지 확인하세요.';

const oauthClientIdPlaceholder = 'REPLACE_WITH_CHROME_EXTENSION_OAUTH_CLIENT_ID';

export interface GoogleAuthClient {
  getAccessToken(interactive: boolean): Promise<string>;
}

export class ChromeIdentityAuthClient implements GoogleAuthClient {
  constructor(private readonly unavailableMessage = chromeIdentityUnavailableMessage) {}

  async getAccessToken(interactive: boolean): Promise<string> {
    const identity = getChromeIdentity();
    if (!identity) {
      throw new Error(this.unavailableMessage);
    }

    validateOAuthClientId();

    const result = await getAuthToken(identity, interactive);

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

function validateOAuthClientId() {
  const manifest = globalThis.chrome?.runtime?.getManifest?.();
  const clientId = manifest?.oauth2?.client_id?.trim();

  if (!clientId || clientId === oauthClientIdPlaceholder || clientId.includes('REPLACE_WITH')) {
    throw new Error(chromeOAuthClientIdMissingMessage);
  }
}

async function getAuthToken(identity: typeof chrome.identity, interactive: boolean) {
  try {
    return await identity.getAuthToken({
      interactive,
      scopes: [...driveScopes]
    });
  } catch (error) {
    if (isBadClientIdError(error)) {
      throw new Error(`${chromeOAuthClientIdInvalidMessage} 원문: ${getErrorMessage(error)}`);
    }
    throw error;
  }
}

function isBadClientIdError(error: unknown) {
  return getErrorMessage(error).toLowerCase().includes('bad client id');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
