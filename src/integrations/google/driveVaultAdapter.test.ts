import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

import { IndexedDbDraftStore } from '../../storage/draftStore';
import { DriveVaultAdapter } from './driveVaultAdapter';
import type { GoogleDriveClient } from './googleDriveClient';

function client(overrides: Partial<GoogleDriveClient> = {}): GoogleDriveClient {
  return {
    listChildren: vi.fn().mockResolvedValue({ files: [] }),
    downloadText: vi.fn().mockResolvedValue(''),
    updateText: vi.fn().mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:03:00.000Z'
    }),
    createTextFile: vi.fn(),
    createFolder: vi.fn(),
    getMetadata: vi.fn().mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:02:00.000Z'
    }),
    ...overrides
  };
}

describe('DriveVaultAdapter', () => {
  it('lists markdown files and folders with pagination', async () => {
    const drive = client({
      listChildren: vi
        .fn()
        .mockResolvedValueOnce({
          nextPageToken: 'page-2',
          files: [
            {
              id: 'folder-projects',
              name: 'Projects',
              mimeType: 'application/vnd.google-apps.folder',
              modifiedTime: '2026-05-03T00:00:00.000Z'
            }
          ]
        })
        .mockResolvedValueOnce({
          files: [
            {
              id: 'file-home',
              name: 'Home.md',
              mimeType: 'text/markdown',
              modifiedTime: '2026-05-03T00:01:00.000Z'
            }
          ]
        })
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-list'));

    await expect(adapter.listChildren('root')).resolves.toEqual([
      {
        id: 'folder-projects',
        name: 'Projects',
        path: 'Projects',
        parentId: 'root',
        kind: 'folder',
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: '2026-05-03T00:00:00.000Z'
      },
      {
        id: 'file-home',
        name: 'Home.md',
        title: 'Home',
        path: 'Home.md',
        parentId: 'root',
        kind: 'markdown',
        mimeType: 'text/markdown',
        modifiedTime: '2026-05-03T00:01:00.000Z'
      }
    ]);
  });

  it('blocks save when remote metadata changed', async () => {
    const adapter = new DriveVaultAdapter(client(), new IndexedDbDraftStore('adapter-conflict'));

    await expect(
      adapter.saveFile('root', 'file-home', '# Local', '2026-05-03T00:01:00.000Z')
    ).rejects.toMatchObject({ code: 'RemoteChanged' });
  });

  it('creates markdown files when the parent folder has no duplicate name', async () => {
    const drive = client({
      listChildren: vi.fn().mockResolvedValue({ files: [] }),
      createTextFile: vi.fn().mockResolvedValue({
        id: 'file-new-note',
        name: 'New Note.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-05-03T00:04:00.000Z'
      })
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-create-file'));

    await expect(adapter.createFile('root', 'New Note.md', '# New Note')).resolves.toMatchObject({
      id: 'file-new-note',
      name: 'New Note.md',
      kind: 'markdown'
    });
  });

  it('rejects duplicate names in the same parent folder', async () => {
    const adapter = new DriveVaultAdapter(
      client({
        listChildren: vi.fn().mockResolvedValue({
          files: [
            {
              id: 'file-home',
              name: 'Home.md',
              mimeType: 'text/markdown',
              modifiedTime: '2026-05-03T00:01:00.000Z'
            }
          ]
        })
      }),
      new IndexedDbDraftStore('adapter-duplicate')
    );

    await expect(adapter.createFile('root', 'Home.md', '# Home')).rejects.toMatchObject({
      code: 'DuplicateName'
    });
  });
});
