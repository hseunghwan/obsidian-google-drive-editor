import type { OpenDocument, VaultFile, VaultRoot } from '../../domain/vault/types';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'conflict';

export interface WorkspaceState {
  root: VaultRoot | null;
  files: VaultFile[];
  activeDocument: OpenDocument | null;
  saveState: {
    status: SaveStatus;
  };
}

export type WorkspaceAction =
  | {
      type: 'documentOpened';
      root: VaultRoot;
      files: VaultFile[];
      document: OpenDocument;
    }
  | { type: 'documentEdited'; content: string }
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded'; modifiedTime: string }
  | { type: 'saveFailed' }
  | { type: 'remoteConflict' };

export function createInitialWorkspaceState(): WorkspaceState {
  return {
    root: null,
    files: [],
    activeDocument: null,
    saveState: {
      status: 'idle'
    }
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'documentOpened':
      return {
        root: action.root,
        files: action.files,
        activeDocument: action.document,
        saveState: {
          status: 'saved'
        }
      };
    case 'documentEdited':
      return {
        ...state,
        activeDocument: state.activeDocument
          ? { ...state.activeDocument, content: action.content }
          : null,
        saveState: {
          status: 'dirty'
        }
      };
    case 'saveStarted':
      return { ...state, saveState: { status: 'saving' } };
    case 'saveSucceeded':
      return {
        ...state,
        activeDocument: state.activeDocument
          ? { ...state.activeDocument, baselineModifiedTime: action.modifiedTime }
          : null,
        saveState: { status: 'saved' }
      };
    case 'saveFailed':
      return { ...state, saveState: { status: 'failed' } };
    case 'remoteConflict':
      return { ...state, saveState: { status: 'conflict' } };
  }
}
