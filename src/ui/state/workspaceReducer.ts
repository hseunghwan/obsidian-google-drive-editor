import type { OpenDocument, VaultFile, VaultRoot } from '../../domain/vault/types';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'conflict';

export interface WorkspaceState {
  root: VaultRoot | null;
  files: VaultFile[];
  activeDocument: OpenDocument | null;
  saveState: {
    status: SaveStatus;
    message: string;
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
  | { type: 'saveFailed'; message: string }
  | { type: 'remoteConflict'; message: string };

export function createInitialWorkspaceState(): WorkspaceState {
  return {
    root: null,
    files: [],
    activeDocument: null,
    saveState: {
      status: 'idle',
      message: 'Vault를 선택하세요.'
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
          status: 'saved',
          message: '저장됨'
        }
      };
    case 'documentEdited':
      return {
        ...state,
        activeDocument: state.activeDocument
          ? { ...state.activeDocument, content: action.content }
          : null,
        saveState: {
          status: 'dirty',
          message: '저장되지 않은 변경'
        }
      };
    case 'saveStarted':
      return { ...state, saveState: { status: 'saving', message: '저장 중' } };
    case 'saveSucceeded':
      return {
        ...state,
        activeDocument: state.activeDocument
          ? { ...state.activeDocument, baselineModifiedTime: action.modifiedTime }
          : null,
        saveState: { status: 'saved', message: '저장됨' }
      };
    case 'saveFailed':
      return { ...state, saveState: { status: 'failed', message: action.message } };
    case 'remoteConflict':
      return { ...state, saveState: { status: 'conflict', message: action.message } };
  }
}
