import { isVaultError, VaultError } from '../../domain/vault/errors';
import type { SaveResult, VaultEntry, VaultFile, VaultFolder } from '../../domain/vault/types';
import type { DraftStore } from '../../storage/draftStore';
import type { GoogleDriveClient, GoogleDriveFile } from './googleDriveClient';

const folderMimeType = 'application/vnd.google-apps.folder';

export class DriveVaultAdapter {
  private readonly ancestorRequests = new Map<string, Promise<GoogleDriveFile[] | null>>();
  private readonly metadataRequests = new Map<string, Promise<GoogleDriveFile>>();

  constructor(
    private readonly drive: GoogleDriveClient,
    private readonly drafts: DraftStore
  ) {}

  async listFolders(folderId: string, parentPath = ''): Promise<VaultFolder[]> {
    const files = await this.collectPages((pageToken) => this.drive.listFolders(folderId, pageToken));
    return files
      .filter((file) => file.mimeType === folderMimeType)
      .map((file) => toVaultFolder(file, folderId, parentPath));
  }

  async listMarkdownFiles(folderId: string, parentPath = ''): Promise<VaultFile[]> {
    const files = await this.collectPages((pageToken) => this.drive.listMarkdownFiles(folderId, pageToken));
    return files
      .filter((file) => file.name.toLocaleLowerCase().endsWith('.md'))
      .map((file) => toVaultFile(file, folderId, parentPath));
  }

  async searchEntries(rootFolderId: string, query: string, signal?: AbortSignal): Promise<VaultEntry[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const files = await this.collectPages((pageToken) => this.drive.searchByName(normalizedQuery, pageToken, signal));
    const entries = await Promise.all(
      files
        .filter((file) => isFolder(file) || isMarkdownFile(file))
        .map((file) => this.toRootDescendantEntry(rootFolderId, file, signal))
    );

    return entries
      .filter((entry): entry is VaultEntry => Boolean(entry))
      .sort(compareEntries);
  }

  private async collectPages(
    listPage: (pageToken?: string) => Promise<{ files: GoogleDriveFile[]; nextPageToken?: string }>
  ) {
    const files: GoogleDriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const page = await listPage(pageToken);
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);

