import { describe, expect, it } from 'vitest';

import type { VaultFile } from '../vault/types';
import { buildGraphModel } from './graphModel';

function file(id: string, title: string, path: string): VaultFile {
  return {
    id,
    title,
    path,
    name: `${title}.md`,
    parentId: 'folder-root',
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-09T00:00:00.000Z'
  };
}

const files = [
  file('file-a', 'Alpha', 'Alpha.md'),
  file('file-b', 'Beta', 'Beta.md'),
  file('file-c', 'Gamma', 'Notes/Gamma.md')
];

describe('buildGraphModel', () => {
  it('제목과 경로로 링크를 해석해 엣지를 만든다', () => {
    const model = buildGraphModel(
      files,
      new Map([['file-a', ['beta', 'Notes/Gamma']]])
    );
    expect(model.edges).toEqual([
      { sourceId: 'file-a', targetId: 'file-b' },
      { sourceId: 'file-a', targetId: 'file-c' }
    ]);
  });

  it('미해결 링크와 자기 링크는 버린다', () => {
    const model = buildGraphModel(files, new Map([['file-a', ['Nowhere', 'Alpha']]]));
    expect(model.edges).toEqual([]);
  });

  it('같은 쌍의 중복·역방향 링크는 하나로 합친다', () => {
    const model = buildGraphModel(
      files,
      new Map([
        ['file-a', ['Beta', 'Beta']],
        ['file-b', ['Alpha']]
      ])
    );
    expect(model.edges).toHaveLength(1);
  });

  it('고아 노드도 degree 0으로 포함한다', () => {
    const model = buildGraphModel(files, new Map([['file-a', ['Beta']]]));
    expect(model.nodes).toHaveLength(3);
    const degrees = Object.fromEntries(model.nodes.map((node) => [node.id, node.degree]));
    expect(degrees).toEqual({ 'file-a': 1, 'file-b': 1, 'file-c': 0 });
  });
});
