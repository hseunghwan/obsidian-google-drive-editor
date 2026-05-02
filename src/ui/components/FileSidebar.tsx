import { useState } from 'react';

import type { VaultFile } from '../../domain/vault/types';
import { useI18n } from '../../i18n/I18nProvider';
import type { Locale } from '../../i18n/messages';

interface FileSidebarProps {
  files: VaultFile[];
  query: string;
  activeFileId?: string;
  onQueryChange(query: string): void;
  onOpen(file: VaultFile): void;
  onCreateFile(): void;
  onCreateFolder(): void;
}

export function FileSidebar({
  files,
  query,
  activeFileId,
  onQueryChange,
  onOpen,
  onCreateFile,
  onCreateFolder
}: FileSidebarProps) {
  const { locale, setLocale, t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="sidebar" aria-label={t('sidebar.aria')}>
      <div className="sidebar-tools">
        <input
          aria-label={t('sidebar.searchAria')}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder={t('sidebar.searchPlaceholder')}
        />
        <div className="sidebar-actions">
          <button type="button" onClick={onCreateFile}>
            {t('sidebar.createFile')}
          </button>
          <button type="button" onClick={onCreateFolder}>
            {t('sidebar.createFolder')}
          </button>
        </div>
      </div>
      {files.map((file) => (
        <button
          className={file.id === activeFileId ? 'sidebar-item active' : 'sidebar-item'}
          key={file.id}
          type="button"
          onClick={() => onOpen(file)}
        >
          <span>{file.title}</span>
          <small>{file.path}</small>
        </button>
      ))}
      {files.length === 0 ? <p className="sidebar-empty">{t('sidebar.empty')}</p> : null}
      <div className="sidebar-settings">
        <button
          aria-expanded={settingsOpen}
          className="settings-toggle"
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          {t('settings.label')}
        </button>
        {settingsOpen ? (
          <div className="settings-menu">
            <label className="settings-field">
              <span>{t('settings.language')}</span>
              <select value={locale} onChange={(event) => setLocale(event.currentTarget.value as Locale)}>
                <option value="ko">{t('language.ko')}</option>
                <option value="en">{t('language.en')}</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
