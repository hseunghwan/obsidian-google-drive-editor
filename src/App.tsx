import { useCallback, useEffect, useMemo, useState } from 'react';

import { parseDriveUiState, type DriveUiRequest } from './app/driveUiState';
import { openDriveUiWorkspace, type DriveUiWorkspace } from './app/driveUiWorkspace';
import { loadDriveWorkspace, type DriveWorkspace } from './app/driveWorkspaceLoader';
import { hasCompletedReviewRequest, markReviewRequestCompleted } from './app/reviewRequestStore';
import { clearStoredVaultRoot, readStoredVaultRoot, writeStoredVaultRoot } from './app/vaultConnectionStore';
import type { VaultRoot } from './domain/vault/types';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { createDriveAuthClient } from './integrations/google/gisAuth';
import { ChromeIdentityAuthClient } from './integrations/google/googleAuth';
import { HttpGoogleDriveClient } from './integrations/google/httpGoogleDriveClient';
import { BrowserGooglePickerClient } from './integrations/google/googlePicker';
import { IndexedDbDraftStore } from './storage/draftStore';
import { fixtureFiles, fixtureFolder, fixtureVaultRoot } from './test/fixtures';
import { ThemeProvider } from './theme/ThemeProvider';
import { Workspace } from './ui/Workspace';

export default function App() {
  const driveUiRequest = useMemo(
    () => (typeof window === 'undefined' ? null : parseDriveUiState(window.location.search)),
    []
  );

  return (
    <I18nProvider>
      <ThemeProvider>
        {driveUiRequest ? <DriveUiContent request={driveUiRequest} /> : <AppContent />}
      </ThemeProvider>
    </I18nProvider>
  );
}

/**
 * Google Drive의 "연결 앱으로 열기" / "새로 만들기"로 진입한 화면.
 * 넘겨받은 파일 하나만 다루므로 vault 탐색 없이 편집기를 바로 띄운다.
 */
