import { useState } from 'react';

import { loadDriveWorkspace, type DriveWorkspace } from './app/driveWorkspaceLoader';
import { ChromeIdentityAuthClient } from './integrations/google/googleAuth';
import { HttpGoogleDriveClient } from './integrations/google/httpGoogleDriveClient';
import { BrowserGooglePickerClient } from './integrations/google/googlePicker';
import { IndexedDbDraftStore } from './storage/draftStore';
import { fixtureFiles, fixtureVaultRoot } from './test/fixtures';
import { Workspace } from './ui/Workspace';

export default function App() {
  const [workspace, setWorkspace] = useState<DriveWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connectDrive() {
    const developerKey = import.meta.env.VITE_GOOGLE_PICKER_DEVELOPER_KEY;
    const appId = import.meta.env.VITE_GOOGLE_PICKER_APP_ID;

    if (!developerKey || !appId) {
      setError('Google Picker 설정값이 없습니다. .env.local을 확인하세요.');
      return;
    }

    try {
      const nextWorkspace = await loadDriveWorkspace({
        auth: new ChromeIdentityAuthClient(),
        picker: new BrowserGooglePickerClient(developerKey, appId),
        createDriveClient: (accessToken) => new HttpGoogleDriveClient(accessToken),
        drafts: new IndexedDbDraftStore()
      });
      setWorkspace(nextWorkspace);
      setError(null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Drive 연결 실패');
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
      })
    });
  }

  if (!workspace) {
    return (
      <main className="app-shell">
        <h1>Drive Obsidian Editor</h1>
        <p>Google Drive 폴더를 vault로 연결해 Markdown 파일을 편집합니다.</p>
        <div className="app-actions">
          <button type="button" onClick={() => void connectDrive()}>
            Google Drive vault 연결
          </button>
          <button type="button" onClick={openMockWorkspace}>
            Mock vault 열기
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
    />
  );
}
