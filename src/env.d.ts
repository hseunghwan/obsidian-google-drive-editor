/// <reference types="vite/client" />

declare const gapi: {
  load(api: 'picker', callback: () => void): void;
};

declare namespace google.picker {
  enum ViewId {
    FOLDERS = 'FOLDERS'
  }

  enum Action {
    CANCEL = 'cancel',
    PICKED = 'picked'
  }

  interface DocumentObject {
    id: string;
    name: string;
  }

  interface ResponseObject {
    action: Action;
    docs: DocumentObject[];
  }

  class DocsView {
    constructor(viewId: ViewId);
    setIncludeFolders(includeFolders: boolean): DocsView;
    setSelectFolderEnabled(selectFolderEnabled: boolean): DocsView;
  }

  class PickerBuilder {
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    addView(view: DocsView): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }

  interface Picker {
    setVisible(visible: boolean): void;
  }
}
