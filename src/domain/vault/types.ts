export type VaultItemKind = 'folder' | 'markdown';

export interface VaultItem {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  kind: VaultItemKind;
  mimeType: string;
  modifiedTime: string;
}

export interface VaultFile extends VaultItem {
  kind: 'markdown';
  title: string;
}

export interface VaultFolder extends VaultItem {
  kind: 'folder';
}

export type VaultEntry = VaultFile | VaultFolder;

export interface VaultRoot {
  id: string;
  name: string;
}

export interface OpenDocument {
  file: VaultFile;
  content: string;
  baselineModifiedTime: string;
}

export interface SaveResult {
  fileId: string;
  modifiedTime: string;
}
