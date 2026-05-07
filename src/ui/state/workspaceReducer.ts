import type { OpenDocument, VaultEntry, VaultFile, VaultRoot } from '../../domain/vault/types';

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
  | { type: 'workspaceReset' }
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
  | { type: 'remoteConflict' }
  | { type: 'entryRenamed'; previous: VaultEntry; entry: VaultEntry }
  | { type: 'entryDeleted'; entry: VaultEntry };

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
    case 'workspaceReset':
      return createInitialWorkspaceState();
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
    case 'entryRenamed':
      return {
        ...state,
        files: state.files.map((file) => updateFileForRenamedEntry(file, action.previous, action.entry)),
        activeDocument: state.activeDocument
          ? {
              ...state.activeDocument,
              file: updateFileForRenamedEntry(state.activeDocument.file, action.previous, action.entry)
            }
          : null
      };
    case 'entryDeleted':
      return {
        ...state,
        files: state.files.filter((file) => !entryContainsFile(action.entry, file)),
        activeDocument: state.activeDocument && entryContainsFile(action.entry, state.activeDocument.file)
          ? null
          : state.activeDocument
      };
  }
}

function updateFileForRenamedEntry(file: VaultFile, previousEntry: VaultEntry, nextEntry: VaultEntry): VaultFile {
  if (previousEntry.kind === 'markdown' && nextEntry.kind === 'markdown' && file.id === previousEntry.id) {
    return nextEntry;
  }

  if (previousEntry.kind !== 'folder' || nextEntry.kind !== 'folder') {
    return file;
  }

  const previousPathPrefix = `${previousEntry.path}/`;
  if (!file.path.startsWith(previousPathPrefix)) {
    return file;
  }

  return {
    ...file,
    path: `${nextEntry.path}/${file.path.slice(previousPathPrefix.length)}`
  };
}

function entryContainsFile(entry: VaultEntry, file: VaultFile) {
  if (entry.kind === 'markdown') {
    return entry.id === file.id;
  }

  return file.path.startsWith(`${entry.path}/`);
}
