export interface PickedFolder {
  id: string;
  name: string;
}

export interface GooglePickerClient {
  pickVaultFolder(accessToken: string): Promise<PickedFolder>;
}

interface GooglePickerMessages {
  title: string;
  rootName: string;
  back: string;
  close: string;
  selectCurrent: string;
  selectFolder: string;
  openFolder: string;
  loading: string;
  empty: string;
  cancelledMessage: string;
  loadFailedMessage: string;
}

interface DriveFolderListResponse {
  files: PickedFolder[];
  nextPageToken?: string;
}

const driveBaseUrl = 'https://www.googleapis.com/drive/v3/files';
const folderMimeType = 'application/vnd.google-apps.folder';

const defaultMessages: GooglePickerMessages = {
  title: 'Google Drive 폴더 선택',
  rootName: '내 드라이브',
  back: '뒤로',
  close: '닫기',
  selectCurrent: '현재 폴더 선택',
  selectFolder: '선택',
  openFolder: '열기',
  loading: '폴더를 불러오는 중',
  empty: '이 위치에 폴더가 없습니다.',
  cancelledMessage: '폴더 선택이 취소되었습니다.',
  loadFailedMessage: 'Drive 폴더를 불러오지 못했습니다.'
};

export class BrowserGooglePickerClient implements GooglePickerClient {
  constructor(private readonly messages: GooglePickerMessages = defaultMessages) {}

  pickVaultFolder(accessToken: string): Promise<PickedFolder> {
    return new DriveFolderExplorer(accessToken, this.messages).open();
  }
}

class DriveFolderExplorer {
  private readonly overlay = document.createElement('div');
  private readonly path: PickedFolder[];
  private folders: PickedFolder[] = [];
  private loading = false;
  private error: string | null = null;
  private closed = false;
  private resolveSelection: ((folder: PickedFolder) => void) | null = null;
  private rejectSelection: ((error: Error) => void) | null = null;

  constructor(
    private readonly accessToken: string,
    private readonly messages: GooglePickerMessages
  ) {
    this.path = [{ id: 'root', name: messages.rootName }];
  }

  open(): Promise<PickedFolder> {
    return new Promise((resolve, reject) => {
      this.resolveSelection = resolve;
      this.rejectSelection = reject;
      this.overlay.className = 'drive-picker-overlay';
      document.body.append(this.overlay);
      window.addEventListener('keydown', this.closeOnEscape);
      this.render();
      void this.loadCurrentFolders();
    });
  }

  private readonly closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.cancel();
    }
  };

  private currentFolder(): PickedFolder {
    return this.path[this.path.length - 1];
  }

  private async loadCurrentFolders() {
    this.loading = true;
    this.error = null;
    this.render();

    try {
      this.folders = await listDriveFolders(this.accessToken, this.currentFolder().id);
    } catch {
      this.folders = [];
      this.error = this.messages.loadFailedMessage;
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private openFolder(folder: PickedFolder) {
    this.path.push(folder);
    void this.loadCurrentFolders();
  }

  private goBack() {
    if (this.path.length === 1) {
      return;
    }

    this.path.pop();
    void this.loadCurrentFolders();
  }

  private selectFolder(folder: PickedFolder) {
    this.close();
    this.resolveSelection?.(folder);
  }

  private cancel() {
    this.close();
    this.rejectSelection?.(new Error(this.messages.cancelledMessage));
  }

  private close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    window.removeEventListener('keydown', this.closeOnEscape);
    this.overlay.remove();
  }

  private render() {
    if (this.closed) {
      return;
    }

    this.overlay.replaceChildren(this.createDialog());
  }

  private createDialog() {
    const titleId = 'drive-picker-title';
    const dialog = createElement('section', 'drive-picker-dialog');
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('role', 'dialog');

    const header = createElement('header', 'drive-picker-header');
    const heading = document.createElement('h2');
    heading.id = titleId;
    heading.textContent = this.messages.title;
    const closeButton = createButton('drive-picker-close', this.messages.close, () => this.cancel());
    closeButton.setAttribute('aria-label', this.messages.close);
    closeButton.textContent = '×';
    header.append(heading, closeButton);

    const toolbar = createElement('div', 'drive-picker-toolbar');
    const backButton = createButton('drive-picker-back', this.messages.back, () => this.goBack());
    backButton.disabled = this.path.length === 1 || this.loading;
    const currentPath = createElement('span', 'drive-picker-path');
    currentPath.textContent = this.path.map((folder) => folder.name).join(' / ');
    const selectCurrentButton = createButton('drive-picker-select-current', this.messages.selectCurrent, () =>
      this.selectFolder(this.currentFolder())
    );
    selectCurrentButton.disabled = this.loading;
    toolbar.append(backButton, currentPath, selectCurrentButton);

    const body = createElement('div', 'drive-picker-body');
    if (this.loading) {
      const loading = createElement('p', 'drive-picker-status');
      loading.textContent = this.messages.loading;
      body.append(loading);
    } else if (this.error) {
      const error = createElement('p', 'drive-picker-error');
      error.setAttribute('role', 'alert');
      error.textContent = this.error;
      body.append(error);
    } else if (this.folders.length === 0) {
      const empty = createElement('p', 'drive-picker-status');
      empty.textContent = this.messages.empty;
      body.append(empty);
    } else {
      const list = createElement('ul', 'drive-picker-list');
      for (const folder of this.folders) {
        list.append(this.createFolderRow(folder));
      }
      body.append(list);
    }

    dialog.append(header, toolbar, body);
    return dialog;
  }

  private createFolderRow(folder: PickedFolder) {
    const item = document.createElement('li');
    item.className = 'drive-picker-row';

    const openButton = createButton('drive-picker-folder', folder.name, () => this.openFolder(folder));
    openButton.setAttribute('aria-label', `${folder.name} ${this.messages.openFolder}`);

    const selectButton = createButton('drive-picker-select', this.messages.selectFolder, () =>
      this.selectFolder(folder)
    );
    selectButton.setAttribute('aria-label', `${folder.name} ${this.messages.selectFolder}`);

    item.append(openButton, selectButton);
    return item;
  }
}

async function listDriveFolders(accessToken: string, parentId: string): Promise<PickedFolder[]> {
  const folders: PickedFolder[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${escapeDriveQueryValue(parentId)}' in parents and mimeType = '${folderMimeType}' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      orderBy: 'name',
      pageSize: '100'
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`${driveBaseUrl}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      throw new Error(`Drive folder list failed: ${response.status}`);
    }

    const page = (await response.json()) as DriveFolderListResponse;
    folders.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return folders;
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, className: string) {
  const element = document.createElement(tagName);
  element.className = className;
  return element;
}

function createButton(className: string, label: string, onClick: () => void) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}
