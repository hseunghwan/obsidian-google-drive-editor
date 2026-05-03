import { type ComponentType, useEffect, useMemo, useReducer, useState } from 'react';

import { isVaultError } from '../domain/vault/errors';
import { VaultIndex } from '../domain/vault/vaultIndex';
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
  loadFile(file: VaultFile): Promise<OpenDocument>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
  createFile(parentFolderId: string, name: string, content: string): Promise<VaultFile>;
  createFolder(parentFolderId: string, name: string): Promise<VaultFolder>;
  autosaveDelayMs?: number;
  EditorComponent?: ComponentType<MarkdownEditorProps>;
}

export function Workspace({
  root,
  entries,
  loadFolders,
  loadMarkdownFiles,
  loadFile,
  saveDocument,
  createFile,
  createFolder,
  autosaveDelayMs = 1200,
  EditorComponent = MarkdownEditor
}: WorkspaceProps) {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(workspaceReducer, createInitialWorkspaceState());
  const [workspaceEntries, setWorkspaceEntries] = useState(entries);
  const [loadedFolderIds, setLoadedFolderIds] = useState<Set<string>>(() => new Set());
  const [loadingFolderIds, setLoadingFolderIds] = useState<Set<string>>(() => new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set([root.id]));
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => matchesMedia('(min-width: 721px)', true));
  const [metadataOpen, setMetadataOpen] = useState(() => matchesMedia('(min-width: 1081px)', true));

  useEffect(() => {
    setWorkspaceEntries(entries);
    setLoadedFolderIds(new Set());
    setLoadingFolderIds(new Set());
    setExpandedFolderIds(new Set([root.id]));
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

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return workspaceFiles;
    }
    const resultIds = new Set(index.searchFiles(normalizedQuery).map((file) => file.id));
    return workspaceFiles.filter((file) => resultIds.has(file.id));
  }, [index, query, workspaceFiles]);

  const visibleEntries = useMemo(() => {
    if (!query.trim()) {
      return workspaceEntries;
    }
    const visibleFileIds = new Set(visibleFiles.map((file) => file.id));
    return workspaceEntries.filter((entry) => entry.kind === 'markdown' && visibleFileIds.has(entry.id));
  }, [query, visibleFiles, workspaceEntries]);

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
    const expanded = expandedFolderIds.has(folder.id);
    setExpandedFolderIds((current) =>
      expanded ? removeSetValue(current, folder.id) : addSetValue(current, folder.id)
    );

    if (!expanded) {
      void loadFolderChildren(folder.id, folder.path);
    }
  }

  async function openFile(file: VaultFile) {
    const document = await loadFile(file);
    dispatch({
      type: 'documentOpened',
      root,
      files: workspaceFiles,
      document
    });
  }

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

  async function createMarkdownFile() {
    const rawName = window.prompt(t('workspace.newMarkdownFilePrompt'));
    const title = rawName?.trim();
    if (!title) {
      return;
    }

    const name = title.endsWith('.md') ? title : `${title}.md`;
    const nextFile = await createFile(root.id, name, `# ${name.replace(/\.md$/i, '')}\n`);
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

  async function createVaultFolder() {
    const rawName = window.prompt(t('workspace.newFolderPrompt'));
    const name = rawName?.trim();
    if (!name) {
      return;
    }

    const nextFolder = await createFolder(root.id, name);
    setWorkspaceEntries((current) => mergeEntries(current, [nextFolder]));
    setNotice(t('workspace.folderCreated'));
  }

  const workspaceClassNames = [
    'workspace',
    sidebarOpen ? 'has-sidebar' : '',
    activeDocument && metadataOpen ? 'has-metadata' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="workspace-shell">
      <div className={workspaceClassNames}>
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
          <button aria-label={t('settings.open')} title={t('settings.open')} type="button" onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" />
          </button>
        </nav>
        {sidebarOpen ? (
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
            onCreateFile={() => void createMarkdownFile()}
            onCreateFolder={() => void createVaultFolder()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : null}
        <main className="workspace-main">
          {activeDocument ? (
            <>
              <Breadcrumb path={activeDocument.file.path} />
              <EditorComponent
                value={activeDocument.content}
                index={index}
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
        {activeDocument && metadataOpen ? <MetadataPanel content={activeDocument.content} /> : null}
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
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
