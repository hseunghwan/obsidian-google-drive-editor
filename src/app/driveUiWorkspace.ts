import type { VaultFile, VaultRoot } from '../domain/vault/types';
import { toVaultFile } from '../integrations/google/driveVaultAdapter';
import type { GoogleAuthClient } from '../integrations/google/googleAuth';
import type { GoogleDriveClient } from '../integrations/google/googleDriveClient';
import type { DraftStore } from '../storage/draftStore';
import type { DriveUiCreateRequest, DriveUiOpenRequest, DriveUiRequest } from './driveUiState';
import { loadDriveWorkspace, type DriveWorkspace } from './driveWorkspaceLoader';

export interface DriveUiWorkspace {
  workspace: DriveWorkspace;
  initialFile: VaultFile;
}

interface OpenDriveUiWorkspaceDeps {
  auth: GoogleAuthClient;
  createDriveClient(accessToken: string): GoogleDriveClient;
  drafts: DraftStore;
  request: DriveUiRequest;
  rootName: string;
  newFileName: string;
  interactive: boolean;
}

/**
 * Drive UI에서 넘어온 요청(파일 열기 / 새 문서 만들기)을 편집기가 쓰는 workspace 모양으로 바꾼다.
 * drive.file 스코프에서는 폴더 목록을 못 읽으므로 vault 탐색 없이 넘겨받은 파일만 채운다.
 */
export async function openDriveUiWorkspace(
  deps: OpenDriveUiWorkspaceDeps
): Promise<DriveUiWorkspace> {
  const accessToken = await deps.auth.getAccessToken(deps.interactive);
  const drive = deps.createDriveClient(accessToken);

  const target =
    deps.request.action === 'create'
      ? await createTarget(deps.request, drive, deps.rootName, deps.newFileName)
      : await openTarget(deps.request, drive, deps.rootName);

  const workspace = await loadDriveWorkspace({
    auth: deps.auth,
    picker: {
      pickVaultFolder: () => Promise.reject(new Error('Drive UI 진입에서는 폴더 선택을 쓰지 않습니다.'))
    },
    createDriveClient: deps.createDriveClient,
    drafts: deps.drafts,
    savedRoot: target.root
  });

  return {
    workspace: { ...workspace, entries: target.files },
    initialFile: target.files[0]
  };
}

interface DriveUiTarget {
  root: VaultRoot;
  files: [VaultFile, ...VaultFile[]];
}

async function openTarget(
  request: DriveUiOpenRequest,
  drive: GoogleDriveClient,
  rootName: string
): Promise<DriveUiTarget> {
  const metadata = await Promise.all(request.fileIds.map((fileId) => drive.getMetadata(fileId)));
  const parentId = metadata[0]?.parents?.[0] ?? 'root';
  const files = metadata.map((file) => toVaultFile(file, file.parents?.[0] ?? parentId, ''));
  const [first, ...rest] = files;
  if (!first) {
    throw new Error('Drive UI 요청에 열 수 있는 파일이 없습니다.');
  }
  return { root: { id: parentId, name: rootName }, files: [first, ...rest] };
}

async function createTarget(
  request: DriveUiCreateRequest,
  drive: GoogleDriveClient,
  rootName: string,
  newFileName: string
): Promise<DriveUiTarget> {
  const created = await drive.createTextFile(request.folderId, newFileName, '');
  return {
    root: { id: request.folderId, name: rootName },
    files: [toVaultFile(created, request.folderId, '')]
  };
}
