import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasCompletedReviewRequest, markReviewRequestCompleted, reviewRequestStorageKey } from './reviewRequestStore';

describe('reviewRequestStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('stores review request completion in localStorage outside Chrome extension storage', async () => {
    expect(await hasCompletedReviewRequest()).toBe(false);

    await markReviewRequestCompleted('2026-05-21T00:00:00.000Z');

    expect(await hasCompletedReviewRequest()).toBe(true);
    expect(JSON.parse(localStorage.getItem(reviewRequestStorageKey) ?? '{}')).toEqual({
      completed: true,
      completedAt: '2026-05-21T00:00:00.000Z'
    });
  });

  it('uses chrome.storage.local when it is available', async () => {
    const values = new Map<string, unknown>();
    const chromeStorage = {
      get: vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
        callback({ [key]: values.get(key) });
      }),
      set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
        Object.entries(items).forEach(([key, value]) => values.set(key, value));
        callback();
      })
    };

    vi.stubGlobal('chrome', {
      storage: {
        local: chromeStorage
      }
    });

    await markReviewRequestCompleted('2026-05-21T00:00:00.000Z');

    expect(chromeStorage.set).toHaveBeenCalledWith(
      {
        [reviewRequestStorageKey]: {
          completed: true,
          completedAt: '2026-05-21T00:00:00.000Z'
        }
      },
      expect.any(Function)
    );
    expect(await hasCompletedReviewRequest()).toBe(true);
    expect(localStorage.getItem(reviewRequestStorageKey)).toBeNull();
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}
