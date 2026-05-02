export const driveScopes = ['https://www.googleapis.com/auth/drive.file'] as const;

export interface GoogleAuthClient {
  getAccessToken(interactive: boolean): Promise<string>;
}

export class ChromeIdentityAuthClient implements GoogleAuthClient {
  async getAccessToken(interactive: boolean): Promise<string> {
    const result = await chrome.identity.getAuthToken({
      interactive,
      scopes: [...driveScopes]
    });

    if (!result.token) {
      throw new Error('Google access token was not returned.');
    }

    return result.token;
  }
}
