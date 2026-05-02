import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const themeStorageKey = 'drive-obsidian-editor.theme';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme(theme: ThemeMode): void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => undefined
});

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme() ?? 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStoredTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

function readStoredTheme(): ThemeMode | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function') {
      return null;
    }

    const value = storage.getItem(themeStorageKey);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: ThemeMode) {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }

    storage.setItem(themeStorageKey, theme);
  } catch {
    // Theme persistence is best-effort; the active document theme still updates.
  }
}
