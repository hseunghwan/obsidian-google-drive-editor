import { describe, expect, it } from 'vitest';

import type { VaultFile } from './types';
import { findWikiLinkTarget } from './wikiLinkResolution';

function file(overrides: Partial<VaultFile> & Pick<VaultFile, 'id' | 'title' | 'path'>): VaultFile {
  return {
    name: `${overrides.title}.md`,
    parentId: 'folder-root',
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-09T00:00:00.000Z',
    ...overrides
  };
}

describe('findWikiLinkTarget', () => {
  const files = [
    file({ id: 'file-a', title: 'Alpha', path: 'Alpha.md' }),
    file({ id: 'file-b', title: 'Beta', path: 'Notes/Beta.md' }),
    file({ id: 'file-c', title: 'Beta', path: 'Archive/Beta.md' })
  ];

  it('제목을 대소문자 무시로 매칭한다', () => {
    expect(findWikiLinkTarget(files, 'alpha')?.id).toBe('file-a');
  });

  it('공백을 다듬은 뒤 매칭한다', () => {
    expect(findWikiLinkTarget(files, '  Alpha  ')?.id).toBe('file-a');
  });

  it('.md를 뗀 경로로 매칭한다', () => {
    expect(findWikiLinkTarget(files, 'notes/beta')?.id).toBe('file-b');
  });

  it('중복 제목은 배열 첫 매치를 돌려준다', () => {
    expect(findWikiLinkTarget(files, 'Beta')?.id).toBe('file-b');
  });

  it('매치가 없으면 undefined', () => {
    expect(findWikiLinkTarget(files, 'Gamma')).toBeUndefined();
  });
});
