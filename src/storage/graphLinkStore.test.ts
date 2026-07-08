import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { IndexedDbGraphLinkStore } from './graphLinkStore';

function record(vaultRootId: string, fileId: string, wikiLinks: string[] = []) {
  return { vaultRootId, fileId, modifiedTime: '2026-07-09T00:00:00.000Z', wikiLinks };
}

describe('IndexedDbGraphLinkStore', () => {
  it('저장한 레코드를 vault 단위로 다시 읽는다', async () => {
    const store = new IndexedDbGraphLinkStore('graph-test-roundtrip');
    await store.putMany([record('root-1', 'file-a', ['Beta']), record('root-1', 'file-b')]);

    const records = await store.getAll('root-1');
    expect(records).toHaveLength(2);
    expect(records.find((entry) => entry.fileId === 'file-a')?.wikiLinks).toEqual(['Beta']);
  });

  it('다른 vault의 레코드는 섞이지 않는다', async () => {
    const store = new IndexedDbGraphLinkStore('graph-test-isolation');
    await store.putMany([record('root-1', 'file-a'), record('root-2', 'file-b')]);

    expect(await store.getAll('root-1')).toHaveLength(1);
  });

  it('같은 파일을 다시 저장하면 덮어쓴다', async () => {
    const store = new IndexedDbGraphLinkStore('graph-test-overwrite');
    await store.putMany([record('root-1', 'file-a', ['Old'])]);
    await store.putMany([record('root-1', 'file-a', ['New'])]);

    const records = await store.getAll('root-1');
    expect(records).toHaveLength(1);
    expect(records[0].wikiLinks).toEqual(['New']);
  });
});
