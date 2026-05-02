import { useState } from 'react';

import { loadDriveWorkspace, type DriveWorkspace } from './app/driveWorkspaceLoader';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { ChromeIdentityAuthClient } from './integrations/google/googleAuth';
import { HttpGoogleDriveClient } from './integrations/google/httpGoogleDriveClient';
import { BrowserGooglePickerClient } from './integrations/google/googlePicker';
import { IndexedDbDraftStore } from './storage/draftStore';
import { fixtureFiles, fixtureVaultRoot } from './test/fixtures';
import { Workspace } from './ui/Workspace';

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent() {
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<DriveWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connectDrive() {
    try {
      const nextWorkspace = await loadDriveWorkspace({
        auth: new ChromeIdentityAuthClient(t('errors.chromeIdentityUnavailable')),
        picker: new BrowserGooglePickerClient({
          folderPrompt: t('picker.folderPrompt'),
          vaultNamePrompt: t('picker.vaultNamePrompt'),
          defaultVaultName: t('picker.defaultVaultName'),
          cancelledMessage: t('picker.cancelled')
        }),
        createDriveClient: (accessToken) => new HttpGoogleDriveClient(accessToken),
        drafts: new IndexedDbDraftStore()
      });
      setWorkspace(nextWorkspace);
      setError(null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : t('errors.driveConnectFailed'));
    }
  }

  function openMockWorkspace() {
    setWorkspace({
      root: fixtureVaultRoot,
      files: fixtureFiles,
      loadFile: async (file) => ({
        file,
        content: `---
title: Home
---
# Home #daily

See [[Project Note]].`,
        baselineModifiedTime: file.modifiedTime
      }),
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
      })
    });
  }

  if (!workspace) {
    return (
      <main className="app-shell">
        <h1>{t('app.title')}</h1>
        <p>{t('app.description')}</p>
        <div className="app-actions">
          <button type="button" onClick={() => void connectDrive()}>
            {t('app.connectDrive')}
          </button>
          <button type="button" onClick={openMockWorkspace}>
            {t('app.openMockVault')}
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </main>
    );
  }

  return (
    <Workspace
      root={workspace.root}
      files={workspace.files}
      loadFile={workspace.loadFile}
      saveDocument={workspace.saveDocument}
      createFile={workspace.createFile}
      createFolder={workspace.createFolder}
    />
  );
}
