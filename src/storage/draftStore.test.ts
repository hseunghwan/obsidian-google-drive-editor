import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { IndexedDbDraftStore } from './draftStore';

describe('IndexedDbDraftStore', () => {
  it('saves and retrieves a draft by vault and file id', async () => {
    const store = new IndexedDbDraftStore('test-drafts');

    await store.saveDraft({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local edit',
      baselineModifiedTime: '2026-05-03T00:00:00.000Z',
      savedAt: '2026-05-03T00:10:00.000Z',
      reason: 'NetworkFailed'
    });

    await expect(store.getDraft('root', 'file-home')).resolves.toEqual({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local edit',
      baselineModifiedTime: '2026-05-03T00:00:00.000Z',
      savedAt: '2026-05-03T00:10:00.000Z',
      reason: 'NetworkFailed'
    });
  });

  it('removes a recovered draft', async () => {
    const store = new IndexedDbDraftStore('test-drafts-delete');

    await store.saveDraft({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local edit',
      baselineModifiedTime: '2026-05-03T00:00:00.000Z',
      savedAt: '2026-05-03T00:10:00.000Z',
      reason: 'NetworkFailed'
    });

    await store.deleteDraft('root', 'file-home');

    await expect(store.getDraft('root', 'file-home')).resolves.toBeNull();
  });
});
