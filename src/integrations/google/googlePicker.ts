export interface PickedFolder {
  id: string;
  name: string;
}

export interface GooglePickerClient {
  pickVaultFolder(accessToken: string): Promise<PickedFolder>;
}

export class BrowserGooglePickerClient implements GooglePickerClient {
  async pickVaultFolder(_accessToken: string): Promise<PickedFolder> {
    const rawFolder = window.prompt('Google Drive 폴더 URL 또는 폴더 ID를 입력하세요.');
    const id = rawFolder ? parseDriveFolderId(rawFolder) : null;
    if (!id) {
      throw new Error('Folder selection was cancelled.');
    }

    const rawName = window.prompt('Vault 이름을 입력하세요.', 'Drive Vault');
    return {
      id,
      name: rawName?.trim() || 'Drive Vault'
    };
  }
}

export function parseDriveFolderId(input: string): string | null {
  const value = input.trim();
  const folderMatch = value.match(/\/folders\/([^/?#]+)/);
  if (folderMatch) {
    return folderMatch[1];
  }

  const idMatch = value.match(/[?&]id=([^&#]+)/);
  if (idMatch) {
    return idMatch[1];
  }

  return /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
}
