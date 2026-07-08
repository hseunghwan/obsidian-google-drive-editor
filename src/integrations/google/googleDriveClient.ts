export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: string[];
}

export interface GoogleDriveListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export interface GoogleDriveClient {
  listFolders(folderId: string, pageToken?: string): Promise<GoogleDriveListResponse>;
  listMarkdownFiles(folderId: string, pageToken?: string): Promise<GoogleDriveListResponse>;
  searchByName(query: string, pageToken?: string, signal?: AbortSignal): Promise<GoogleDriveListResponse>;
  findFileInFolder(folderId: string, name: string): Promise<GoogleDriveFile | null>;
  downloadText(fileId: string): Promise<string>;
  updateText(fileId: string, content: string): Promise<GoogleDriveFile>;
  createTextFile(parentFolderId: string, name: string, content: string): Promise<GoogleDriveFile>;
  createFolder(parentFolderId: string, name: string): Promise<GoogleDriveFile>;
  renameFile(fileId: string, name: string): Promise<GoogleDriveFile>;
  moveFile(fileId: string, targetFolderId: string, currentParentId: string): Promise<GoogleDriveFile>;
  trashFile(fileId: string): Promise<void>;
  getMetadata(fileId: string, signal?: AbortSignal): Promise<GoogleDriveFile>;
  listRevisions(fileId: string): Promise<GoogleDriveRevision[]>;
  downloadRevisionText(fileId: string, revisionId: string): Promise<string>;
}

export interface GoogleDriveRevision {
  id: string;
  modifiedTime: string;
}
