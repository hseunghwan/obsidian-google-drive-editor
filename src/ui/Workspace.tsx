import React, { type ComponentType, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { isVaultError } from '../domain/vault/errors';
import { VaultIndex } from '../domain/vault/vaultIndex';
import type { MarkdownHeading } from '../domain/markdown/markdownMetadata';
import type { OpenDocument, SaveResult, VaultEntry, VaultFile, VaultFolder, VaultRoot } from '../domain/vault/types';
import { useI18n } from '../i18n/I18nProvider';
import { Breadcrumb } from './components/Breadcrumb';
import { FileSidebar } from './components/FileSidebar';
import { Icon } from './components/Icon';
import { MetadataPanel } from './components/MetadataPanel';
import { SaveStatus } from './components/SaveStatus';
import { SettingsDialog } from './components/SettingsDialog';
import { MarkdownEditor, type MarkdownEditorProps } from './editor/MarkdownEditor';
import { createInitialWorkspaceState, workspaceReducer } from './state/workspaceReducer';

interface WorkspaceProps {
  root: VaultRoot;
  entries: VaultEntry[];
  loadFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  loadMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  searchEntries(rootFolderId: string, query: string, signal?: AbortSignal): Promise<VaultEntry[]>;
  loadFile(file: VaultFile): Promise<OpenDocument>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
  createFile(parentFolderId: string, name: string, content: string): Promise<VaultFile>;
  createFolder(parentFolderId: string, name: string): Promise<VaultFolder>;
  renameEntry?(entry: VaultEntry, name: string): Promise<VaultEntry>;
  deleteEntry?(entry: VaultEntry): Promise<void>;
  onSwitchGoogleAccount?(): void;
  onChangeRootFolder?(): void;
  autosaveDelayMs?: number;
  searchDebounceMs?: number;
  EditorComponent?: ComponentType<MarkdownEditorProps>;
}

export function Workspace({
  root,
  entries,
  loadFolders,
  loadMarkdownFiles,
  searchEntries,
  loadFile,
  saveDocument,
  createFile,
  createFolder,
  renameEntry = renameEntryLocally,
  deleteEntry = async () => undefined,
  onSwitchGoogleAccount,
  onChangeRootFolder = () => undefined,
  autosaveDelayMs = 1200,
  searchDebounceMs = 350,
  EditorComponent = MarkdownEditor
}: WorkspaceProps) {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(workspaceReducer, createInitialWorkspaceState());
  const previousRootId = useRef(root.id);
  const [workspaceEntries, setWorkspaceEntries] = useState(entries);
  const [loadedFolderIds, setLoadedFolderIds] = useState<Set<string>>(() => new Set());
  const [loadingFolderIds, setLoadingFolderIds] = useState<Set<string>>(() => new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set([root.id]));
  const [query, setQuery] = useState('');
  const [driveSearchEntries, setDriveSearchEntries] = useState<VaultEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<MarkdownEditorProps['scrollTarget']>(null);
  const scrollRequestId = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(() => matchesMedia('(min-width: 721px)', true));
  const [metadataOpen, setMetadataOpen] = useState(() => matchesMedia('(min-width: 1081px)', true));
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredSidebarWidth());
  const sidebarDragState = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      window.localStorage?.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [sidebarWidth]);

  useEffect(() => {
    setWorkspaceEntries(entries);
    if (previousRootId.current !== root.id) {
      dispatch({ type: 'workspaceReset' });
      previousRootId.current = root.id;
    }
    setLoadedFolderIds(new Set());
    setLoadingFolderIds(new Set());
    setExpandedFolderIds(new Set([root.id]));
    setDriveSearchEntries([]);
  }, [entries, root.id]);

  useEffect(() => {
    void loadFolderChildren(root.id, '');
  }, [root.id]);

  const workspaceFiles = useMemo(() => markdownEntries(workspaceEntries), [workspaceEntries]);

  const index = useMemo(() => {
    const vaultIndex = new VaultIndex();
    vaultIndex.replaceAll(workspaceFiles);
    return vaultIndex;
  }, [workspaceFiles]);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return workspaceEntries;
    }
    const visibleFileIds = new Set(index.searchFiles(normalizedQuery).map((file) => file.id));
    const localEntries = workspaceEntries.filter((entry) => {
      if (entry.kind === 'folder') {
        return entry.name.toLocaleLowerCase().includes(normalizedQuery) ||
          entry.path.toLocaleLowerCase().includes(normalizedQuery);
      }
      return visibleFileIds.has(entry.id);
    });
    return mergeEntries(localEntries, driveSearchEntries);
  }, [driveSearchEntries, index, query, workspaceEntries]);

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return workspaceFiles;
    }
    return markdownEntries(visibleEntries);
  }, [query, visibleEntries, workspaceFiles]);

  const activeDocument = state.activeDocument;

  async function loadFolderChildren(folderId: string, folderPath: string) {
    if (loadedFolderIds.has(folderId) || loadingFolderIds.has(folderId)) {
      return;
    }

    setLoadingFolderIds((current) => addSetValue(current, folderId));

    try {
      const folders = await loadFolders(folderId, folderPath);
      setWorkspaceEntries((current) => mergeEntries(current, folders));
      const files = await loadMarkdownFiles(folderId, folderPath);
      setWorkspaceEntries((current) => mergeEntries(current, files));
      setLoadedFolderIds((current) => addSetValue(current, folderId));
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('errors.driveConnectFailed'));
    } finally {
      setLoadingFolderIds((current) => removeSetValue(current, folderId));
    }
  }

  function toggleFolder(folder: VaultFolder) {
    setWorkspaceEntries((current) => mergeEntries(current, [folder]));
    const expanded = expandedFolderIds.has(folder.id);
    setExpandedFolderIds((current) =>
      expanded ? removeSetValue(current, folder.id) : addSetValue(current, folder.id)
    );

    if (!expanded) {
      void loadFolderChildren(folder.id, folder.path);
    }
  }

  async function openFile(file: VaultFile) {
    setWorkspaceEntries((current) => mergeEntries(current, [file]));
    const document = await loadFile(file);
    dispatch({
      type: 'documentOpened',
      root,
      files: mergeEntries(workspaceFiles, [file]).filter((entry): entry is VaultFile => entry.kind === 'markdown'),
      document
    });
  }

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setDriveSearchEntries((current) => (current.length === 0 ? current : []));
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      searchEntries(root.id, normalizedQuery, abortController.signal)
        .then((entries) => {
          if (!abortController.signal.aborted) {
            setDriveSearchEntries(entries);
            setNotice(null);
          }
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            setDriveSearchEntries([]);
            setNotice(error instanceof Error ? error.message : t('errors.driveConnectFailed'));
          }
        });
    }, searchDebounceMs);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [query, root.id, searchDebounceMs, searchEntries, t]);

  async function saveDocumentWithState(document: OpenDocument) {
    dispatch({ type: 'saveStarted' });

    try {
      const result = await saveDocument(document);
      dispatch({ type: 'saveSucceeded', modifiedTime: result.modifiedTime });
    } catch (error) {
      if (isVaultError(error, 'RemoteChanged')) {
        dispatch({ type: 'remoteConflict' });
        return;
      }
      dispatch({ type: 'saveFailed' });
    }
  }

  async function saveActiveDocument() {
    if (!state.activeDocument) {
      return;
    }

    await saveDocumentWithState(state.activeDocument);
  }

  useEffect(() => {
    if (state.saveState.status !== 'dirty' || !activeDocument) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveDocumentWithState(activeDocument);
    }, autosaveDelayMs);

    return () => window.clearTimeout(timer);
  }, [activeDocument, autosaveDelayMs, state.saveState.status]);

  async function createMarkdownFile(parentFolderId = root.id) {
    const rawName = window.prompt(t('workspace.newMarkdownFilePrompt'));
    const title = rawName?.trim();
    if (!title) {
      return;
    }

    const name = normalizeMarkdownName(title);
    const parentPath = parentPathForFolderId(parentFolderId, root.id, visibleEntries);
    const nextFile = applyParentPath(
      await createFile(parentFolderId, name, `# ${name.replace(/\.md$/i, '')}\n`),
      parentFolderId,
      parentPath
    );
    const nextEntries = mergeEntries(workspaceEntries, [nextFile]);
    const nextFiles = markdownEntries(nextEntries);
    setWorkspaceEntries(nextEntries);
    setNotice(null);
    dispatch({
      type: 'documentOpened',
      root,
      files: nextFiles,
      document: {
        file: nextFile,
        content: `# ${nextFile.title}\n`,
        baselineModifiedTime: nextFile.modifiedTime
      }
    });
  }

  async function createVaultFolderIn(parentFolderId: string) {
    const rawName = window.prompt(t('workspace.newFolderPrompt'));
    const name = rawName?.trim();
    if (!name) {
      return;
    }

    const parentPath = parentPathForFolderId(parentFolderId, root.id, visibleEntries);
    const nextFolder = applyParentPath(
      await createFolder(parentFolderId, name),
      parentFolderId,
      parentPath
    );
    setWorkspaceEntries((current) => mergeEntries(current, [nextFolder]));
    setNotice(t('workspace.folderCreated'));
  }

  async function renameVaultEntry(entry: VaultEntry) {
    const rawName = window.prompt(t('workspace.renamePrompt'), entry.name);
    const trimmedName = rawName?.trim();
    if (!trimmedName) {
      return;
    }

    const nextName = entry.kind === 'markdown' ? normalizeMarkdownName(trimmedName) : trimmedName;
    const renamedEntry = applyParentPath(
      await renameEntry(entry, nextName),
      entry.parentId ?? root.id,
      parentPathForEntry(entry)
    );
    setWorkspaceEntries((current) => replaceRenamedEntry(current, entry, renamedEntry));
    setDriveSearchEntries((current) => replaceRenamedEntry(current, entry, renamedEntry));
    dispatch({ type: 'entryRenamed', previous: entry, entry: renamedEntry });
    setNotice(null);
  }

  async function deleteVaultEntry(entry: VaultEntry) {
    if (!window.confirm(t('workspace.deleteConfirm'))) {
      return;
    }

    await deleteEntry(entry);
    setWorkspaceEntries((current) => removeEntryTree(current, entry));
    setDriveSearchEntries((current) => removeEntryTree(current, entry));
    dispatch({ type: 'entryDeleted', entry });
    setNotice(null);
  }

  function scrollToHeading(heading: MarkdownHeading) {
    scrollRequestId.current += 1;
    setScrollTarget({ lineNumber: heading.lineNumber, requestId: scrollRequestId.current });
  }

  const workspaceClassNames = [
    'workspace',
    sidebarOpen ? 'has-sidebar' : '',
    activeDocument && metadataOpen ? 'has-metadata' : ''
  ]
    .filter(Boolean)
    .join(' ');

  function handleSidebarResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    sidebarDragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth
    };
  }

  function handleSidebarResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = sidebarDragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const next = drag.startWidth + (event.clientX - drag.startX);
    setSidebarWidth(clampSidebarWidth(next));
  }

  function handleSidebarResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = sidebarDragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    sidebarDragState.current = null;
  }

  function handleSidebarResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 32 : 8;
    const delta = event.key === 'ArrowRight' ? step : -step;
    setSidebarWidth((current) => clampSidebarWidth(current + delta));
  }

  const workspaceStyle = { '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties;

  return (
    <div className="workspace-shell">
      <div className={workspaceClassNames} style={workspaceStyle}>
        <nav className="activity-rail" aria-label="Workspace panels">
          <button
            aria-pressed={sidebarOpen}
            aria-label={t('workspace.toggleSidebar')}
            className={sidebarOpen ? 'active' : ''}
            title={t('workspace.toggleSidebar')}
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <Icon name="panel-left" />
          </button>
          <button
            aria-pressed={Boolean(activeDocument && metadataOpen)}
            aria-label={t('workspace.toggleMetadata')}
            className={activeDocument && metadataOpen ? 'active' : ''}
            disabled={!activeDocument}
            title={t('workspace.toggleMetadata')}
            type="button"
            onClick={() => setMetadataOpen((open) => !open)}
          >
            <Icon name="panel-right" />
          </button>
        </nav>
        {sidebarOpen ? (
          <>
            <FileSidebar
              rootId={root.id}
              rootName={root.name}
              entries={visibleEntries}
              query={query}
              activeFileId={activeDocument?.file.id}
              expandedFolderIds={expandedFolderIds}
              loadingFolderIds={loadingFolderIds}
              onQueryChange={setQuery}
              onOpen={(file) => void openFile(file)}
              onToggleFolder={toggleFolder}
              onCreateFile={(parentFolderId) => void createMarkdownFile(parentFolderId)}
              onCreateFolder={(parentFolderId) => void createVaultFolderIn(parentFolderId)}
              onRename={(entry) => void renameVaultEntry(entry)}
              onDelete={(entry) => void deleteVaultEntry(entry)}
              onChangeRootFolder={onChangeRootFolder}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <div
              aria-label={t('workspace.resizeSidebar')}
              aria-orientation="vertical"
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              aria-valuenow={sidebarWidth}
              className="workspace-resize-handle"
              role="separator"
              tabIndex={0}
              onKeyDown={handleSidebarResizeKeyDown}
              onPointerDown={handleSidebarResizeStart}
              onPointerMove={handleSidebarResizeMove}
              onPointerUp={handleSidebarResizeEnd}
              onPointerCancel={handleSidebarResizeEnd}
            />
          </>
        ) : null}
        <main className="workspace-main">
          {activeDocument ? (
            <>
              <Breadcrumb path={activeDocument.file.path} />
              <EditorComponent
                value={activeDocument.content}
                index={index}
                scrollTarget={scrollTarget}
                onChange={(content) => dispatch({ type: 'documentEdited', content })}
              />
              <SaveStatus
                status={state.saveState.status}
                onSave={() => void saveActiveDocument()}
              />
            </>
          ) : workspaceFiles.length === 0 ? (
            <div className="empty-vault">
              <p>{loadingFolderIds.has(root.id) ? t('workspace.loadingFolder') : t('workspace.emptyVault')}</p>
              <button type="button" onClick={() => void createMarkdownFile()}>
                {t('workspace.createFile')}
              </button>
            </div>
          ) : (
            <button className="open-first-file" type="button" onClick={() => void openFile(visibleFiles[0] ?? workspaceFiles[0])}>
              {t('workspace.openFirstFile')}
            </button>
          )}
          {notice ? <p className="workspace-notice">{notice}</p> : null}
        </main>
        {activeDocument && metadataOpen ? (
          <MetadataPanel content={activeDocument.content} onSelectHeading={scrollToHeading} />
        ) : null}
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onSwitchGoogleAccount={onSwitchGoogleAccount} />
    </div>
  );
}

