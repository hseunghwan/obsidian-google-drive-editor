import type { VaultRoot } from '../domain/vault/types';

export const vaultConnectionStorageKey = 'drive-obsidian-editor.vaultRoot';

export async function readStoredVaultRoot(): Promise<VaultRoot | null> {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    const stored = await getChromeStorageValue(chromeStorage, vaultConnectionStorageKey);
    return parseVaultRoot(stored);
  }

  return parseVaultRoot(readLocalStorageValue());
}

export async function writeStoredVaultRoot(root: VaultRoot): Promise<void> {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    await setChromeStorageValue(chromeStorage, { [vaultConnectionStorageKey]: root });
    return;
  }

  writeLocalStorageValue(JSON.stringify(root));
}

export async function clearStoredVaultRoot(): Promise<void> {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    await removeChromeStorageValue(chromeStorage, vaultConnectionStorageKey);
    return;
  }

  removeLocalStorageValue();
}

function parseVaultRoot(value: unknown): VaultRoot | null {
  const candidate = typeof value === 'string' ? parseJson(value) : value;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const root = candidate as Partial<VaultRoot>;
  if (typeof root.id !== 'string' || typeof root.name !== 'string') {
    return null;
  }

  return { id: root.id, name: root.name };
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
    return globalThis.localStorage?.getItem(vaultConnectionStorageKey) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorageValue(value: string) {
  try {
    globalThis.localStorage?.setItem(vaultConnectionStorageKey, value);
  } catch {
    // Vault persistence is best-effort; the current session still opens normally.
  }
}

function removeLocalStorageValue() {
  try {
    globalThis.localStorage?.removeItem(vaultConnectionStorageKey);
  } catch {
    // Clearing persistence is best-effort when storage is unavailable.
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

function removeChromeStorageValue(storage: typeof chrome.storage.local, key: string) {
  return new Promise<void>((resolve) => {
    storage.remove(key, () => resolve());
  });
}
