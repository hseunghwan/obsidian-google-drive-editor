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
      "name contains 'project plan' and (mimeType = 'application/vnd.google-apps.folder' or (mimeType != 'application/vnd.google-apps.folder' and name contains '.md')) and trashed = false"
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
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
