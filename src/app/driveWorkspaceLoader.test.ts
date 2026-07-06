import { describe, expect, it, vi } from 'vitest';

import type { VaultFile } from '../domain/vault/types';
import type { DraftStore } from '../storage/draftStore';
import { loadDriveWorkspace } from './driveWorkspaceLoader';

describe('loadDriveWorkspace', () => {
  it('returns a workspace without recursively loading Drive children', async () => {
    const drive = {
      listFolders: vi.fn().mockResolvedValue({ files: [] }),
      listMarkdownFiles: vi.fn().mockResolvedValue({ files: [] }),
      searchByName: vi.fn().mockResolvedValue({ files: [] }),
      downloadText: vi.fn().mockResolvedValue('# Remote'),
      updateText: vi.fn(),
      createTextFile: vi.fn(),
      createFolder: vi.fn(),
      renameFile: vi.fn(),
      trashFile: vi.fn(),
      moveFile: vi.fn(),
      listRevisions: vi.fn(),
      downloadRevisionText: vi.fn(),
      getMetadata: vi.fn()
    };

    const workspace = await loadDriveWorkspace({
      auth: { getAccessToken: vi.fn().mockResolvedValue('token') },
      picker: { pickVaultFolder: vi.fn().mockResolvedValue({ id: 'root', name: 'Vault' }) },
      createDriveClient: () => drive,
      drafts: draftStore(null)
    });

    expect(workspace.entries).toEqual([]);
    expect(drive.listFolders).not.toHaveBeenCalled();
    expect(drive.listMarkdownFiles).not.toHaveBeenCalled();

    await workspace.loadFolders('root', '');
    await workspace.loadMarkdownFiles('root', '');

    expect(drive.listFolders).toHaveBeenCalledTimes(1);
    expect(drive.listMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it('returns a preserved local draft when opening a file with failed save content', async () => {
    const drafts = draftStore({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local draft',
      baselineModifiedTime: '2026-05-03T00:01:00.000Z',
      savedAt: '2026-05-03T00:10:00.000Z',
      reason: 'NetworkFailed'
    });

    const workspace = await loadDriveWorkspace({
      auth: { getAccessToken: vi.fn().mockResolvedValue('token') },
      picker: { pickVaultFolder: vi.fn().mockResolvedValue({ id: 'root', name: 'Vault' }) },
      createDriveClient: () => ({
        listFolders: vi.fn().mockResolvedValue({ files: [] }),
        listMarkdownFiles: vi.fn().mockResolvedValue({
          files: [
            {
              id: 'file-home',
              name: 'Home.md',
              mimeType: 'text/markdown',
              modifiedTime: '2026-05-03T00:02:00.000Z'
            }
          ]
        }),
        searchByName: vi.fn().mockResolvedValue({ files: [] }),
        downloadText: vi.fn().mockResolvedValue('# Remote'),
        updateText: vi.fn(),
        createTextFile: vi.fn(),
        createFolder: vi.fn(),
        renameFile: vi.fn(),
        trashFile: vi.fn(),
        moveFile: vi.fn(),
        listRevisions: vi.fn(),
        downloadRevisionText: vi.fn(),
        getMetadata: vi.fn()
      }),
      drafts
    });

    const [file] = await workspace.loadMarkdownFiles('root', '');
    await expect(workspace.loadFile(file)).resolves.toMatchObject({
      content: '# Local draft',
      baselineModifiedTime: '2026-05-03T00:01:00.000Z'
    });
  });

  it('reuses cached content when reopening a file with the same modifiedTime', async () => {
    const { workspace, drive } = await cachedWorkspace();

    await workspace.loadFile(markdownFile('2026-05-03T00:02:00.000Z'));
    await expect(workspace.loadFile(markdownFile('2026-05-03T00:02:00.000Z'))).resolves.toMatchObject({
      content: '# Remote',
      baselineModifiedTime: '2026-05-03T00:02:00.000Z'
    });

    expect(drive.downloadText).toHaveBeenCalledTimes(1);
  });

  it('downloads again when the file listing reports a newer modifiedTime', async () => {
    const { workspace, drive } = await cachedWorkspace();

    await workspace.loadFile(markdownFile('2026-05-03T00:02:00.000Z'));
    await workspace.loadFile(markdownFile('2026-05-03T00:05:00.000Z'));

    expect(drive.downloadText).toHaveBeenCalledTimes(2);
  });

  it('shares the prefetch download when the file is opened right after', async () => {
    const { workspace, drive } = await cachedWorkspace();

    workspace.prefetchFile(markdownFile('2026-05-03T00:02:00.000Z'));
    await expect(workspace.loadFile(markdownFile('2026-05-03T00:02:00.000Z'))).resolves.toMatchObject({
      content: '# Remote'
    });

    expect(drive.downloadText).toHaveBeenCalledTimes(1);
  });

  it('retries the download after a prefetch failure', async () => {
    const { workspace, drive } = await cachedWorkspace();
    drive.downloadText.mockRejectedValueOnce(new Error('offline'));

    workspace.prefetchFile(markdownFile('2026-05-03T00:02:00.000Z'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(workspace.loadFile(markdownFile('2026-05-03T00:02:00.000Z'))).resolves.toMatchObject({
      content: '# Remote'
    });
  });

  it('serves the saved content from cache after a successful save', async () => {
    const { workspace, drive } = await cachedWorkspace();
    drive.getMetadata.mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:02:00.000Z'
    });
    drive.updateText.mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:09:00.000Z'
    });

    const file = markdownFile('2026-05-03T00:02:00.000Z');
    await workspace.saveDocument({
      file,
      content: '# Saved locally',
      baselineModifiedTime: file.modifiedTime
    });

    await expect(workspace.loadFile(file)).resolves.toMatchObject({
      content: '# Saved locally',
      baselineModifiedTime: '2026-05-03T00:09:00.000Z'
    });
    expect(drive.downloadText).not.toHaveBeenCalled();
  });
});

async function cachedWorkspace() {
  const drive = {
    listFolders: vi.fn().mockResolvedValue({ files: [] }),
    listMarkdownFiles: vi.fn().mockResolvedValue({ files: [] }),
    searchByName: vi.fn().mockResolvedValue({ files: [] }),
    downloadText: vi.fn().mockResolvedValue('# Remote'),
    updateText: vi.fn(),
    createTextFile: vi.fn(),
    createFolder: vi.fn(),
    renameFile: vi.fn(),
    trashFile: vi.fn(),
    moveFile: vi.fn(),
    listRevisions: vi.fn(),
    downloadRevisionText: vi.fn(),
    getMetadata: vi.fn()
  };

  const workspace = await loadDriveWorkspace({
    auth: { getAccessToken: vi.fn().mockResolvedValue('token') },
    picker: { pickVaultFolder: vi.fn().mockResolvedValue({ id: 'root', name: 'Vault' }) },
    createDriveClient: () => drive,
    drafts: draftStore(null)
  });

  return { workspace, drive };
}

function markdownFile(modifiedTime: string): VaultFile {
  return {
    id: 'file-home',
    name: 'Home.md',
    title: 'Home',
    path: 'Home.md',
    parentId: 'root',
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime
  };
}

function draftStore(draft: Awaited<ReturnType<DraftStore['getDraft']>>): DraftStore {
  return {
    saveDraft: vi.fn(),
    getDraft: vi.fn().mockResolvedValue(draft),
    deleteDraft: vi.fn()
  };
}
