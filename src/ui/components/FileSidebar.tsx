import type { VaultFile } from '../../domain/vault/types';
import { useI18n } from '../../i18n/I18nProvider';

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
  const { t } = useI18n();

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
    </aside>
  );
}
