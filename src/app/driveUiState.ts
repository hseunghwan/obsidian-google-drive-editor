export interface DriveUiOpenRequest {
  action: 'open';
  fileIds: string[];
  resourceKeys: Record<string, string>;
  userId?: string;
}

export interface DriveUiCreateRequest {
  action: 'create';
  folderId: string;
  folderResourceKey?: string;
  userId?: string;
}

export type DriveUiRequest = DriveUiOpenRequest | DriveUiCreateRequest;

/**
 * Drive UI 통합("연결 앱으로 열기", "새로 만들기")은 열기/새 문서 URL에 state 쿼리 파라미터로
 * URL 인코딩된 JSON을 붙여 보낸다.
 * https://developers.google.com/workspace/drive/api/guides/enable-sdk
 */
export function parseDriveUiState(search: string): DriveUiRequest | null {
  const raw = new URLSearchParams(search).get('state');
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const state = parsed as Record<string, unknown>;
  const userId = typeof state.userId === 'string' ? state.userId : undefined;

  if (state.action === 'open') {
    const fileIds = Array.isArray(state.ids)
      ? state.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (fileIds.length === 0) {
      return null;
    }
    return { action: 'open', fileIds, resourceKeys: readResourceKeys(state.resourceKeys), userId };
  }

  if (state.action === 'create' && typeof state.folderId === 'string' && state.folderId.length > 0) {
    return {
      action: 'create',
      folderId: state.folderId,
      folderResourceKey:
        typeof state.folderResourceKey === 'string' && state.folderResourceKey.length > 0
          ? state.folderResourceKey
          : undefined,
      userId
    };
  }

  return null;
}

function readResourceKeys(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const keys: Record<string, string> = {};
  for (const [fileId, resourceKey] of Object.entries(value as Record<string, unknown>)) {
    if (typeof resourceKey === 'string' && resourceKey.length > 0) {
      keys[fileId] = resourceKey;
    }
  }
  return keys;
}
