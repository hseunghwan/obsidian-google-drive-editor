import { describe, expect, it, vi } from 'vitest';

import type { VaultFile, VaultFolder } from '../domain/vault/types';
import type { GraphLinkRecord, GraphLinkStore } from '../storage/graphLinkStore';
import { scanVaultLinks } from './graphScanner';

function file(id: string, title: string, path: string, parentId = 'root-1'): VaultFile {
  return {
    id,
    title,
    path,
    name: `${title}.md`,
    parentId,
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-09T00:00:00.000Z'
  };
}

function folder(id: string, name: string, path: string): VaultFolder {
  return {
    id,
    name,
    path,
    parentId: 'root-1',
    kind: 'folder',
    mimeType: 'application/vnd.google-apps.folder',
    modifiedTime: '2026-07-09T00:00:00.000Z'
  };
}

function memoryStore(seed: GraphLinkRecord[] = []): GraphLinkStore {
  const records = new Map(seed.map((record) => [`${record.vaultRootId}:${record.fileId}`, record]));
  return {
    async getAll(vaultRootId) {
      return [...records.values()].filter((record) => record.vaultRootId === vaultRootId);
    },
    async putMany(next) {
      for (const record of next) {
        records.set(`${record.vaultRootId}:${record.fileId}`, record);
      }
    }
  };
}

const rootFiles = [file('file-a', 'Alpha', 'Alpha.md')];
const nestedFiles = [file('file-b', 'Beta', 'Notes/Beta.md', 'folder-notes')];

function listDeps() {
  return {
    listFolders: vi.fn(async (parentFolderId: string) =>
      parentFolderId === 'root-1' ? [folder('folder-notes', 'Notes', 'Notes')] : []
    ),
    listMarkdownFiles: vi.fn(async (parentFolderId: string) => {
      if (parentFolderId === 'root-1') return rootFiles;
      if (parentFolderId === 'folder-notes') return nestedFiles;
      return [];
    })
  };
}

describe('scanVaultLinks', () => {
  it('하위 폴더까지 훑어 링크를 추출하고 캐시에 남긴다', async () => {
    const store = memoryStore();
    const readFileContent = vi.fn(async (fileId: string) => (fileId === 'file-a' ? '[[Beta]] 본문' : '링크 없음'));

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store
    });

    expect(result.files.map((entry) => entry.id).sort()).toEqual(['file-a', 'file-b']);
    expect(result.wikiLinksByFileId.get('file-a')).toEqual(['Beta']);
    expect(result.failedFileIds).toEqual([]);
    expect(await store.getAll('root-1')).toHaveLength(2);
  });

  it('modifiedTime이 같은 파일은 다시 받지 않는다', async () => {
    const store = memoryStore([
      { vaultRootId: 'root-1', fileId: 'file-a', modifiedTime: '2026-07-09T00:00:00.000Z', wikiLinks: ['Beta'] },
      { vaultRootId: 'root-1', fileId: 'file-b', modifiedTime: '2026-07-09T00:00:00.000Z', wikiLinks: [] }
    ]);
    const readFileContent = vi.fn();

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store
    });

    expect(readFileContent).not.toHaveBeenCalled();
    expect(result.wikiLinksByFileId.get('file-a')).toEqual(['Beta']);
  });

  it('개별 파일 실패는 건너뛰고 옛 캐시를 쓴다', async () => {
    const store = memoryStore([
      { vaultRootId: 'root-1', fileId: 'file-a', modifiedTime: '2026-01-01T00:00:00.000Z', wikiLinks: ['Beta'] }
    ]);
    const readFileContent = vi.fn(async (fileId: string) => {
      if (fileId === 'file-a') throw new Error('rate limited');
      return '';
    });

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store
    });

    expect(result.failedFileIds).toEqual(['file-a']);
    expect(result.wikiLinksByFileId.get('file-a')).toEqual(['Beta']);
    expect(result.wikiLinksByFileId.get('file-b')).toEqual([]);
  });

  it('중단 플래그가 서면 남은 파일을 받지 않는다', async () => {
    let calls = 0;
    const readFileContent = vi.fn(async () => {
      calls += 1;
      return '';
    });

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store: memoryStore(),
      concurrency: 1,
      isCancelled: () => calls >= 1
    });

    expect(result.cancelled).toBe(true);
    expect(readFileContent).toHaveBeenCalledTimes(1);
  });

  it('진행률을 보고한다', async () => {
    const onProgress = vi.fn();

    await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent: async () => '',
      store: memoryStore(),
      onProgress
    });

    expect(onProgress).toHaveBeenCalledWith(0, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });
});