    return files;
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
    if (!file.name.toLocaleLowerCase().endsWith('.md')) {
      throw new VaultError('NetworkFailed', `Created file is not markdown: ${name}`);
    }
    return toVaultFile(file, parentFolderId, '');
  }

  async createFolder(parentFolderId: string, name: string): Promise<VaultFolder> {
    await this.assertNameAvailable(parentFolderId, name);
    const folder = await this.drive.createFolder(parentFolderId, name);
    if (folder.mimeType !== folderMimeType) {
      throw new VaultError('NetworkFailed', `Created folder is not a folder: ${name}`);
    }
    return toVaultFolder(folder, parentFolderId, '');
  }

  async renameEntry(entry: VaultEntry, name: string): Promise<VaultEntry> {
    if (!entry.parentId) {
      throw new VaultError('NetworkFailed', `Cannot rename an entry without a parent: ${entry.name}`);
    }

    await this.assertNameAvailable(entry.parentId, name, entry.id);
    const renamed = await this.drive.renameFile(entry.id, name);
    const parentPath = parentPathForEntry(entry);

    if (entry.kind === 'folder') {
      if (renamed.mimeType !== folderMimeType) {
        throw new VaultError('NetworkFailed', `Renamed entry is not a folder: ${name}`);
      }
      return toVaultFolder(renamed, entry.parentId, parentPath);
    }

    if (!renamed.name.toLocaleLowerCase().endsWith('.md')) {
      throw new VaultError('NetworkFailed', `Renamed file is not markdown: ${name}`);
    }
    return toVaultFile(renamed, entry.parentId, parentPath);
  }

  async deleteEntry(vaultRootId: string, entry: VaultEntry): Promise<void> {
    await this.drive.trashFile(entry.id);
    if (entry.kind === 'markdown') {
      await this.drafts.deleteDraft(vaultRootId, entry.id);
    }
  }

  private async assertNameAvailable(parentFolderId: string, name: string, ignoredEntryId?: string) {
    const children = [
      ...(await this.listFolders(parentFolderId)),
      ...(await this.listMarkdownFiles(parentFolderId))
    ];
    if (children.some((child) =>
      child.id !== ignoredEntryId &&
      child.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )) {
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

  private async toRootDescendantEntry(
    rootFolderId: string,
    file: GoogleDriveFile,
    signal?: AbortSignal
  ): Promise<VaultEntry | null> {
    const parentId = file.parents?.[0] ?? null;
    if (!parentId) {
      return null;
    }

    const ancestors = await this.collectAncestors(rootFolderId, parentId, signal);
    if (!ancestors) {
      return null;
    }

    const parentPath = ancestors.map((ancestor) => ancestor.name).join('/');
    return isFolder(file)
      ? toVaultFolder(file, parentId, parentPath)
      : toVaultFile(file, parentId, parentPath);
  }

  private collectAncestors(
    rootFolderId: string,
    parentId: string,
    signal?: AbortSignal
  ): Promise<GoogleDriveFile[] | null> {
    if (parentId === rootFolderId) {
      return Promise.resolve([]);
    }

    const cacheKey = `${rootFolderId}:${parentId}`;
    const cached = this.ancestorRequests.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = this.resolveAncestors(rootFolderId, parentId, signal).catch((error) => {
      this.ancestorRequests.delete(cacheKey);
      throw error;
    });
    this.ancestorRequests.set(cacheKey, request);
    return request;
  }

  private async resolveAncestors(
    rootFolderId: string,
    parentId: string,
    signal?: AbortSignal
  ): Promise<GoogleDriveFile[] | null> {
    const ancestors: GoogleDriveFile[] = [];
    let currentId: string | undefined = parentId;

    while (currentId && currentId !== rootFolderId) {
      const parent = await this.getCachedMetadata(currentId, signal);
      ancestors.unshift(parent);
      currentId = parent.parents?.[0];
    }

    return currentId === rootFolderId ? ancestors : null;
  }

  private getCachedMetadata(fileId: string, signal?: AbortSignal) {
    const cached = this.metadataRequests.get(fileId);
    if (cached) {
      return cached;
    }

    const request = this.drive.getMetadata(fileId, signal).catch((error) => {
      this.metadataRequests.delete(fileId);
      throw error;
    });
    this.metadataRequests.set(fileId, request);
    return request;
  }
}

function isFolder(file: GoogleDriveFile) {
  return file.mimeType === folderMimeType;
}

function isMarkdownFile(file: GoogleDriveFile) {
  return file.name.toLocaleLowerCase().endsWith('.md');
}

function toVaultFolder(file: GoogleDriveFile, parentId: string, parentPath: string): VaultFolder {
  return {
    id: file.id,
    name: file.name,
    path: entryPath(parentPath, file.name),
    parentId,
    kind: 'folder',
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime
  };
}

function toVaultFile(file: GoogleDriveFile, parentId: string, parentPath: string): VaultFile {
  return {
    id: file.id,
    name: file.name,
    title: file.name.replace(/\.md$/i, ''),
    path: entryPath(parentPath, file.name),
    parentId,
    kind: 'markdown',
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime
  };
}

function entryPath(parentPath: string, name: string) {
  return parentPath ? `${parentPath}/${name}` : name;
}

function parentPathForEntry(entry: VaultEntry) {
  const separatorIndex = entry.path.lastIndexOf('/');
  return separatorIndex === -1 ? '' : entry.path.slice(0, separatorIndex);
}

function compareEntries(left: VaultEntry, right: VaultEntry) {
  if (left.kind !== right.kind) {
    return left.kind === 'folder' ? -1 : 1;
  }
  return left.path.localeCompare(right.path, undefined, { sensitivity: 'base' });
}
