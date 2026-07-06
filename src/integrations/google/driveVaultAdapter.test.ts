import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

import { IndexedDbDraftStore } from '../../storage/draftStore';
import { DriveVaultAdapter } from './driveVaultAdapter';
import type { GoogleDriveClient } from './googleDriveClient';

function client(overrides: Partial<GoogleDriveClient> = {}): GoogleDriveClient {
  return {
    listFolders: vi.fn().mockResolvedValue({ files: [] }),
    listMarkdownFiles: vi.fn().mockResolvedValue({ files: [] }),
    searchByName: vi.fn().mockResolvedValue({ files: [] }),
    downloadText: vi.fn().mockResolvedValue(''),
    updateText: vi.fn().mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:03:00.000Z'
    }),
    createTextFile: vi.fn(),
    createFolder: vi.fn(),
    renameFile: vi.fn(),
    trashFile: vi.fn(),
    moveFile: vi.fn(),
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
  it('lists folders with pagination', async () => {
    const drive = client({
      listFolders: vi
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
              id: 'folder-archive',
              name: 'Archive',
              mimeType: 'application/vnd.google-apps.folder',
              modifiedTime: '2026-05-03T00:01:00.000Z'
            }
          ]
        })
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-list'));

    await expect(adapter.listFolders('root', '')).resolves.toEqual([
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
        id: 'folder-archive',
        name: 'Archive',
        path: 'Archive',
        parentId: 'root',
        kind: 'folder',
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: '2026-05-03T00:01:00.000Z'
      }
    ]);
  });

  it('lists only markdown files from file candidates', async () => {
    const drive = client({
      listMarkdownFiles: vi.fn().mockResolvedValue({
        files: [
          {
            id: 'file-home',
            name: 'Home.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-05-03T00:01:00.000Z'
          },
          {
            id: 'file-image',
            name: 'image.md.png',
            mimeType: 'image/png',
            modifiedTime: '2026-05-03T00:02:00.000Z'
          }
        ]
      })
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-markdown-list'));

    await expect(adapter.listMarkdownFiles('root', '')).resolves.toEqual([
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
    const drafts = new IndexedDbDraftStore('adapter-conflict');
    const adapter = new DriveVaultAdapter(client(), drafts);

    await expect(
      adapter.saveFile('root', 'file-home', '# Local', '2026-05-03T00:01:00.000Z')
    ).rejects.toMatchObject({ code: 'RemoteChanged' });
    await expect(drafts.getDraft('root', 'file-home')).resolves.toMatchObject({
      content: '# Local',
      reason: 'RemoteChanged'
    });
  });

  it('preserves a local draft when metadata preflight fails', async () => {
    const drafts = new IndexedDbDraftStore('adapter-metadata-failure');
    const adapter = new DriveVaultAdapter(
      client({
        getMetadata: vi.fn().mockRejectedValue(new Error('metadata unavailable'))
      }),
      drafts
    );

    await expect(
      adapter.saveFile('root', 'file-home', '# Local', '2026-05-03T00:01:00.000Z')
    ).rejects.toThrow('metadata unavailable');
    await expect(drafts.getDraft('root', 'file-home')).resolves.toMatchObject({
      content: '# Local',
      reason: 'NetworkFailed'
    });
  });

  it('clears a recovered draft after a successful save', async () => {
    const drafts = new IndexedDbDraftStore('adapter-save-success');
    await drafts.saveDraft({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local draft',
      baselineModifiedTime: '2026-05-03T00:02:00.000Z',
      savedAt: '2026-05-03T00:09:00.000Z',
      reason: 'NetworkFailed'
    });
    const adapter = new DriveVaultAdapter(driveWithCurrentMetadata(), drafts);

    await adapter.saveFile('root', 'file-home', '# Saved', '2026-05-03T00:02:00.000Z');

    await expect(drafts.getDraft('root', 'file-home')).resolves.toBeNull();
  });

  it('creates markdown files when the parent folder has no duplicate name', async () => {
    const drive = client({
      listFolders: vi.fn().mockResolvedValue({ files: [] }),
      listMarkdownFiles: vi.fn().mockResolvedValue({ files: [] }),
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
        listFolders: vi.fn().mockResolvedValue({ files: [] }),
        listMarkdownFiles: vi.fn().mockResolvedValue({
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

  it('renames markdown entries while preserving their parent path', async () => {
    const drive = client({
      listFolders: vi.fn().mockResolvedValue({ files: [] }),
      listMarkdownFiles: vi.fn().mockResolvedValue({ files: [] }),
      renameFile: vi.fn().mockResolvedValue({
        id: 'file-project-note',
        name: 'Renamed.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-05-03T00:05:00.000Z',
        parents: ['folder-projects']
      })
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-rename-file'));

    await expect(
      adapter.renameEntry({
        id: 'file-project-note',
        name: 'Project Note.md',
        title: 'Project Note',
        path: 'Projects/Project Note.md',
        parentId: 'folder-projects',
        kind: 'markdown',
        mimeType: 'text/markdown',
        modifiedTime: '2026-05-03T00:02:00.000Z'
      }, 'Renamed.md')
    ).resolves.toMatchObject({
      name: 'Renamed.md',
      title: 'Renamed',
      path: 'Projects/Renamed.md'
    });
    expect(drive.renameFile).toHaveBeenCalledWith('file-project-note', 'Renamed.md');
  });

  it('moves entries to Drive trash for deletion', async () => {
    const drive = client({ trashFile: vi.fn().mockResolvedValue(undefined) });
    const drafts = new IndexedDbDraftStore('adapter-delete-file');
    const adapter = new DriveVaultAdapter(drive, drafts);

    await adapter.deleteEntry('root', {
      id: 'file-home',
      name: 'Home.md',
      title: 'Home',
      path: 'Home.md',
      parentId: 'root',
      kind: 'markdown',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:01:00.000Z'
    });

    expect(drive.trashFile).toHaveBeenCalledWith('file-home');
  });

  it('searches unloaded Drive descendants for folders and markdown file names', async () => {
    const drive = client({
      searchByName: vi.fn().mockResolvedValue({
        files: [
          {
            id: 'folder-projects',
            name: 'Projects',
            mimeType: 'application/vnd.google-apps.folder',
            modifiedTime: '2026-05-03T00:01:00.000Z',
            parents: ['root']
          },
          {
            id: 'file-plan',
            name: 'Project Plan.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-05-03T00:02:00.000Z',
            parents: ['folder-projects']
          },
          {
            id: 'file-outside',
            name: 'Project Outside.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-05-03T00:03:00.000Z',
            parents: ['other-root']
          }
        ]
      }),
      getMetadata: vi.fn(async (fileId: string) => {
        const metadata = {
          root: {
            id: 'root',
            name: 'Vault',
            mimeType: 'application/vnd.google-apps.folder',
            modifiedTime: '2026-05-03T00:00:00.000Z'
          },
          'folder-projects': {
            id: 'folder-projects',
            name: 'Projects',
            mimeType: 'application/vnd.google-apps.folder',
            modifiedTime: '2026-05-03T00:01:00.000Z',
            parents: ['root']
          },
          'other-root': {
            id: 'other-root',
            name: 'Other',
            mimeType: 'application/vnd.google-apps.folder',
            modifiedTime: '2026-05-03T00:04:00.000Z'
          }
        };
        return metadata[fileId as keyof typeof metadata];
      })
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-search'));

    await expect(adapter.searchEntries('root', 'project')).resolves.toEqual([
      {
        id: 'folder-projects',
        name: 'Projects',
        path: 'Projects',
        parentId: 'root',
        kind: 'folder',
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: '2026-05-03T00:01:00.000Z'
      },
      {
        id: 'file-plan',
        name: 'Project Plan.md',
        title: 'Project Plan',
        path: 'Projects/Project Plan.md',
        parentId: 'folder-projects',
        kind: 'markdown',
        mimeType: 'text/markdown',
        modifiedTime: '2026-05-03T00:02:00.000Z'
      }
    ]);
  });

  it('reuses ancestor metadata for search results in the same folder', async () => {
    const getMetadata = vi.fn().mockResolvedValue({
      id: 'folder-projects',
      name: 'Projects',
      mimeType: 'application/vnd.google-apps.folder',
      modifiedTime: '2026-05-03T00:01:00.000Z',
      parents: ['root']
    });
    const drive = client({
      searchByName: vi.fn().mockResolvedValue({
        files: [
          {
            id: 'file-alpha',
            name: 'Alpha.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-05-03T00:02:00.000Z',
            parents: ['folder-projects']
          },
          {
            id: 'file-archive',
            name: 'Archive.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-05-03T00:03:00.000Z',
            parents: ['folder-projects']
          }
        ]
      }),
      getMetadata
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-search-cache'));

    await expect(adapter.searchEntries('root', 'a')).resolves.toHaveLength(2);

    expect(getMetadata).toHaveBeenCalledTimes(1);
    expect(getMetadata).toHaveBeenCalledWith('folder-projects', undefined);
  });
});

function driveWithCurrentMetadata() {
  return client({
    getMetadata: vi.fn().mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:02:00.000Z'
    })
  });
}
