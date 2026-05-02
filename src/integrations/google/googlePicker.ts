export interface PickedFolder {
  id: string;
  name: string;
}

export interface GooglePickerClient {
  pickVaultFolder(accessToken: string): Promise<PickedFolder>;
}

export class BrowserGooglePickerClient implements GooglePickerClient {
  constructor(
    private readonly developerKey: string,
    private readonly appId: string
  ) {}

  async pickVaultFolder(accessToken: string): Promise<PickedFolder> {
    await loadPickerApi();

    return new Promise((resolve, reject) => {
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);

      const picker = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(this.developerKey)
        .setAppId(this.appId)
        .addView(view)
        .setCallback((data: google.picker.ResponseObject) => {
          if (data.action === google.picker.Action.CANCEL) {
            reject(new Error('Folder selection was cancelled.'));
            return;
          }

          if (data.action === google.picker.Action.PICKED) {
            const document = data.docs[0];
            if (!document) {
              reject(new Error('Folder selection did not return a document.'));
              return;
            }

            resolve({ id: document.id, name: document.name });
          }
        })
        .build();

      picker.setVisible(true);
    });
  }
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve) => {
    gapi.load('picker', () => resolve());
  });
}