const SIDEBAR_WIDTH_STORAGE_KEY = 'workspace:sidebar-width';
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 520;

function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value)) {
    return SIDEBAR_DEFAULT_WIDTH;
  }
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.round(value)));
}

function readStoredSidebarWidth() {
  try {
    const stored = window.localStorage?.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!stored) {
      return SIDEBAR_DEFAULT_WIDTH;
    }
    const parsed = Number.parseInt(stored, 10);
    return clampSidebarWidth(parsed);
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function matchesMedia(query: string, fallback: boolean) {
  if (typeof window.matchMedia !== 'function') {
    return fallback;
  }

  return window.matchMedia(query).matches;
}

function markdownEntries(entries: VaultEntry[]): VaultFile[] {
  return entries.filter((entry): entry is VaultFile => entry.kind === 'markdown');
}

function mergeEntries(current: VaultEntry[], next: VaultEntry[]) {
  const entriesById = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of next) {
    entriesById.set(entry.id, entry);
  }
  return [...entriesById.values()].sort(compareEntries);
}

function compareEntries(left: VaultEntry, right: VaultEntry) {
  if (left.kind !== right.kind) {
    return left.kind === 'folder' ? -1 : 1;
  }
  return left.path.localeCompare(right.path, undefined, { sensitivity: 'base' });
}

