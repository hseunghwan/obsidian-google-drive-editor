export interface PickedFolder {
  id: string;
  name: string;
}

export interface GooglePickerClient {
  pickVaultFolder(accessToken: string): Promise<PickedFolder>;
}

interface GooglePickerPrompts {
  folderPrompt: string;
  vaultNamePrompt: string;
  defaultVaultName: string;
  cancelledMessage: string;
}

const defaultPrompts: GooglePickerPrompts = {
  folderPrompt: 'Google Drive 폴더 URL 또는 폴더 ID를 입력하세요.',
  vaultNamePrompt: 'Vault 이름을 입력하세요.',
  defaultVaultName: 'Drive Vault',
  cancelledMessage: 'Folder selection was cancelled.'
};

export class BrowserGooglePickerClient implements GooglePickerClient {
  constructor(private readonly prompts: GooglePickerPrompts = defaultPrompts) {}

  async pickVaultFolder(_accessToken: string): Promise<PickedFolder> {
    const rawFolder = window.prompt(this.prompts.folderPrompt);
    const id = rawFolder ? parseDriveFolderId(rawFolder) : null;
    if (!id) {
      throw new Error(this.prompts.cancelledMessage);
    }

    const rawName = window.prompt(this.prompts.vaultNamePrompt, this.prompts.defaultVaultName);
    return {
      id,
      name: rawName?.trim() || this.prompts.defaultVaultName
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
