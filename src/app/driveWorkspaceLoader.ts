import type { OpenDocument, SaveResult, VaultFile, VaultRoot } from '../domain/vault/types';
import { DriveVaultAdapter } from '../integrations/google/driveVaultAdapter';
import type { GoogleAuthClient } from '../integrations/google/googleAuth';
import type { GoogleDriveClient } from '../integrations/google/googleDriveClient';
import type { GooglePickerClient } from '../integrations/google/googlePicker';
import type { DraftStore } from '../storage/draftStore';

export interface DriveWorkspace {
  root: VaultRoot;
  files: VaultFile[];
  loadFile(file: VaultFile): Promise<OpenDocument>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
}

interface LoadDriveWorkspaceDeps {
  auth: GoogleAuthClient;
  picker: GooglePickerClient;
  createDriveClient(accessToken: string): GoogleDriveClient;
  drafts: DraftStore;
}

export async function loadDriveWorkspace(deps: LoadDriveWorkspaceDeps): Promise<DriveWorkspace> {
  const accessToken = await deps.auth.getAccessToken(true);
  const pickedFolder = await deps.picker.pickVaultFolder(accessToken);
  const adapter = new DriveVaultAdapter(deps.createDriveClient(accessToken), deps.drafts);
  const root: VaultRoot = { id: pickedFolder.id, name: pickedFolder.name };
  const files = await collectMarkdownFiles(adapter, root.id);

  return {
    root,
    files,
    loadFile: async (file) => ({
      file,
      content: await adapter.readFile(file.id),
      baselineModifiedTime: file.modifiedTime
    }),
    saveDocument: (document) =>
      adapter.saveFile(root.id, document.file.id, document.content, document.baselineModifiedTime)
  };
}

async function collectMarkdownFiles(
  adapter: DriveVaultAdapter,
  folderId: string,
  parentPath = ''
): Promise<VaultFile[]> {
  const entries = await adapter.listChildren(folderId);
  const files: VaultFile[] = [];

  for (const entry of entries) {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (entry.kind === 'markdown') {
      files.push({ ...entry, path });
    }
    if (entry.kind === 'folder') {
      files.push(...(await collectMarkdownFiles(adapter, entry.id, path)));
    }
  }

  return files;
}