function addSetValue<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  next.add(value);
  return next;
}

function removeSetValue<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  next.delete(value);
  return next;
}

function normalizeMarkdownName(name: string) {
  return name.endsWith('.md') ? name : `${name}.md`;
}

function parentPathForFolderId(parentFolderId: string, rootId: string, entries: VaultEntry[]) {
  if (parentFolderId === rootId) {
    return '';
  }

  const parentFolder = entries.find((entry): entry is VaultFolder =>
    entry.kind === 'folder' && entry.id === parentFolderId
  );
  return parentFolder?.path ?? '';
}

function parentPathForEntry(entry: VaultEntry) {
  const separatorIndex = entry.path.lastIndexOf('/');
  return separatorIndex === -1 ? '' : entry.path.slice(0, separatorIndex);
}

function applyParentPath<T extends VaultEntry>(entry: T, parentId: string, parentPath: string): T {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  return {
    ...entry,
    parentId,
    path,
    ...(entry.kind === 'markdown' ? { title: entry.name.replace(/\.md$/i, '') } : {})
  };
}

async function renameEntryLocally(entry: VaultEntry, name: string): Promise<VaultEntry> {
  return {
    ...entry,
    name,
    modifiedTime: new Date().toISOString(),
    ...(entry.kind === 'markdown' ? { title: name.replace(/\.md$/i, '') } : {})
  };
}

