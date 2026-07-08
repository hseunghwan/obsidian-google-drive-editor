export interface GraphLinkRecord {
  vaultRootId: string;
  fileId: string;
  modifiedTime: string;
  wikiLinks: string[];
}

export interface GraphLinkStore {
  getAll(vaultRootId: string): Promise<GraphLinkRecord[]>;
  putMany(records: GraphLinkRecord[]): Promise<void>;
}

const storeName = 'links';

export class IndexedDbGraphLinkStore implements GraphLinkStore {
  constructor(private readonly databaseName = 'drive-obsidian-graph') {}

  async getAll(vaultRootId: string): Promise<GraphLinkRecord[]> {
    const db = await this.open();
    const range = IDBKeyRange.bound(`${vaultRootId}:`, `${vaultRootId}:￿`);
    const records = await requestToPromise<GraphLinkRecord[]>(
      transactionStore(db, 'readonly').getAll(range)
    );
    db.close();
    return records;
  }

  async putMany(records: GraphLinkRecord[]): Promise<void> {
    const db = await this.open();
    const store = transactionStore(db, 'readwrite');
    await Promise.all(
      records.map((record) => requestToPromise(store.put(record, recordKey(record))))
    );
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

function recordKey(record: GraphLinkRecord) {
  return `${record.vaultRootId}:${record.fileId}`;
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
