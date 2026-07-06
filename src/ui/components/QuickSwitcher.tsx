import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../i18n/I18nProvider';

export interface QuickSwitcherItem {
  id: string;
  title: string;
  path: string;
}

interface QuickSwitcherProps<T extends QuickSwitcherItem> {
  open: boolean;
  files: T[];
  recentFiles: T[];
  onSelect(file: T): void;
  onClose(): void;
  label?: string;
}

const resultLimit = 50;

export function rankQuickSwitcherFiles<T extends QuickSwitcherItem>(
  files: T[],
  recentFiles: T[],
  query: string
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const recentIds = recentFiles.map((file) => file.id);
  const matches = files.filter((file) => {
    if (!normalizedQuery) {
      return true;
    }
    const haystack = `${file.title} ${file.path}`.toLocaleLowerCase();
    return normalizedQuery.split(/\s+/).every((token) => haystack.includes(token));
  });

  return matches
    .sort((left, right) => {
      const leftRecency = recentIds.lastIndexOf(left.id);
      const rightRecency = recentIds.lastIndexOf(right.id);
      if (leftRecency !== rightRecency) {
        return rightRecency - leftRecency;
      }
      return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
    })
    .slice(0, resultLimit);
}

export function QuickSwitcher<T extends QuickSwitcherItem>({
  open,
  files,
  recentFiles,
  onSelect,
  onClose,
  label
}: QuickSwitcherProps<T>) {
  const { t } = useI18n();
  const dialogLabel = label ?? t('quickSwitcher.title');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(
    () => rankQuickSwitcherFiles(files, recentFiles, query),
    [files, query, recentFiles]
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const file = results[activeIndex];
      if (file) {
        onSelect(file);
      }
    }
  }

  return (
    <div className="settings-overlay quick-switcher-overlay" onMouseDown={onClose}>
      <section
        aria-label={dialogLabel}
        aria-modal="true"
        className="quick-switcher"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          aria-label={dialogLabel}
          placeholder={t('quickSwitcher.placeholder')}
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <ul className="quick-switcher-results" role="listbox">
          {results.length === 0 ? (
            <li className="quick-switcher-empty">{t('quickSwitcher.empty')}</li>
          ) : (
            results.map((file, index) => (
              <li
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'active' : ''}
                key={file.id}
                role="option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(file);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="quick-switcher-title">{file.title}</span>
                <span className="quick-switcher-path">{file.path}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
