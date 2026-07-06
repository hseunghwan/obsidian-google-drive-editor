import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpGoogleDriveClient } from './httpGoogleDriveClient';

describe('HttpGoogleDriveClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries only folders when listing Drive folders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('access-token').listFolders('root');

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get('q')).toBe(
      "'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    );
  });

  it('queries markdown file candidates separately from folders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('access-token').listMarkdownFiles('root');

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get('q')).toBe(
      "'root' in parents and mimeType != 'application/vnd.google-apps.folder' and name contains '.md' and trashed = false"
    );
  });

  it('queries Drive by keyword for folders and markdown file names', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('access-token').searchByName('project plan');

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get('q')).toBe(
      "(name contains 'project plan' or fullText contains 'project plan') and (mimeType = 'application/vnd.google-apps.folder' or (mimeType != 'application/vnd.google-apps.folder' and name contains '.md')) and trashed = false"
    );
  });

  it('passes an abort signal to Drive search requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ files: [] }));
    const signal = new AbortController().signal;
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('access-token').searchByName('a', undefined, signal);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal });
  });

  it('passes an abort signal to metadata requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: 'folder-projects',
      name: 'Projects',
      mimeType: 'application/vnd.google-apps.folder',
      modifiedTime: '2026-05-03T00:01:00.000Z'
    }));
    const signal = new AbortController().signal;
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('access-token').getMetadata('folder-projects', signal);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal });
  });

  it('renames files through Drive metadata patch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: 'file-home',
      name: 'Renamed.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:02:00.000Z',
      parents: ['root']
    }));
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('access-token').renameFile('file-home', 'Renamed.md');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file-home?fields=id,name,mimeType,modifiedTime,parents',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed.md' })
      })
    );
  });

  it('moves files to trash instead of permanently deleting them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'file-home' }));
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('access-token').trashFile('file-home');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file-home?fields=id',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ trashed: true })
      })
    );
  });

  it('lists file revisions with id and modified time', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ revisions: [{ id: 'rev-1', modifiedTime: '2026-07-01T00:00:00.000Z' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const revisions = await new HttpGoogleDriveClient('access-token').listRevisions('file-home');

    expect(fetchMock.mock.calls[0][0]).toContain('/files/file-home/revisions?');
    expect(revisions).toEqual([{ id: 'rev-1', modifiedTime: '2026-07-01T00:00:00.000Z' }]);
  });

  it('downloads revision content as text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '# old content'
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const content = await new HttpGoogleDriveClient('access-token').downloadRevisionText('file-home', 'rev-1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://www.googleapis.com/drive/v3/files/file-home/revisions/rev-1?alt=media'
    );
    expect(content).toBe('# old content');
  });

  it('refreshes the access token once on 401 and retries the request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(jsonResponse({ files: [] }));
    const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');
    vi.stubGlobal('fetch', fetchMock);

    await new HttpGoogleDriveClient('stale-token', { refreshAccessToken }).listFolders('root');

    expect(refreshAccessToken).toHaveBeenCalledWith('stale-token');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' })
    });
  });

  it('retries with backoff on 429 and honors Retry-After', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, 0))
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(jsonResponse({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new HttpGoogleDriveClient('access-token', { retryBaseDelayMs: 0 }).listFolders('root');

    expect(result).toEqual({ files: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after exhausting retries on persistent server errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new HttpGoogleDriveClient('access-token', { retryBaseDelayMs: 0 }).listFolders('root')
    ).rejects.toThrow('Drive request failed: 503');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not refresh the token twice for repeated 401 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401));
    const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new HttpGoogleDriveClient('stale-token', { refreshAccessToken }).listFolders('root')
    ).rejects.toThrow('Drive request failed: 401');
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}

function errorResponse(status: number, retryAfterSeconds?: number): Response {
  return {
    ok: false,
    status,
    headers: {
      get: (name: string) =>
        name === 'Retry-After' && retryAfterSeconds !== undefined ? String(retryAfterSeconds) : null
    },
    json: async () => ({})
  } as unknown as Response;
}
