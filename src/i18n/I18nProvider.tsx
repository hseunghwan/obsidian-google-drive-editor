import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { isLocale, type Locale, type MessageKey, messages } from './messages';

const localeStorageKey = 'drive-obsidian-editor.locale';

interface I18nContextValue {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: MessageKey): string;
}

const defaultI18n: I18nContextValue = {
  locale: 'ko',
  setLocale: () => undefined,
  t: (key) => messages.ko[key]
};

const I18nContext = createContext<I18nContextValue>(defaultI18n);

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale() ?? 'ko');

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
        writeStoredLocale(nextLocale);
      },
      t: (key) => messages[locale][key]
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

function readStoredLocale(): Locale | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function') {
      return null;
    }

    const value = storage.getItem(localeStorageKey);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: Locale) {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }

    storage.setItem(localeStorageKey, locale);
  } catch {
    // Locale persistence is best-effort; UI language still changes in memory.
  }
}
