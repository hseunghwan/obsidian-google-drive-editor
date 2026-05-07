import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ChromeIdentityAuthClient,
  chromeOAuthClientIdInvalidMessage,
  chromeOAuthClientIdMissingMessage,
  driveScopes
} from './googleAuth';

describe('ChromeIdentityAuthClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses full Drive access for existing vault folder content', () => {
    expect(driveScopes).toEqual(['https://www.googleapis.com/auth/drive']);
  });

  it('fails with setup guidance before requesting a token when the manifest keeps the OAuth placeholder', async () => {
    const getAuthToken = vi.fn();
    stubChrome(getAuthToken, 'REPLACE_WITH_CHROME_EXTENSION_OAUTH_CLIENT_ID');

    await expect(new ChromeIdentityAuthClient().getAccessToken(true)).rejects.toThrow(
      chromeOAuthClientIdMissingMessage
    );
    expect(getAuthToken).not.toHaveBeenCalled();
  });

  it('wraps Chrome bad client id errors with extension OAuth setup guidance', async () => {
    const getAuthToken = vi
      .fn()
      .mockRejectedValue(new Error("OAuth2 request failed: Service responded with error: 'bad client id: {0}'"));
    stubChrome(getAuthToken, 'valid-client-id.apps.googleusercontent.com');

    await expect(new ChromeIdentityAuthClient().getAccessToken(true)).rejects.toThrow(
      chromeOAuthClientIdInvalidMessage
    );
  });

  it('requests a Drive token when the manifest has a configured OAuth client id', async () => {
    const getAuthToken = vi.fn().mockResolvedValue({ token: 'access-token' });
    stubChrome(getAuthToken, 'valid-client-id.apps.googleusercontent.com');

    await expect(new ChromeIdentityAuthClient().getAccessToken(true)).resolves.toBe('access-token');
    expect(getAuthToken).toHaveBeenCalledWith({ interactive: true, scopes: [...driveScopes] });
  });

  it('revokes the cached Google grant before clearing Chrome identity state', async () => {
    const getAuthToken = vi.fn().mockResolvedValue({ token: 'cached-access-token' });
    const removeCachedAuthToken = vi.fn().mockResolvedValue(undefined);
    const clearAllCachedAuthTokens = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    stubChrome(getAuthToken, 'valid-client-id.apps.googleusercontent.com', {
      removeCachedAuthToken,
      clearAllCachedAuthTokens
    });
    vi.stubGlobal('fetch', fetch);

    await new ChromeIdentityAuthClient().clearCachedAccessToken();

    expect(fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/revoke', {
      body: new URLSearchParams({ token: 'cached-access-token' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST'
    });
    expect(removeCachedAuthToken).toHaveBeenCalledWith({ token: 'cached-access-token' });
    expect(clearAllCachedAuthTokens).toHaveBeenCalled();
  });
});

function stubChrome(
  getAuthToken: ReturnType<typeof vi.fn>,
  clientId: string,
  identityOverrides: Partial<typeof chrome.identity> = {}
) {
  vi.stubGlobal('chrome', {
    identity: { getAuthToken, ...identityOverrides },
    runtime: {
      getManifest: () => ({
        oauth2: {
          client_id: clientId
        }
      })
    }
  });
}
