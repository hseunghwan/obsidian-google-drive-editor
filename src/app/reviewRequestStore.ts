export const reviewRequestStorageKey = 'drive-obsidian-editor.reviewRequest';

interface ReviewRequestRecord {
  completed: boolean;
  completedAt?: string;
}

export async function hasCompletedReviewRequest(): Promise<boolean> {
  const chromeStorage = getChromeStorage();
  const stored = chromeStorage
    ? await getChromeStorageValue(chromeStorage, reviewRequestStorageKey)
    : readLocalStorageValue();

  return parseReviewRequestRecord(stored)?.completed === true;
}

export async function markReviewRequestCompleted(completedAt = new Date().toISOString()): Promise<void> {
  const record: ReviewRequestRecord = { completed: true, completedAt };
  const chromeStorage = getChromeStorage();

  if (chromeStorage) {
    await setChromeStorageValue(chromeStorage, { [reviewRequestStorageKey]: record });
    return;
  }

  writeLocalStorageValue(JSON.stringify(record));
}

function parseReviewRequestRecord(value: unknown): ReviewRequestRecord | null {
  const candidate = typeof value === 'string' ? parseJson(value) : value;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Partial<ReviewRequestRecord>;
  if (record.completed !== true) {
    return { completed: false };
  }

  return {
    completed: true,
    ...(typeof record.completedAt === 'string' ? { completedAt: record.completedAt } : {})
  };
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readLocalStorageValue() {
  try {
    return globalThis.localStorage?.getItem(reviewRequestStorageKey) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorageValue(value: string) {
  try {
    globalThis.localStorage?.setItem(reviewRequestStorageKey, value);
  } catch {
    // Review prompt persistence is best-effort; the current UI state still updates.
  }
}

function getChromeStorage(): typeof chrome.storage.local | null {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    return null;
  }

  return storage;
}

function getChromeStorageValue(storage: typeof chrome.storage.local, key: string) {
  return new Promise<unknown>((resolve) => {
    storage.get(key, (items) => resolve(items[key]));
  });
}

function setChromeStorageValue(storage: typeof chrome.storage.local, value: Record<string, unknown>) {
  return new Promise<void>((resolve) => {
    storage.set(value, () => resolve());
  });
}