function DriveUiContent({ request }: { request: DriveUiRequest }) {
  const { t } = useI18n();
  const [opened, setOpened] = useState<DriveUiWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAuthorization, setNeedsAuthorization] = useState(false);
  const [loading, setLoading] = useState(true);

  const openRequest = useCallback(
    async (interactive: boolean) => {
      setLoading(true);
      setError(null);
      const auth = createDriveAuthClient(t('errors.chromeIdentityUnavailable'));

      try {
        // 승인이 없으면 팝업이 필요하고, 팝업은 사용자 클릭 안에서만 열 수 있다
        await auth.getAccessToken(interactive);
      } catch (authError) {
        setNeedsAuthorization(true);
        setError(interactive ? errorMessage(authError, t('driveUi.openFailed')) : null);
        setLoading(false);
        return;
      }

      try {
        setOpened(
          await openDriveUiWorkspace({
            auth,
            createDriveClient: (accessToken) =>
              new HttpGoogleDriveClient(accessToken, {
                refreshAccessToken: (staleToken) => auth.refreshAccessToken(staleToken)
              }),
            drafts: new IndexedDbDraftStore(),
            request,
            rootName: t('driveUi.rootName'),
            newFileName: t('driveUi.newFileName'),
            interactive: false
          })
        );
        setNeedsAuthorization(false);
      } catch (openError) {
        setError(errorMessage(openError, t('driveUi.openFailed')));
      } finally {
        setLoading(false);
      }
    },
    [request, t]
  );

  useEffect(() => {
    void openRequest(false);
  }, [openRequest]);

  if (opened) {
    const { workspace, initialFile } = opened;
    return (
      <Workspace
        root={workspace.root}
        entries={workspace.entries}
        initialFile={initialFile}
        loadFolders={workspace.loadFolders}
        loadMarkdownFiles={workspace.loadMarkdownFiles}
        searchEntries={workspace.searchEntries}
        loadFile={workspace.loadFile}
        prefetchFile={workspace.prefetchFile}
        readFileContent={workspace.readFileContent}
        loadGraphSettings={workspace.loadGraphSettings}
        getRemoteModifiedTime={workspace.getRemoteModifiedTime}
        moveEntry={workspace.moveEntry}
        listRevisions={workspace.listRevisions}
        getRevisionContent={workspace.getRevisionContent}
        saveDocument={workspace.saveDocument}
        createFile={workspace.createFile}
        createFolder={workspace.createFolder}
        renameEntry={workspace.renameEntry}
        deleteEntry={workspace.deleteEntry}
      />
    );
  }

  return (
    <main className="app-shell">
      <h1>{t('app.title')}</h1>
      <p>{needsAuthorization ? t('driveUi.authorizeHelp') : t('driveUi.opening')}</p>
      {needsAuthorization ? (
        <div className="app-actions">
          <button type="button" disabled={loading} onClick={() => void openRequest(true)}>
            {t('driveUi.authorize')}
          </button>
        </div>
      ) : null}
      {loading ? <p aria-live="polite">{t('driveUi.opening')}</p> : null}
      {error ? (
        <>
          <p role="alert">{error}</p>
          <div className="app-actions">
            <button type="button" disabled={loading} onClick={() => void openRequest(true)}>
              {t('driveUi.retry')}
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function AppContent() {
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<DriveWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [showReviewRequestToast, setShowReviewRequestToast] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreDriveConnection() {
      const storedRoot = await readStoredVaultRoot();
      if (!storedRoot) {
        return;
      }

      setConnecting(true);
      try {
        const nextWorkspace = await openDriveWorkspace(storedRoot);
        if (!cancelled) {
          setWorkspace(nextWorkspace);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setWorkspace(null);
        }
      } finally {
        if (!cancelled) {
          setConnecting(false);
        }
      }
    }

    void restoreDriveConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreReviewRequestState() {
      const completed = await hasCompletedReviewRequest();
      if (!cancelled) {
        setShowReviewRequestToast(!completed);
      }
    }

    void restoreReviewRequestState();

    return () => {
      cancelled = true;
    };
  }, []);

  async function openDriveWorkspace(savedRoot?: VaultRoot) {
    const auth = new ChromeIdentityAuthClient(t('errors.chromeIdentityUnavailable'));
    const nextWorkspace = await loadDriveWorkspace({
      auth,
      picker: new BrowserGooglePickerClient({
        title: t('picker.title'),
        rootName: t('picker.rootName'),
        back: t('picker.back'),
        close: t('picker.close'),
        selectCurrent: t('picker.selectCurrent'),
        selectFolder: t('picker.selectFolder'),
        openFolder: t('picker.openFolder'),
        loading: t('picker.loading'),
        empty: t('picker.empty'),
        cancelledMessage: t('picker.cancelled'),
        loadFailedMessage: t('picker.loadFailed')
      }),
      createDriveClient: (accessToken) =>
        new HttpGoogleDriveClient(accessToken, {
          refreshAccessToken: (staleToken) => auth.refreshAccessToken(staleToken)
        }),
      drafts: new IndexedDbDraftStore(),
      savedRoot
    });
    await writeStoredVaultRoot(nextWorkspace.root);
    return nextWorkspace;
  }

  async function connectDrive() {
    setConnecting(true);
    setError(null);
    try {
      const nextWorkspace = await openDriveWorkspace();
      setWorkspace(nextWorkspace);
      setError(null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : t('errors.driveConnectFailed'));
    } finally {
      setConnecting(false);
    }
  }

  async function switchGoogleAccount() {
    setConnecting(true);
    setError(null);
    try {
      await new ChromeIdentityAuthClient(t('errors.chromeIdentityUnavailable')).clearCachedAccessToken();
      await clearStoredVaultRoot();
      setWorkspace(null);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : t('errors.driveConnectFailed'));
    } finally {
      setConnecting(false);
    }
  }

  async function changeRootFolder() {
    setConnecting(true);
    setError(null);
    try {
      const nextWorkspace = await openDriveWorkspace();
      setWorkspace(nextWorkspace);
      setError(null);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : t('errors.driveConnectFailed'));
    } finally {
      setConnecting(false);
    }
  }

  function openMockWorkspace() {
    setWorkspace({
      root: fixtureVaultRoot,
      entries: [fixtureFolder, ...fixtureFiles],
      loadFolders: async () => [],
      loadMarkdownFiles: async () => [],
      searchEntries: async () => [],
      loadFile: async (file) => ({
        file,
        content: `---
title: Home
---
# Home #daily

See [[Project Note]].`,
        baselineModifiedTime: file.modifiedTime
      }),
      readFileContent: async () => '',
      loadGraphSettings: async () => null,
      prefetchFile: () => undefined,
      getRemoteModifiedTime: async () => '1970-01-01T00:00:00.000Z',
      listRevisions: async () => [],
      getRevisionContent: async () => '',
      saveDocument: async (document) => ({
        fileId: document.file.id,
        modifiedTime: new Date().toISOString()
      }),
      createFile: async (parentFolderId, name, content) => ({
        id: `mock-${name}`,
        name,
        title: name.replace(/\.md$/i, ''),
        path: name,
        parentId: parentFolderId,
        kind: 'markdown',
        mimeType: 'text/markdown',
        modifiedTime: new Date().toISOString()
      }),
      createFolder: async (parentFolderId, name) => ({
        id: `mock-folder-${name}`,
        name,
        path: name,
        parentId: parentFolderId,
        kind: 'folder',
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: new Date().toISOString()
      }),
      moveEntry: async (entry, targetFolderId, targetFolderPath) => ({
        ...entry,
        parentId: targetFolderId,
        path: targetFolderPath ? `${targetFolderPath}/${entry.name}` : entry.name,
        modifiedTime: new Date().toISOString()
      }),
      renameEntry: async (entry, name) => ({
        ...entry,
        name,
        path: name,
        modifiedTime: new Date().toISOString(),
        ...(entry.kind === 'markdown' ? { title: name.replace(/\.md$/i, '') } : {})
      }),
      deleteEntry: async () => undefined
    });
  }

  function completeReviewRequest() {
    setShowReviewRequestToast(false);
    void markReviewRequestCompleted();
  }

  if (!workspace) {
    return (
      <main className="app-shell">
        <h1>{t('app.title')}</h1>
        <p>{t('app.description')}</p>
        <div className="app-actions">
          <button type="button" disabled={connecting} onClick={() => void connectDrive()}>
            {t('app.connectDrive')}
          </button>
          <button type="button" disabled={connecting} onClick={openMockWorkspace}>
            {t('app.openMockVault')}
          </button>
        </div>
        {connecting ? <p aria-live="polite">{t('app.loadingDrive')}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </main>
    );
  }

  return (
    <Workspace
      root={workspace.root}
      entries={workspace.entries}
      loadFolders={workspace.loadFolders}
      loadMarkdownFiles={workspace.loadMarkdownFiles}
      searchEntries={workspace.searchEntries}
      loadFile={workspace.loadFile}
      prefetchFile={workspace.prefetchFile}
      readFileContent={workspace.readFileContent}
      loadGraphSettings={workspace.loadGraphSettings}
      getRemoteModifiedTime={workspace.getRemoteModifiedTime}
      moveEntry={workspace.moveEntry}
      listRevisions={workspace.listRevisions}
      getRevisionContent={workspace.getRevisionContent}
      saveDocument={workspace.saveDocument}
      createFile={workspace.createFile}
      createFolder={workspace.createFolder}
      renameEntry={workspace.renameEntry}
      deleteEntry={workspace.deleteEntry}
      onChangeRootFolder={() => void changeRootFolder()}
      onSwitchGoogleAccount={() => void switchGoogleAccount()}
      showReviewRequestToast={showReviewRequestToast}
      onReviewRequestAccepted={completeReviewRequest}
    />
  );
}
