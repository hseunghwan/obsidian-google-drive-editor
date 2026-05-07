import type { ChangeEvent, ReactNode } from 'react';

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
  onCreateFile(parentFolderId: string): void;
  onCreateFolder(parentFolderId: string): void;
  onRename(entry: VaultEntry): void;
  onDelete(entry: VaultEntry): void;
  onChangeRootFolder(): void;
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
  onRename,
  onDelete,
  onChangeRootFolder,
  onOpenSettings
}: FileSidebarProps) {
  const { t } = useI18n();
  const searchActive = Boolean(query.trim());
  const searchTree = searchActive ? buildSearchTree(entries) : null;
  const childrenByParentId = searchActive ? new Map<string | null, VaultEntry[]>() : groupEntriesByParent(entries);

  function selectRootFolder(value: string) {
    if (value === changeRootFolderValue) {
      onChangeRootFolder();
    }
  }

  return (
    <aside className="sidebar" aria-label={t('sidebar.aria')}>
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
          <button aria-label={t('sidebar.createFile')} title={t('sidebar.createFile')} type="button" onClick={() => onCreateFile(rootId)}>
            <Icon name="plus" />
          </button>
          <button aria-label={t('sidebar.createFolder')} title={t('sidebar.createFolder')} type="button" onClick={() => onCreateFolder(rootId)}>
            <Icon name="folder-plus" />
          </button>
        </div>
      </div>
      <div className="sidebar-tree">
        {searchTree
          ? renderSearchTree(searchTree, activeFileId, onOpen, onToggleFolder, onCreateFile, onCreateFolder, onRename, onDelete)
          : renderEntryChildren({
            parentId: rootId,
            depth: 0,
            childrenByParentId,
            expandedFolderIds,
            loadingFolderIds,
            loadingMessage: t('workspace.loadingFolder'),
            activeFileId,
            onOpen,
            onToggleFolder,
            onCreateFile,
            onCreateFolder,
            onRename,
            onDelete
          })}
      </div>
      {entries.length === 0 ? (
        <p className="sidebar-empty">{t('sidebar.empty')}</p>
      ) : null}
      <div className="sidebar-footer">
        <select
          aria-label={t('sidebar.rootFolderSelect')}
          className="sidebar-vault-summary"
          title={rootName}
          value={rootId}
          onChange={(event) => selectRootFolder(event.currentTarget.value)}
        >
          <option value={rootId}>{rootName}</option>
          <option value={changeRootFolderValue}>{t('sidebar.changeRootFolder')}</option>
        </select>
        <div className="sidebar-footer-actions">
          <span className="sidebar-footer-icon" aria-hidden="true">
            <Icon name="circle-help" />
          </span>
          <button
            aria-label={t('settings.open')}
            className="sidebar-footer-icon-button"
            title={t('settings.open')}
            type="button"
            onClick={onOpenSettings}
          >
            <Icon name="settings" />
          </button>
        </div>
      </div>
    </aside>
  );
}

const changeRootFolderValue = '__change-root-folder__';

interface SidebarFileButtonProps {
  activeFileId?: string;
  depth: number;
  file: VaultFile;
  onOpen(file: VaultFile): void;
  onRename(entry: VaultEntry): void;
  onDelete(entry: VaultEntry): void;
}

function SidebarFileButton({ activeFileId, depth, file, onOpen, onRename, onDelete }: SidebarFileButtonProps) {
  return (
    <div className="sidebar-tree-row">
      <button
        className={file.id === activeFileId ? 'sidebar-item active' : 'sidebar-item'}
        data-depth={depth}
        type="button"
        onClick={() => onOpen(file)}
      >
        <Icon name="file-text" />
        <span>{file.title}</span>
      </button>
      <SidebarItemMenu entry={file} label={file.title} onRename={onRename} onDelete={onDelete} />
    </div>
  );
}

interface SidebarFolderButtonProps {
  depth: number;
  folder: VaultFolder;
  expanded: boolean;
  onToggleFolder(folder: VaultFolder): void;
  onCreateFile(parentFolderId: string): void;
  onCreateFolder(parentFolderId: string): void;
  onRename(entry: VaultEntry): void;
  onDelete(entry: VaultEntry): void;
}

function SidebarFolderButton({
  depth,
  folder,
  expanded,
  onToggleFolder,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete
}: SidebarFolderButtonProps) {
  return (
    <div className="sidebar-tree-row">
      <button
        aria-expanded={expanded}
        className="sidebar-folder-row"
        data-depth={depth}
        type="button"
        onClick={() => onToggleFolder(folder)}
      >
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} />
        <Icon name="folder" />
        <span>{folder.name}</span>
      </button>
      <SidebarItemMenu
        entry={folder}
        label={folder.name}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  );
}

interface SidebarItemMenuProps {
  entry: VaultEntry;
  label: string;
  onCreateFile?(parentFolderId: string): void;
  onCreateFolder?(parentFolderId: string): void;
  onRename(entry: VaultEntry): void;
  onDelete(entry: VaultEntry): void;
}

type SidebarMenuAction = '' | 'create-file' | 'create-folder' | 'rename' | 'delete';

