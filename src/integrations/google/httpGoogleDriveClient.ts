import type { GoogleDriveClient, GoogleDriveFile, GoogleDriveListResponse } from './googleDriveClient';

const driveBaseUrl = 'https://www.googleapis.com/drive/v3/files';
const uploadBaseUrl = 'https://www.googleapis.com/upload/drive/v3/files';

export class HttpGoogleDriveClient implements GoogleDriveClient {
  constructor(private readonly accessToken: string) {}

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
    const response = await fetch(`${driveBaseUrl}/${fileId}?alt=media`, {
      headers: this.headers()
    });
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
    const response = await fetch(url, {
      ...init,
      headers: {
        ...this.headers(),
        ...init.headers
      }
    });
    if (!response.ok) {
      throw new Error(`Drive request failed: ${response.status}`);
    }
    return response.json();
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
