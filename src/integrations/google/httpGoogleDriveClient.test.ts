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
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
