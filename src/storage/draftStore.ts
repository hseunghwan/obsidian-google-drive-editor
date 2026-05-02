export interface DraftRecord {
  vaultRootId: string;
  fileId: string;
  content: string;
  baselineModifiedTime: string;
  savedAt: string;
  reason: string;
}

export interface DraftStore {
  saveDraft(draft: DraftRecord): Promise<void>;
  getDraft(vaultRootId: string, fileId: string): Promise<DraftRecord | null>;
  deleteDraft(vaultRootId: string, fileId: string): Promise<void>;
}

const storeName = 'drafts';

export class IndexedDbDraftStore implements DraftStore {
  constructor(private readonly databaseName = 'drive-obsidian-editor') {}

  async saveDraft(draft: DraftRecord): Promise<void> {
    const db = await this.open();
    await requestToPromise(
      transactionStore(db, 'readwrite').put(draft, draftKey(draft.vaultRootId, draft.fileId))
    );
    db.close();
  }

  async getDraft(vaultRootId: string, fileId: string): Promise<DraftRecord | null> {
    const db = await this.open();
    const draft = await requestToPromise<DraftRecord | undefined>(
      transactionStore(db, 'readonly').get(draftKey(vaultRootId, fileId))
    );
    db.close();
    return draft ?? null;
  }

  async deleteDraft(vaultRootId: string, fileId: string): Promise<void> {
    const db = await this.open();
    await requestToPromise(transactionStore(db, 'readwrite').delete(draftKey(vaultRootId, fileId)));
    db.close();
  }

  private open(): Promise<IDBDatabase> {
    const request = indexedDB.open(this.databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    return requestToPromise(request);
  }
}

function draftKey(vaultRootId: string, fileId: string) {
  return `${vaultRootId}:${fileId}`;
}

function transactionStore(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
