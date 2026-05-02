import { describe, expect, it } from 'vitest';

import { fixtureFiles } from '../../test/fixtures';
import { VaultIndex } from './vaultIndex';

describe('VaultIndex', () => {
  it('searches markdown files by title and path', () => {
    const index = new VaultIndex();
    index.replaceAll(fixtureFiles);

    expect(index.searchFiles('project')).toEqual([
      {
        id: 'file-project-note',
        title: 'Project Note',
        path: 'Projects/Project Note.md',
        ambiguous: false
      }
    ]);
  });

  it('marks duplicate note titles as ambiguous', () => {
    const index = new VaultIndex();
    index.replaceAll([
      ...fixtureFiles,
      {
        ...fixtureFiles[1],
        id: 'file-archive-project-note',
        path: 'Archive/Project Note.md'
      }
    ]);

    expect(index.searchFiles('project note')).toEqual([
      {
        id: 'file-archive-project-note',
        title: 'Project Note',
        path: 'Archive/Project Note.md',
        ambiguous: true
      },
      {
        id: 'file-project-note',
        title: 'Project Note',
        path: 'Projects/Project Note.md',
        ambiguous: true
      }
    ]);
  });
});
