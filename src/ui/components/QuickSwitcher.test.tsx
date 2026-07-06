import { describe, expect, it } from 'vitest';

import type { VaultFile } from '../../domain/vault/types';
import { rankQuickSwitcherFiles } from './QuickSwitcher';

function file(id: string, title: string, path = `${title}.md`): VaultFile {
  return {
    id,
    title,
    path,
    name: `${title}.md`,
    parentId: 'root',
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-01T00:00:00.000Z'
  };
}

const files = [
  file('a', 'Alpha'),
  file('b', 'Beta Notes', 'Projects/Beta Notes.md'),
  file('c', 'Gamma'),
  file('d', 'Beta Draft')
];

describe('rankQuickSwitcherFiles', () => {
  it('lists recent files first, most recent at the top', () => {
    const ranked = rankQuickSwitcherFiles(files, [files[2], files[0]], '');

    expect(ranked.map((entry) => entry.id)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('matches every query token against title and path', () => {
    const ranked = rankQuickSwitcherFiles(files, [], 'beta proj');

    expect(ranked.map((entry) => entry.id)).toEqual(['b']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(rankQuickSwitcherFiles(files, [], 'zzz')).toEqual([]);
  });
});
