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
  searchEntries(rootFolderId: string, query: string): Promise<VaultEntry[]>;
  loadFile(file: VaultFile): Promise<OpenDocument>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
  createFile(parentFolderId: string, name: string, content: string): Promise<VaultFile>;
  createFolder(parentFolderId: string, name: string): Promise<VaultFolder>;
}

interface LoadDriveWorkspaceDeps {
  auth: GoogleAuthClient;
  picker: GooglePickerClient;
  createDriveClient(accessToken: string): GoogleDriveClient;
  drafts: DraftStore;
  savedRoot?: VaultRoot;
}

export async function loadDriveWorkspace(deps: LoadDriveWorkspaceDeps): Promise<DriveWorkspace> {
  const accessToken = await deps.auth.getAccessToken(!deps.savedRoot);
  const pickedFolder = deps.savedRoot ?? (await deps.picker.pickVaultFolder(accessToken));
  const adapter = new DriveVaultAdapter(deps.createDriveClient(accessToken), deps.drafts);
  const root: VaultRoot = { id: pickedFolder.id, name: pickedFolder.name };

  return {
    root,
    entries: [],
    loadFolders: (parentFolderId, parentPath) => adapter.listFolders(parentFolderId, parentPath),
    loadMarkdownFiles: (parentFolderId, parentPath) =>
      adapter.listMarkdownFiles(parentFolderId, parentPath),
    searchEntries: (rootFolderId, query) => adapter.searchEntries(rootFolderId, query),
    loadFile: async (file) => {
      const draft = await deps.drafts.getDraft(root.id, file.id);
      if (draft) {
        return {
          file,
          content: draft.content,
          baselineModifiedTime: draft.baselineModifiedTime
        };
      }

      return {
        file,
        content: await adapter.readFile(file.id),
        baselineModifiedTime: file.modifiedTime
      };
    },
    saveDocument: (document) =>
      adapter.saveFile(root.id, document.file.id, document.content, document.baselineModifiedTime),
    createFile: (parentFolderId, name, content) => adapter.createFile(parentFolderId, name, content),
    createFolder: (parentFolderId, name) => adapter.createFolder(parentFolderId, name)
  };
}
