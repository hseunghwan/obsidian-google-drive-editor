import type { OpenDocument, SaveResult, VaultEntry, VaultFile, VaultFolder, VaultRoot } from '../domain/vault/types';
import { DriveVaultAdapter } from '../integrations/google/driveVaultAdapter';
import type { GoogleAuthClient } from '../integrations/google/googleAuth';
import type { GoogleDriveClient } from '../integrations/google/googleDriveClient';
import type { GooglePickerClient } from '../integrations/google/googlePicker';
import type { DraftStore } from '../storage/draftStore';

export interface DriveWorkspace {
  root: VaultRoot;
  entries: VaultEntry[];
  loadFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  loadMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  searchEntries(rootFolderId: string, query: string, signal?: AbortSignal): Promise<VaultEntry[]>;
  loadFile(file: VaultFile): Promise<OpenDocument>;
  readFileContent(fileId: string): Promise<string>;
  loadGraphSettings(): Promise<unknown>;
  prefetchFile(file: VaultFile): void;
  getRemoteModifiedTime(fileId: string): Promise<string>;
  listRevisions(fileId: string): Promise<Array<{ id: string; modifiedTime: string }>>;
  getRevisionContent(fileId: string, revisionId: string): Promise<string>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
  createFile(parentFolderId: string, name: string, content: string): Promise<VaultFile>;
  createFolder(parentFolderId: string, name: string): Promise<VaultFolder>;
  renameEntry(entry: VaultEntry, name: string): Promise<VaultEntry>;
  moveEntry(entry: VaultEntry, targetFolderId: string, targetFolderPath: string): Promise<VaultEntry>;
  deleteEntry(entry: VaultEntry): Promise<void>;
}

interface LoadDriveWorkspaceDeps {
  auth: GoogleAuthClient;
  picker: GooglePickerClient;
  createDriveClient(accessToken: string): GoogleDriveClient;
  drafts: DraftStore;
  savedRoot?: VaultRoot;
}

interface CachedContent {
  modifiedTime: string;
  content: Promise<string>;
}

export async function loadDriveWorkspace(deps: LoadDriveWorkspaceDeps): Promise<DriveWorkspace> {
  const accessToken = await deps.auth.getAccessToken(!deps.savedRoot);
  const pickedFolder = deps.savedRoot ?? (await deps.picker.pickVaultFolder(accessToken));
  const adapter = new DriveVaultAdapter(deps.createDriveClient(accessToken), deps.drafts);
  const root: VaultRoot = { id: pickedFolder.id, name: pickedFolder.name };
  const contentCache = new Map<string, CachedContent>();

  function readFileWithCache(file: VaultFile): CachedContent {
    const cached = contentCache.get(file.id);
    if (cached && cached.modifiedTime >= file.modifiedTime) {
      return cached;
    }

    const entry: CachedContent = {
      modifiedTime: file.modifiedTime,
      content: adapter.readFile(file.id)
    };
    entry.content.catch(() => {
      if (contentCache.get(file.id) === entry) {
        contentCache.delete(file.id);
      }
    });
    contentCache.set(file.id, entry);
    return entry;
  }

  return {
    root,
    entries: [],
    loadFolders: (parentFolderId, parentPath) => adapter.listFolders(parentFolderId, parentPath),
    loadMarkdownFiles: (parentFolderId, parentPath) =>
      adapter.listMarkdownFiles(parentFolderId, parentPath),
    searchEntries: (rootFolderId, query, signal) => adapter.searchEntries(rootFolderId, query, signal),
    loadFile: async (file) => {
      const draft = await deps.drafts.getDraft(root.id, file.id);
      if (draft) {
        return {
          file,
          content: draft.content,
          baselineModifiedTime: draft.baselineModifiedTime
        };
      }

      const cached = readFileWithCache(file);
      return {
        file,
        content: await cached.content,
        baselineModifiedTime: cached.modifiedTime
      };
    },
    readFileContent: (fileId) => adapter.readFile(fileId),
    loadGraphSettings: () => adapter.readGraphSettings(root.id),
    prefetchFile: (file) => {
      readFileWithCache(file);
    },
    getRemoteModifiedTime: async (fileId) => {
      const metadata = await adapter.getRemoteMetadata(fileId);
      return metadata.modifiedTime;
    },
    listRevisions: (fileId) => adapter.listRevisions(fileId),
    getRevisionContent: (fileId, revisionId) => adapter.getRevisionContent(fileId, revisionId),
    saveDocument: async (document) => {
      const result = await adapter.saveFile(
        root.id,
        document.file.id,
        document.content,
        document.baselineModifiedTime
      );
      contentCache.set(document.file.id, {
        modifiedTime: result.modifiedTime,
        content: Promise.resolve(document.content)
      });
      return result;
    },
    createFile: (parentFolderId, name, content) => adapter.createFile(parentFolderId, name, content),
    createFolder: (parentFolderId, name) => adapter.createFolder(parentFolderId, name),
    renameEntry: (entry, name) => adapter.renameEntry(entry, name),
    moveEntry: (entry, targetFolderId, targetFolderPath) =>
      adapter.moveEntry(entry, targetFolderId, targetFolderPath),
    deleteEntry: (entry) => adapter.deleteEntry(root.id, entry)
  };
}
