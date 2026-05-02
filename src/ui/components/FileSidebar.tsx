import type { VaultFile } from '../../domain/vault/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

interface FileSidebarProps {
  rootName: string;
  files: VaultFile[];
  query: string;
  activeFileId?: string;
  onQueryChange(query: string): void;
  onOpen(file: VaultFile): void;
  onCreateFile(): void;
  onCreateFolder(): void;
  onOpenSettings(): void;
}

export function FileSidebar({
  rootName,
  files,
  query,
  activeFileId,
  onQueryChange,
  onOpen,
  onCreateFile,
  onCreateFolder,
  onOpenSettings
}: FileSidebarProps) {
  const { t } = useI18n();
  const tree = buildFileTree(files);

  return (
    <aside className="sidebar" aria-label={t('sidebar.aria')}>
      <div className="sidebar-vault">
        <Icon name="folder" />
        <span>{rootName}</span>
      </div>
      <div className="sidebar-tools">
        <label className="sidebar-search">
          <Icon name="search" />
          <input
            aria-label={t('sidebar.searchAria')}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder={t('sidebar.searchPlaceholder')}
          />
        </label>
        <div className="sidebar-actions">
          <button aria-label={t('sidebar.createFile')} title={t('sidebar.createFile')} type="button" onClick={onCreateFile}>
            <Icon name="plus" />
          </button>
          <button aria-label={t('sidebar.createFolder')} title={t('sidebar.createFolder')} type="button" onClick={onCreateFolder}>
            <Icon name="folder-plus" />
          </button>
        </div>
      </div>
      <div className="sidebar-tree">
        {tree.rootFiles.map((file) => (
          <SidebarFileButton activeFileId={activeFileId} file={file} key={file.id} onOpen={onOpen} />
        ))}
        {tree.folders.map((folder) => (
          <div className="sidebar-folder" key={folder.path}>
            <div className="sidebar-folder-row">
              <Icon name="chevron-down" />
              <Icon name="folder" />
              <span>{folder.path}</span>
            </div>
            {folder.files.map((file) => (
              <SidebarFileButton activeFileId={activeFileId} file={file} key={file.id} nested onOpen={onOpen} />
            ))}
          </div>
        ))}
      </div>
      {files.length === 0 ? <p className="sidebar-empty">{t('sidebar.empty')}</p> : null}
      <div className="sidebar-settings">
        <button
          className="settings-toggle"
          type="button"
          onClick={onOpenSettings}
        >
          <Icon name="settings" />
          {t('settings.label')}
        </button>
      </div>
    </aside>
  );
}

interface SidebarFileButtonProps {
  activeFileId?: string;
  file: VaultFile;
  nested?: boolean;
  onOpen(file: VaultFile): void;
}

function SidebarFileButton({ activeFileId, file, nested = false, onOpen }: SidebarFileButtonProps) {
  return (
    <button
      className={file.id === activeFileId ? 'sidebar-item active' : 'sidebar-item'}
      data-nested={nested}
      type="button"
      onClick={() => onOpen(file)}
    >
      <Icon name="file-text" />
      <span>{file.title}</span>
      <small>{file.path}</small>
    </button>
  );
}

interface FileTree {
  rootFiles: VaultFile[];
  folders: Array<{
    path: string;
    files: VaultFile[];
  }>;
}

function buildFileTree(files: VaultFile[]): FileTree {
  const folders = new Map<string, VaultFile[]>();
  const rootFiles: VaultFile[] = [];

  for (const file of files) {
    const pathParts = file.path.split('/');
    if (pathParts.length === 1) {
      rootFiles.push(file);
      continue;
    }

    const folderPath = pathParts.slice(0, -1).join('/');
    folders.set(folderPath, [...(folders.get(folderPath) ?? []), file]);
  }

  return {
    rootFiles,
    folders: Array.from(folders.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, folderFiles]) => ({
        path,
        files: folderFiles.sort((left, right) => left.path.localeCompare(right.path))
      }))
  };
}