function replaceRenamedEntry(current: VaultEntry[], previousEntry: VaultEntry, nextEntry: VaultEntry) {
  const previousChildPathPrefix = previousEntry.kind === 'folder' ? `${previousEntry.path}/` : null;
  const nextChildPathPrefix = nextEntry.kind === 'folder' ? `${nextEntry.path}/` : null;
  let foundEntry = false;

  const renamedEntries = current.map((entry) => {
    if (entry.id === previousEntry.id) {
      foundEntry = true;
      return nextEntry;
    }

    if (previousChildPathPrefix && nextChildPathPrefix && entry.path.startsWith(previousChildPathPrefix)) {
      return {
        ...entry,
        path: `${nextChildPathPrefix}${entry.path.slice(previousChildPathPrefix.length)}`
      };
    }

    return entry;
  });

  return (foundEntry ? renamedEntries : [...renamedEntries, nextEntry]).sort(compareEntries);
}

function removeEntryTree(current: VaultEntry[], entryToDelete: VaultEntry) {
  const childPathPrefix = entryToDelete.kind === 'folder' ? `${entryToDelete.path}/` : null;
  return current.filter((entry) =>
    entry.id !== entryToDelete.id &&
    !(childPathPrefix && entry.path.startsWith(childPathPrefix))
  );
}
