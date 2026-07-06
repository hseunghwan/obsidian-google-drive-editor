import type { GoogleDriveClient, GoogleDriveFile, GoogleDriveListResponse } from './googleDriveClient';

const driveBaseUrl = 'https://www.googleapis.com/drive/v3/files';
const uploadBaseUrl = 'https://www.googleapis.com/upload/drive/v3/files';
const maxRetries = 3;

export interface HttpGoogleDriveClientOptions {
  refreshAccessToken?(staleToken: string): Promise<string>;
  retryBaseDelayMs?: number;
}

export class HttpGoogleDriveClient implements GoogleDriveClient {
  constructor(
    private accessToken: string,
    private readonly options: HttpGoogleDriveClientOptions = {}
  ) {}

  async listFolders(folderId: string, pageToken?: string): Promise<GoogleDriveListResponse> {
    const params = new URLSearchParams({
      q: `'${escapeDriveQueryValue(folderId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, parents)',
      orderBy: 'name',
      pageSize: '100'
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    return this.request(`${driveBaseUrl}?${params.toString()}`);
  }

  async listMarkdownFiles(folderId: string, pageToken?: string): Promise<GoogleDriveListResponse> {
    const params = new URLSearchParams({
      q: `'${escapeDriveQueryValue(folderId)}' in parents and mimeType != 'application/vnd.google-apps.folder' and name contains '.md' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, parents)',
      orderBy: 'name',
      pageSize: '100'
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    return this.request(`${driveBaseUrl}?${params.toString()}`);
  }

  async searchByName(query: string, pageToken?: string, signal?: AbortSignal): Promise<GoogleDriveListResponse> {
    const params = new URLSearchParams({
      q: `name contains '${escapeDriveQueryValue(query)}' and (mimeType = 'application/vnd.google-apps.folder' or (mimeType != 'application/vnd.google-apps.folder' and name contains '.md')) and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, parents)',
      orderBy: 'name',
      pageSize: '100'
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    return this.request(`${driveBaseUrl}?${params.toString()}`, { signal });
  }

  async downloadText(fileId: string): Promise<string> {
    const response = await this.fetchWithRetry(`${driveBaseUrl}/${fileId}?alt=media`, {});
    if (!response.ok) {
      throw new Error(`Drive download failed: ${response.status}`);
    }
    return response.text();
  }

  async updateText(fileId: string, content: string): Promise<GoogleDriveFile> {
    return this.request(
      `${uploadBaseUrl}/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime,parents`,
      {
        method: 'PATCH',
        headers: {
          ...this.headers(),
          'Content-Type': 'text/markdown; charset=utf-8'
        },
        body: content
      }
    );
  }

  async createTextFile(
    parentFolderId: string,
    name: string,
    content: string
  ): Promise<GoogleDriveFile> {
    const metadata = await this.request<GoogleDriveFile>(
      `${driveBaseUrl}?fields=id,name,mimeType,modifiedTime,parents`,
      {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          parents: [parentFolderId],
          mimeType: 'text/markdown'
        })
      }
    );
    return this.updateText(metadata.id, content);
  }

  async createFolder(parentFolderId: string, name: string): Promise<GoogleDriveFile> {
    return this.request(`${driveBaseUrl}?fields=id,name,mimeType,modifiedTime,parents`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        parents: [parentFolderId],
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
  }

  async renameFile(fileId: string, name: string): Promise<GoogleDriveFile> {
    return this.request(`${driveBaseUrl}/${fileId}?fields=id,name,mimeType,modifiedTime,parents`, {
      method: 'PATCH',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
  }

  async trashFile(fileId: string): Promise<void> {
    await this.request(`${driveBaseUrl}/${fileId}?fields=id`, {
      method: 'PATCH',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trashed: true })
    });
  }

  async getMetadata(fileId: string, signal?: AbortSignal): Promise<GoogleDriveFile> {
    return this.request(`${driveBaseUrl}/${fileId}?fields=id,name,mimeType,modifiedTime,parents`, { signal });
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchWithRetry(url, init);
    if (!response.ok) {
      throw new Error(`Drive request failed: ${response.status}`);
    }
    return response.json();
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let refreshed = false;
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...this.headers(),
          ...init.headers
        }
      });

      if (response.status === 401 && !refreshed && this.options.refreshAccessToken) {
        refreshed = true;
        this.accessToken = await this.options.refreshAccessToken(this.accessToken);
        continue;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < maxRetries && !init.signal?.aborted) {
        await delay(this.retryDelayMs(response, attempt));
        continue;
      }

      return response;
    }
  }

  private retryDelayMs(response: Response, attempt: number) {
    const retryAfterSeconds = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
    return (this.options.retryBaseDelayMs ?? 500) * 2 ** attempt;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`
    };
  }
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
