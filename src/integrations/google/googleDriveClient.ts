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
  listChildren(folderId: string, pageToken?: string): Promise<GoogleDriveListResponse>;
  downloadText(fileId: string): Promise<string>;
  updateText(fileId: string, content: string): Promise<GoogleDriveFile>;
  createTextFile(parentFolderId: string, name: string, content: string): Promise<GoogleDriveFile>;
  createFolder(parentFolderId: string, name: string): Promise<GoogleDriveFile>;
  getMetadata(fileId: string): Promise<GoogleDriveFile>;
}
