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
import { QuickSwitcher } from './components/QuickSwitcher';
import { ReviewRequestToast } from './components/ReviewRequestToast';
import { SaveStatus } from './components/SaveStatus';
import { SettingsDialog } from './components/SettingsDialog';
import { MarkdownEditor, type EditorMode, type MarkdownEditorProps } from './editor/MarkdownEditor';
import { applyTemplateVariables, formatDailyNoteTitle } from './editor/templates';
import { createInitialWorkspaceState, workspaceReducer } from './state/workspaceReducer';

interface WorkspaceProps {
  root: VaultRoot;
  entries: VaultEntry[];
  loadFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  loadMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  searchEntries(rootFolderId: string, query: string, signal?: AbortSignal): Promise<VaultEntry[]>;
  loadFile(file: VaultFile): Promise<OpenDocument>;
  prefetchFile?(file: VaultFile): void;
  getRemoteModifiedTime?(fileId: string): Promise<string>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
  createFile(parentFolderId: string, name: string, content: string): Promise<VaultFile>;
  createFolder(parentFolderId: string, name: string): Promise<VaultFolder>;
  renameEntry?(entry: VaultEntry, name: string): Promise<VaultEntry>;
  moveEntry?(entry: VaultEntry, targetFolderId: string, targetFolderPath: string): Promise<VaultEntry>;
  deleteEntry?(entry: VaultEntry): Promise<void>;
  onSwitchGoogleAccount?(): void;
  onChangeRootFolder?(): void;
  autosaveDelayMs?: number;
  searchDebounceMs?: number;
  remotePollIntervalMs?: number;
  showReviewRequestToast?: boolean;
  reviewRequestUrl?: string;
  onReviewRequestAccepted?(): void;
  EditorComponent?: ComponentType<MarkdownEditorProps>;
}

