import type { ReactNode } from 'react';

import type { VaultEntry, VaultFile, VaultFolder } from '../../domain/vault/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

interface FileSidebarProps {
  rootId: string;
  rootName: string;
  entries: VaultEntry[];
  query: string;
  activeFileId?: string;
  expandedFolderIds: Set<string>;
  loadingFolderIds: Set<string>;
  onQueryChange(query: string): void;
  onOpen(file: VaultFile): void;
  onToggleFolder(folder: VaultFolder): void;
  onCreateFile(): void;
  onCreateFolder(): void;
  onOpenSettings(): void;
}

export function FileSidebar({
  rootId,
  rootName,
  entries,
  query,
  activeFileId,
  expandedFolderIds,
  loadingFolderIds,
  onQueryChange,
  onOpen,
  onToggleFolder,
  onCreateFile,
  onCreateFolder,
  onOpenSettings
}: FileSidebarProps) {
  const { t } = useI18n();
  const files = markdownEntries(entries);
  const searchActive = Boolean(query.trim());
  const fileTree = searchActive ? buildFileTree(files) : null;
  const childrenByParentId = searchActive ? new Map<string | null, VaultEntry[]>() : groupEntriesByParent(entries);

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
        {fileTree
          ? renderSearchTree(fileTree, activeFileId, onOpen)
          : renderEntryChildren({
              parentId: rootId,
              childrenByParentId,
              expandedFolderIds,
              loadingFolderIds,
              loadingMessage: t('workspace.loadingFolder'),
              activeFileId,
              onOpen,
              onToggleFolder
            })}
      </div>
      {(searchActive ? files.length === 0 : entries.length === 0) ? (
        <p className="sidebar-empty">{t('sidebar.empty')}</p>
      ) : null}
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

interface SidebarFolderButtonProps {
  folder: VaultFolder;
  expanded: boolean;
  onToggleFolder(folder: VaultFolder): void;
}

function SidebarFolderButton({ folder, expanded, onToggleFolder }: SidebarFolderButtonProps) {
  return (
    <button
      aria-expanded={expanded}
      className="sidebar-folder-row"
      type="button"
      onClick={() => onToggleFolder(folder)}
    >
      <Icon name={expanded ? 'chevron-down' : 'chevron-right'} />
      <Icon name="folder" />
      <span>{folder.name}</span>
    </button>
  );
}

interface RenderEntryChildrenOptions {
  parentId: string;
  childrenByParentId: Map<string | null, VaultEntry[]>;
  expandedFolderIds: Set<string>;
  loadingFolderIds: Set<string>;
  loadingMessage: string;
  activeFileId?: string;
  onOpen(file: VaultFile): void;
  onToggleFolder(folder: VaultFolder): void;
}

function renderEntryChildren({
  parentId,
  childrenByParentId,
  expandedFolderIds,
  loadingFolderIds,
  loadingMessage,
  activeFileId,
  onOpen,
  onToggleFolder
}: RenderEntryChildrenOptions): ReactNode {
  const children = childrenByParentId.get(parentId) ?? [];

  return children.map((entry) => {
    if (entry.kind === 'markdown') {
      return (
        <SidebarFileButton
          activeFileId={activeFileId}
          file={entry}
          key={entry.id}
          nested={entry.parentId !== parentId}
          onOpen={onOpen}
        />
      );
    }

    const expanded = expandedFolderIds.has(entry.id);
    return (
      <div className="sidebar-folder" key={entry.id}>
        <SidebarFolderButton
          expanded={expanded}
          folder={entry}
          onToggleFolder={onToggleFolder}
        />
        {loadingFolderIds.has(entry.id) ? <p className="sidebar-folder-loading">{loadingMessage}</p> : null}
        {expanded
          ? renderEntryChildren({
              parentId: entry.id,
              childrenByParentId,
              expandedFolderIds,
              loadingFolderIds,
              loadingMessage,
              activeFileId,
              onOpen,
              onToggleFolder
            })
          : null}
      </div>
    );
  });
}

function renderSearchTree(fileTree: FileTree, activeFileId: string | undefined, onOpen: (file: VaultFile) => void) {
  return (
    <>
      {fileTree.rootFiles.map((file) => (
        <SidebarFileButton activeFileId={activeFileId} file={file} key={file.id} onOpen={onOpen} />
      ))}
      {fileTree.folders.map((folder) => (
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
    </>
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

function markdownEntries(entries: VaultEntry[]): VaultFile[] {
  return entries.filter((entry): entry is VaultFile => entry.kind === 'markdown');
}

function groupEntriesByParent(entries: VaultEntry[]) {
  const childrenByParentId = new Map<string | null, VaultEntry[]>();
  for (const entry of entries) {
    const siblings = childrenByParentId.get(entry.parentId) ?? [];
    siblings.push(entry);
    childrenByParentId.set(entry.parentId, siblings);
  }

  for (const [parentId, children] of childrenByParentId) {
    childrenByParentId.set(parentId, children.sort(compareEntries));
  }

  return childrenByParentId;
}

function compareEntries(left: VaultEntry, right: VaultEntry) {
  if (left.kind !== right.kind) {
    return left.kind === 'folder' ? -1 : 1;
  }
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}
