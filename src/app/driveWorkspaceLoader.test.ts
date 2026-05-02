import { describe, expect, it, vi } from 'vitest';

import type { DraftStore } from '../storage/draftStore';
import { loadDriveWorkspace } from './driveWorkspaceLoader';

describe('loadDriveWorkspace', () => {
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
        listChildren: vi.fn().mockResolvedValue({
          files: [
            {
              id: 'file-home',
              name: 'Home.md',
              mimeType: 'text/markdown',
              modifiedTime: '2026-05-03T00:02:00.000Z'
            }
          ]
        }),
        downloadText: vi.fn().mockResolvedValue('# Remote'),
        updateText: vi.fn(),
        createTextFile: vi.fn(),
        createFolder: vi.fn(),
        getMetadata: vi.fn()
      }),
      drafts
    });

    await expect(workspace.loadFile(workspace.files[0])).resolves.toMatchObject({
      content: '# Local draft',
      baselineModifiedTime: '2026-05-03T00:01:00.000Z'
    });
  });
});

function draftStore(draft: Awaited<ReturnType<DraftStore['getDraft']>>): DraftStore {
  return {
    saveDraft: vi.fn(),
    getDraft: vi.fn().mockResolvedValue(draft),
    deleteDraft: vi.fn()
  };
}
