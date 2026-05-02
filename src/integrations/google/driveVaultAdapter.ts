import { isVaultError, VaultError } from '../../domain/vault/errors';
import type { SaveResult, VaultEntry, VaultFile, VaultFolder } from '../../domain/vault/types';
import type { DraftStore } from '../../storage/draftStore';
import type { GoogleDriveClient, GoogleDriveFile } from './googleDriveClient';

const folderMimeType = 'application/vnd.google-apps.folder';

export class DriveVaultAdapter {
  constructor(
    private readonly drive: GoogleDriveClient,
    private readonly drafts: DraftStore
  ) {}

  async listChildren(folderId: string): Promise<VaultEntry[]> {
    const files: GoogleDriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const page = await this.drive.listChildren(folderId, pageToken);
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);

    return files
      .filter((file) => file.mimeType === folderMimeType || file.name.endsWith('.md'))
      .map((file) => toVaultItem(file, folderId));
  }

  async readFile(fileId: string) {
    return this.drive.downloadText(fileId);
  }

  async saveFile(
    vaultRootId: string,
    fileId: string,
    content: string,
    expectedModifiedTime: string
  ): Promise<SaveResult> {
    try {
      const metadata = await this.drive.getMetadata(fileId);
      if (metadata.modifiedTime > expectedModifiedTime) {
        await this.saveDraft(vaultRootId, fileId, content, expectedModifiedTime, 'RemoteChanged');
        throw new VaultError('RemoteChanged', 'Remote file changed before save.');
      }

      const updated = await this.drive.updateText(fileId, content);
      await this.drafts.deleteDraft(vaultRootId, fileId);
      return {
        fileId: updated.id,
        modifiedTime: updated.modifiedTime
      };
    } catch (error) {
      if (isVaultError(error, 'RemoteChanged')) {
        throw error;
      }

      await this.saveDraft(vaultRootId, fileId, content, expectedModifiedTime, 'NetworkFailed');
      throw error;
    }
  }

  async createFile(parentFolderId: string, name: string, content: string): Promise<VaultFile> {
    await this.assertNameAvailable(parentFolderId, name);
    const file = await this.drive.createTextFile(parentFolderId, name, content);
    const entry = toVaultItem(file, parentFolderId);
    if (entry.kind !== 'markdown') {
      throw new VaultError('NetworkFailed', `Created file is not markdown: ${name}`);
    }
    return entry;
  }

  async createFolder(parentFolderId: string, name: string): Promise<VaultFolder> {
    await this.assertNameAvailable(parentFolderId, name);
    const folder = await this.drive.createFolder(parentFolderId, name);
    const entry = toVaultItem(folder, parentFolderId);
    if (entry.kind !== 'folder') {
      throw new VaultError('NetworkFailed', `Created folder is not a folder: ${name}`);
    }
    return entry;
  }

  private async assertNameAvailable(parentFolderId: string, name: string) {
    const children = await this.listChildren(parentFolderId);
    if (children.some((child) => child.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new VaultError('DuplicateName', `Name already exists in this folder: ${name}`);
    }
  }

  private saveDraft(
    vaultRootId: string,
    fileId: string,
    content: string,
    baselineModifiedTime: string,
    reason: string
  ) {
    return this.drafts.saveDraft({
      vaultRootId,
      fileId,
      content,
      baselineModifiedTime,
      savedAt: new Date().toISOString(),
      reason
    });
  }
}

function toVaultItem(file: GoogleDriveFile, parentId: string): VaultEntry {
  if (file.mimeType === folderMimeType) {
    return {
      id: file.id,
      name: file.name,
      path: file.name,
      parentId,
      kind: 'folder',
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime
    };
  }

  return {
    id: file.id,
    name: file.name,
    title: file.name.replace(/\.md$/i, ''),
    path: file.name,
    parentId,
    kind: 'markdown',
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime
  };
}
