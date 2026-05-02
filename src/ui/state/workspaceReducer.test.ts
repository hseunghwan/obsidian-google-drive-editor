import { describe, expect, it } from 'vitest';

import { fixtureFiles, fixtureVaultRoot } from '../../test/fixtures';
import { createInitialWorkspaceState, workspaceReducer } from './workspaceReducer';

describe('workspaceReducer', () => {
  it('opens a document and marks save state clean', () => {
    const state = createInitialWorkspaceState();
    const next = workspaceReducer(state, {
      type: 'documentOpened',
      root: fixtureVaultRoot,
      files: fixtureFiles,
      document: {
        file: fixtureFiles[0],
        content: '# Home',
        baselineModifiedTime: fixtureFiles[0].modifiedTime
      }
    });

    expect(next.activeDocument?.content).toBe('# Home');
    expect(next.saveState.status).toBe('saved');
  });

  it('marks document dirty after edit', () => {
    const state = workspaceReducer(createInitialWorkspaceState(), {
      type: 'documentOpened',
      root: fixtureVaultRoot,
      files: fixtureFiles,
      document: {
        file: fixtureFiles[0],
        content: '# Home',
        baselineModifiedTime: fixtureFiles[0].modifiedTime
      }
    });

    const next = workspaceReducer(state, {
      type: 'documentEdited',
      content: '# Home\n\nNew line'
    });

    expect(next.activeDocument?.content).toContain('New line');
    expect(next.saveState.status).toBe('dirty');
  });
});
