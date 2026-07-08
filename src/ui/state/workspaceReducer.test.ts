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

  it('viewModeChanged로 그래프 뷰를 켜고 끈다', () => {
    const opened = workspaceReducer(createInitialWorkspaceState(), {
      type: 'viewModeChanged',
      viewMode: 'graph'
    });
    expect(opened.viewMode).toBe('graph');

    const closed = workspaceReducer(opened, { type: 'viewModeChanged', viewMode: 'editor' });
    expect(closed.viewMode).toBe('editor');
  });

  it('초기 상태는 에디터 뷰다', () => {
    expect(createInitialWorkspaceState().viewMode).toBe('editor');
  });

  it('문서를 열면 에디터 뷰로 돌아온다', () => {
    const inGraph = workspaceReducer(createInitialWorkspaceState(), {
      type: 'viewModeChanged',
      viewMode: 'graph'
    });
    const opened = workspaceReducer(inGraph, {
      type: 'documentOpened',
      root: fixtureVaultRoot,
      files: fixtureFiles,
      document: {
        file: fixtureFiles[0],
        content: '# Home',
        baselineModifiedTime: fixtureFiles[0].modifiedTime
      }
    });
    expect(opened.viewMode).toBe('editor');
  });
});