function SidebarItemMenu({
  entry,
  label,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete
}: SidebarItemMenuProps) {
  const { t } = useI18n();
  const menuLabel = `${label} ${t('sidebar.more')}`;

  function handleMenuChange(event: ChangeEvent<HTMLSelectElement>) {
    const action = event.currentTarget.value as SidebarMenuAction;
    event.currentTarget.value = '';

    if (entry.kind === 'folder' && action === 'create-file') {
      onCreateFile?.(entry.id);
      return;
    }

    if (entry.kind === 'folder' && action === 'create-folder') {
      onCreateFolder?.(entry.id);
      return;
    }

    if (action === 'rename') {
      onRename(entry);
      return;
    }

    if (action === 'delete') {
      onDelete(entry);
    }
  }

  return (
    <select aria-label={menuLabel} className="sidebar-item-menu" defaultValue="" title={menuLabel} onChange={handleMenuChange}>
      <option value="">···</option>
      {entry.kind === 'folder' ? (
        <>
          <option value="create-file">{t('sidebar.menu.newNote')}</option>
          <option value="create-folder">{t('sidebar.menu.newFolder')}</option>
        </>
      ) : null}
      <option value="rename">{t('sidebar.menu.rename')}</option>
      <option value="delete">{t('sidebar.menu.delete')}</option>
    </select>
  );
}

interface RenderEntryChildrenOptions {
  parentId: string;
  depth: number;
  childrenByParentId: Map<string | null, VaultEntry[]>;
  expandedFolderIds: Set<string>;
  loadingFolderIds: Set<string>;
  loadingMessage: string;
  activeFileId?: string;
  onOpen(file: VaultFile): void;
  onToggleFolder(folder: VaultFolder): void;
  onCreateFile(parentFolderId: string): void;
  onCreateFolder(parentFolderId: string): void;
  onRename(entry: VaultEntry): void;
  onDelete(entry: VaultEntry): void;
}

function renderEntryChildren({
  parentId,
  depth,
  childrenByParentId,
  expandedFolderIds,
  loadingFolderIds,
  loadingMessage,
  activeFileId,
  onOpen,
  onToggleFolder,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete
}: RenderEntryChildrenOptions): ReactNode {
  const children = childrenByParentId.get(parentId) ?? [];

  return children.map((entry) => {
    if (entry.kind === 'markdown') {
      return (
        <SidebarFileButton
          activeFileId={activeFileId}
          depth={depth}
          file={entry}
          key={entry.id}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
        />
      );
    }

    const expanded = expandedFolderIds.has(entry.id);
    const loading = loadingFolderIds.has(entry.id);
    return (
      <div className="sidebar-folder" key={entry.id}>
        <SidebarFolderButton
          depth={depth}
          expanded={expanded}
          folder={entry}
          onToggleFolder={onToggleFolder}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onDelete={onDelete}
        />
        {loading || expanded ? (
          <div className="sidebar-folder-children" data-depth={depth + 1}>
            {loading ? <p className="sidebar-folder-loading">{loadingMessage}</p> : null}
            {expanded
              ? renderEntryChildren({
                parentId: entry.id,
                depth: depth + 1,
                childrenByParentId,
                expandedFolderIds,
                loadingFolderIds,
                loadingMessage,
                activeFileId,
                onOpen,
                onToggleFolder,
                onCreateFile,
                onCreateFolder,
                onRename,
                onDelete
              })
              : null}
          </div>
        ) : null}
      </div>
    );
  });
}

function renderSearchTree(
  fileTree: FileTree,
  activeFileId: string | undefined,
  onOpen: (file: VaultFile) => void,
  onToggleFolder: (folder: VaultFolder) => void,
  onCreateFile: (parentFolderId: string) => void,
  onCreateFolder: (parentFolderId: string) => void,
  onRename: (entry: VaultEntry) => void,
  onDelete: (entry: VaultEntry) => void
) {
  return (
    <>
      {fileTree.folders.map((folder) => (
        <div className="sidebar-folder" key={folder.id}>
          <SidebarFolderButton
            depth={0}
            expanded={true}
            folder={folder}
            onToggleFolder={onToggleFolder}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onRename={onRename}
            onDelete={onDelete}
          />
        </div>
      ))}
      {fileTree.rootFiles.map((file) => (
        <SidebarFileButton
          activeFileId={activeFileId}
          depth={0}
          file={file}
          key={file.id}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
      {fileTree.fileGroups.map((folder) => (
        <div className="sidebar-folder" key={folder.path}>
          <div className="sidebar-folder-row" data-depth={0}>
            <Icon name="chevron-down" />
            <Icon name="folder" />
            <span>{folder.path}</span>
          </div>
          <div className="sidebar-folder-children" data-depth={1}>
            {folder.files.map((file) => (
              <SidebarFileButton
                activeFileId={activeFileId}
                depth={1}
                file={file}
                key={file.id}
                onOpen={onOpen}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

interface FileTree {
  folders: VaultFolder[];
  rootFiles: VaultFile[];
  fileGroups: Array<{
    path: string;
    files: VaultFile[];
  }>;
}

function buildSearchTree(entries: VaultEntry[]): FileTree {
  const fileGroups = new Map<string, VaultFile[]>();
  const rootFiles: VaultFile[] = [];
  const folders = entries
    .filter((entry): entry is VaultFolder => entry.kind === 'folder')
    .sort((left, right) => left.path.localeCompare(right.path));

  for (const file of markdownEntries(entries)) {
    const pathParts = file.path.split('/');
    if (pathParts.length === 1) {
      rootFiles.push(file);
      continue;
    }

    const folderPath = pathParts.slice(0, -1).join('/');
    fileGroups.set(folderPath, [...(fileGroups.get(folderPath) ?? []), file]);
  }

  return {
    folders,
    rootFiles,
    fileGroups: Array.from(fileGroups.entries())
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