export function Workspace({
  root,
  entries,
  loadFolders,
  loadMarkdownFiles,
  searchEntries,
  loadFile,
  prefetchFile,
  getRemoteModifiedTime,
  saveDocument,
  createFile,
  createFolder,
  renameEntry = renameEntryLocally,
  moveEntry,
  deleteEntry = async () => undefined,
  onSwitchGoogleAccount,
  onChangeRootFolder = () => undefined,
  autosaveDelayMs = 1200,
  searchDebounceMs = 350,
  remotePollIntervalMs = 30000,
  showReviewRequestToast = true,
  reviewRequestUrl = CHROME_WEB_STORE_REVIEW_URL,
  onReviewRequestAccepted,
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
  const [recentFiles, setRecentFiles] = useState<VaultFile[]>(() => readStoredRecentFiles(root.id));
  const [reviewRequestDismissed, setReviewRequestDismissed] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>(() => readStoredEditorMode());
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<VaultEntry | null>(null);
  const [insertRequest, setInsertRequest] = useState<MarkdownEditorProps['insertRequest']>(null);
  const insertRequestId = useRef(0);

  useEffect(() => {
    try {
      window.localStorage?.setItem(EDITOR_MODE_STORAGE_KEY, editorMode);
    } catch {
      // ignore storage failures
    }
  }, [editorMode]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveActiveDocument();
        return;
      }
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        setQuickSwitcherOpen(true);
        return;
      }
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setEditorMode((mode) => (mode === 'source' ? 'live' : 'source'));
        return;
      }
      if (mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSidebarOpen(true);
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('.sidebar-search input')?.focus();
        });
        return;
      }
      if (mod && !event.shiftKey && !event.altKey && event.key === '[') {
        event.preventDefault();
        void navigateHistory('back');
        return;
      }
      if (mod && !event.shiftKey && !event.altKey && event.key === ']') {
        event.preventDefault();
        void navigateHistory('forward');
        return;
      }
      if (event.altKey && !mod && event.code === 'KeyN') {
        event.preventDefault();
        void createMarkdownFile();
        return;
      }
      if (event.altKey && !mod && event.code === 'KeyT') {
        event.preventDefault();
        openTemplatePicker();
        return;
      }
      if (event.altKey && !mod && event.code === 'KeyD') {
        event.preventDefault();
        void openDailyNote();
        return;
      }
      if (event.altKey && !mod && /^Digit[1-9]$/.test(event.code)) {
        const digit = Number(event.code.slice(5));
        const file = digit === 9 ? recentFiles[recentFiles.length - 1] : recentFiles[digit - 1];
        if (file) {
          event.preventDefault();
          void openFile(file);
        }
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  useEffect(() => {
    try {
      window.localStorage?.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [sidebarWidth]);

  useEffect(() => {
    writeStoredRecentFiles(root.id, recentFiles);
  }, [recentFiles, root.id]);

  useEffect(() => {
    setWorkspaceEntries(entries);
    if (previousRootId.current !== root.id) {
      dispatch({ type: 'workspaceReset' });
      setRecentFiles(readStoredRecentFiles(root.id));
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

  const restoredRootRef = useRef<string | null>(null);

  useEffect(() => {
    if (restoredRootRef.current === root.id) {
      return;
    }
    restoredRootRef.current = root.id;
    if (state.activeDocument) {
      return;
    }
    const storedFile = readStoredLastFile(root.id);
    if (storedFile) {
      openFile(storedFile).catch(() => {
        try {
          window.localStorage?.removeItem(lastFileStorageKey(root.id));
        } catch {
          // ignore storage failures
        }
      });
    }
  }, [root.id]);

  useEffect(() => {
    try {
      if (state.activeDocument) {
        window.localStorage?.setItem(lastFileStorageKey(root.id), JSON.stringify(state.activeDocument.file));
      } else {
        window.localStorage?.removeItem(lastFileStorageKey(root.id));
      }
    } catch {
      // ignore storage failures
    }
  }, [state.activeDocument, root.id]);

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

  const backStackRef = useRef<VaultFile[]>([]);
  const forwardStackRef = useRef<VaultFile[]>([]);
  const historyNavigationRef = useRef(false);

  async function openFile(file: VaultFile) {
    const previousFile = state.activeDocument?.file;
    if (!historyNavigationRef.current && previousFile && previousFile.id !== file.id) {
      backStackRef.current.push(previousFile);
      forwardStackRef.current = [];
    }
    setWorkspaceEntries((current) => mergeEntries(current, [file]));
    const document = await loadFile(file);
    setRecentFiles((current) => pushRecentFile(current, document.file));
    dispatch({
      type: 'documentOpened',
      root,
      files: mergeEntries(workspaceFiles, [file]).filter((entry): entry is VaultFile => entry.kind === 'markdown'),
      document
    });
  }

  async function closeRecentFile(fileId: string) {
    const isClosingActive = activeDocument?.file.id === fileId;
    if (isClosingActive && state.saveState.status === 'dirty' && activeDocument) {
      await saveDocumentWithState(activeDocument);
    }

    const closedIndex = recentFiles.findIndex((entry) => entry.id === fileId);
    const next = recentFiles.filter((entry) => entry.id !== fileId);
    setRecentFiles(next);

    if (!isClosingActive) {
      return;
    }

    if (next.length === 0) {
      dispatch({ type: 'documentClosed' });
      return;
    }

    const adjacent = next[Math.min(closedIndex, next.length - 1)];
    await openFile(adjacent);
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
    if (!getRemoteModifiedTime || !activeDocument || state.saveState.status === 'conflict') {
      return;
    }

    const fileId = activeDocument.file.id;
    const baseline = activeDocument.baselineModifiedTime;
    const timer = window.setInterval(() => {
      getRemoteModifiedTime(fileId)
        .then((remoteModifiedTime) => {
          if (remoteModifiedTime > baseline) {
            dispatch({ type: 'remoteConflict' });
          }
        })
        .catch(() => {
          // 폴링 실패는 조용히 무시 — 저장 시점의 충돌 감지가 최종 안전망
        });
    }, remotePollIntervalMs);

    return () => window.clearInterval(timer);
  }, [activeDocument, getRemoteModifiedTime, remotePollIntervalMs, state.saveState.status]);

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

    await createMarkdownFileNamed(parentFolderId, title);
  }

  async function createMarkdownFileNamed(parentFolderId: string, title: string, content?: string) {
    const name = normalizeMarkdownName(title);
    const fileContent = content ?? `# ${name.replace(/\.md$/i, '')}\n`;
    const parentPath = parentPathForFolderId(parentFolderId, root.id, visibleEntries);
    const nextFile = applyParentPath(
      await createFile(parentFolderId, name, fileContent),
      parentFolderId,
      parentPath
    );
    const nextEntries = mergeEntries(workspaceEntries, [nextFile]);
    const nextFiles = markdownEntries(nextEntries);
    setWorkspaceEntries(nextEntries);
    setRecentFiles((current) => pushRecentFile(current, nextFile));
    setNotice(null);
    dispatch({
      type: 'documentOpened',
      root,
      files: nextFiles,
      document: {
        file: nextFile,
        content: fileContent,
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
    setRecentFiles((current) => syncRecentFilesAfterRename(current, entry, renamedEntry));
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
    setRecentFiles((current) => syncRecentFilesAfterDelete(current, entry));
    dispatch({ type: 'entryDeleted', entry });
    setNotice(null);
  }

  function scrollToHeading(heading: MarkdownHeading) {
    scrollRequestId.current += 1;
    setScrollTarget({ lineNumber: heading.lineNumber, requestId: scrollRequestId.current });
  }

  const templateFiles = useMemo(
    () => workspaceFiles.filter((file) => /^templates\//i.test(file.path)),
    [workspaceFiles]
  );

  function openTemplatePicker() {
    if (!activeDocument) {
      return;
    }
    const templatesFolder = workspaceEntries.find(
      (entry): entry is VaultFolder => entry.kind === 'folder' && entry.path.toLocaleLowerCase() === 'templates'
    );
    if (templatesFolder) {
      void loadFolderChildren(templatesFolder.id, templatesFolder.path);
    }
    setTemplatePickerOpen(true);
  }

  async function insertTemplate(file: VaultFile) {
    setTemplatePickerOpen(false);
    if (!activeDocument) {
      return;
    }
    const document = await loadFile(file);
    insertRequestId.current += 1;
    setInsertRequest({
      text: applyTemplateVariables(document.content, { title: activeDocument.file.title }),
      requestId: insertRequestId.current
    });
  }

  async function openDailyNote() {
    const title = formatDailyNoteTitle();
    const existing = workspaceFiles.find((file) => file.title === title);
    if (existing) {
      await openFile(existing);
      return;
    }
    const dailyTemplate = templateFiles.find((file) => file.title.toLocaleLowerCase() === 'daily');
    let content = `# ${title}\n`;
    if (dailyTemplate) {
      const document = await loadFile(dailyTemplate);
      content = applyTemplateVariables(document.content, { title });
    }
    await createMarkdownFileNamed(root.id, title, content);
  }

  const moveDestinations = useMemo(() => {
    if (!moveTarget) {
      return [];
    }
    const folders = workspaceEntries
      .filter((entry): entry is VaultFolder => entry.kind === 'folder')
      .filter(
        (folder) =>
          folder.id !== moveTarget.id &&
          folder.id !== moveTarget.parentId &&
          !(moveTarget.kind === 'folder' &&
            (folder.path === moveTarget.path || folder.path.startsWith(`${moveTarget.path}/`)))
      )
      .map((folder) => ({ id: folder.id, title: folder.name, path: folder.path }));
    if (moveTarget.parentId === root.id) {
      return folders;
    }
    return [{ id: root.id, title: root.name, path: '' }, ...folders];
  }, [moveTarget, root.id, root.name, workspaceEntries]);

  async function moveEntryTo(destination: { id: string; title: string; path: string }) {
    const target = moveTarget;
    setMoveTarget(null);
    if (!moveEntry || !target) {
      return;
    }
    try {
      const moved = await moveEntry(target, destination.id, destination.path);
      setWorkspaceEntries((current) => replaceRenamedEntry(current, target, moved));
      setDriveSearchEntries((current) => replaceRenamedEntry(current, target, moved));
      setRecentFiles((current) => syncRecentFilesAfterRename(current, target, moved));
      dispatch({ type: 'entryRenamed', previous: target, entry: moved });
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('errors.driveConnectFailed'));
    }
  }

  async function navigateHistory(direction: 'back' | 'forward') {
    const fromStack = direction === 'back' ? backStackRef.current : forwardStackRef.current;
    const toStack = direction === 'back' ? forwardStackRef.current : backStackRef.current;
    const nextFile = fromStack.pop();
    if (!nextFile) {
      return;
    }
    const currentFile = state.activeDocument?.file;
    if (currentFile) {
      toStack.push(currentFile);
    }
    historyNavigationRef.current = true;
    try {
      await openFile(nextFile);
    } finally {
      historyNavigationRef.current = false;
    }
  }

  function findWikiLinkFile(target: string) {
    const normalized = target.trim().toLocaleLowerCase();
    return workspaceFiles.find(
      (entry) =>
        entry.title.toLocaleLowerCase() === normalized ||
        entry.path.toLocaleLowerCase().replace(/\.md$/, '') === normalized
    );
  }

  function openWikiLink(target: string) {
    const file = findWikiLinkFile(target);
    if (file) {
      void openFile(file);
      return;
    }
    const title = target.split('/').pop()?.trim();
    if (title) {
      void createMarkdownFileNamed(root.id, title);
    }
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
              onPrefetch={prefetchFile}
              onToggleFolder={toggleFolder}
              onCreateFile={(parentFolderId) => void createMarkdownFile(parentFolderId)}
              onCreateFolder={(parentFolderId) => void createVaultFolderIn(parentFolderId)}
              onRename={(entry) => void renameVaultEntry(entry)}
              onMove={moveEntry ? (entry) => setMoveTarget(entry) : undefined}
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
          {recentFiles.length > 0 ? (
            <div className="workspace-tabs" role="tablist" aria-label={t('workspace.recentTabs')}>
              {recentFiles.map((file) => {
                const isActive = activeDocument?.file.id === file.id;
                return (
                  <div
                    key={file.id}
                    className={`workspace-tab${isActive ? ' active' : ''}`}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={0}
                    title={file.path}
                    onClick={() => void openFile(file)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void openFile(file);
                      }
                    }}
                  >
                    <span className="workspace-tab-label">{file.title}</span>
                    <button
                      type="button"
                      className="workspace-tab-close"
                      aria-label={t('workspace.closeRecentTab')}
                      title={t('workspace.closeRecentTab')}
                      onClick={(event) => {
                        event.stopPropagation();
                        void closeRecentFile(file.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          {activeDocument ? (
            <>
              <div className="editor-header">
                <Breadcrumb path={activeDocument.file.path} />
                <button
                  aria-pressed={editorMode === 'source'}
                  aria-label={t('workspace.toggleSourceMode')}
                  className={`editor-mode-toggle${editorMode === 'source' ? ' active' : ''}`}
                  title={t('workspace.toggleSourceMode')}
                  type="button"
                  onClick={() => setEditorMode((mode) => (mode === 'source' ? 'live' : 'source'))}
                >
                  <Icon name="code" />
                </button>
              </div>
              <EditorComponent
                value={activeDocument.content}
                index={index}
                scrollTarget={scrollTarget}
                mode={editorMode}
                insertRequest={insertRequest}
                onChange={(content) => dispatch({ type: 'documentEdited', content })}
                onOpenWikiLink={openWikiLink}
                resolveWikiLink={(target) => Boolean(findWikiLinkFile(target))}
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
          <div className="workspace-toasts">
            {notice ? <p className="workspace-notice">{notice}</p> : null}
            {showReviewRequestToast && !reviewRequestDismissed ? (
              <ReviewRequestToast
                reviewUrl={reviewRequestUrl}
                onDismiss={() => setReviewRequestDismissed(true)}
                onReviewLinkClick={() => {
                  setReviewRequestDismissed(true);
                  onReviewRequestAccepted?.();
                }}
              />
            ) : null}
          </div>
        </main>
        {activeDocument && metadataOpen ? (
          <MetadataPanel content={activeDocument.content} onSelectHeading={scrollToHeading} />
        ) : null}
      </div>
      <QuickSwitcher
        open={quickSwitcherOpen}
        files={workspaceFiles}
        recentFiles={recentFiles}
        onSelect={(file) => {
          setQuickSwitcherOpen(false);
          void openFile(file);
        }}
        onClose={() => setQuickSwitcherOpen(false)}
      />
      <QuickSwitcher
        open={templatePickerOpen}
        files={templateFiles}
        recentFiles={[]}
        label={t('templatePicker.title')}
        onSelect={(file) => void insertTemplate(file)}
        onClose={() => setTemplatePickerOpen(false)}
      />
      <QuickSwitcher
        open={Boolean(moveTarget)}
        files={moveDestinations}
        recentFiles={[]}
        label={t('folderPicker.title')}
        onSelect={(destination) => void moveEntryTo(destination)}
        onClose={() => setMoveTarget(null)}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onSwitchGoogleAccount={onSwitchGoogleAccount} />
    </div>
  );
}

const SIDEBAR_WIDTH_STORAGE_KEY = 'workspace:sidebar-width';
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 520;
const RECENT_FILES_STORAGE_PREFIX = 'workspace:recent-files:';
const EDITOR_MODE_STORAGE_KEY = 'workspace:editor-mode';
const LAST_FILE_STORAGE_PREFIX = 'workspace:last-file:';
const RECENT_FILES_LIMIT = 8;
export const CHROME_WEB_STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/obsidian-vault-editor-for/fegekndlnlkbnkopphbokolacfemldge/reviews?hl=en-US&utm_source=ext_sidebar';

function readStoredEditorMode(): EditorMode {
  try {
    return window.localStorage?.getItem(EDITOR_MODE_STORAGE_KEY) === 'source' ? 'source' : 'live';
  } catch {
    return 'live';
  }
}

function lastFileStorageKey(rootId: string) {
  return `${LAST_FILE_STORAGE_PREFIX}${rootId}`;
}

function readStoredLastFile(rootId: string): VaultFile | null {
  try {
    const stored = window.localStorage?.getItem(lastFileStorageKey(rootId));
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as VaultFile;
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.id === 'string' && parsed.kind === 'markdown') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function recentFilesStorageKey(rootId: string) {
  return `${RECENT_FILES_STORAGE_PREFIX}${rootId}`;
}

function readStoredRecentFiles(rootId: string): VaultFile[] {
  try {
    const stored = window.localStorage?.getItem(recentFilesStorageKey(rootId));
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry): entry is VaultFile =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as VaultFile).id === 'string' &&
        (entry as VaultFile).kind === 'markdown'
      )
      .slice(0, RECENT_FILES_LIMIT);
  } catch {
    return [];
  }
}

function writeStoredRecentFiles(rootId: string, files: VaultFile[]) {
  try {
    window.localStorage?.setItem(recentFilesStorageKey(rootId), JSON.stringify(files));
  } catch {
    // ignore storage failures
  }
}

function pushRecentFile(current: VaultFile[], file: VaultFile): VaultFile[] {
  const existingIndex = current.findIndex((entry) => entry.id === file.id);
  if (existingIndex !== -1) {
    if (current[existingIndex] === file) {
      return current;
    }
    const next = current.slice();
    next[existingIndex] = file;
    return next;
  }
  const next = [...current, file];
  if (next.length <= RECENT_FILES_LIMIT) {
    return next;
  }
  return next.slice(next.length - RECENT_FILES_LIMIT);
}

function syncRecentFilesAfterRename(
  current: VaultFile[],
  previousEntry: VaultEntry,
  nextEntry: VaultEntry
): VaultFile[] {
  if (previousEntry.kind === 'markdown' && nextEntry.kind === 'markdown') {
    return current.map((file) => (file.id === previousEntry.id ? nextEntry : file));
  }
  if (previousEntry.kind !== 'folder' || nextEntry.kind !== 'folder') {
    return current;
  }
  const previousPrefix = `${previousEntry.path}/`;
  return current.map((file) =>
    file.path.startsWith(previousPrefix)
      ? { ...file, path: `${nextEntry.path}/${file.path.slice(previousPrefix.length)}` }
      : file
  );
}

function syncRecentFilesAfterDelete(current: VaultFile[], deletedEntry: VaultEntry): VaultFile[] {
  if (deletedEntry.kind === 'markdown') {
    return current.filter((file) => file.id !== deletedEntry.id);
  }
  const childPrefix = `${deletedEntry.path}/`;
  return current.filter((file) => !file.path.startsWith(childPrefix));
}

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
