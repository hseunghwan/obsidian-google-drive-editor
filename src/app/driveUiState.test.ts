import { describe, expect, it } from 'vitest';

import { parseDriveUiState } from './driveUiState';

function search(state: unknown) {
  return `?state=${encodeURIComponent(JSON.stringify(state))}`;
}

describe('parseDriveUiState', () => {
  it('parses an open request with resource keys', () => {
    const request = parseDriveUiState(
      search({
        ids: ['file-1', 'file-2'],
        action: 'open',
        userId: 'user-1',
        resourceKeys: { 'file-1': 'key-1', 'file-2': 2 }
      })
    );

    expect(request).toEqual({
      action: 'open',
      fileIds: ['file-1', 'file-2'],
      resourceKeys: { 'file-1': 'key-1' },
      userId: 'user-1'
    });
  });

  it('parses a create request', () => {
    expect(
      parseDriveUiState(
        search({ action: 'create', folderId: 'folder-1', folderResourceKey: 'key-1', userId: 'user-1' })
      )
    ).toEqual({
      action: 'create',
      folderId: 'folder-1',
      folderResourceKey: 'key-1',
      userId: 'user-1'
    });
  });

  it('ignores requests without usable ids', () => {
    expect(parseDriveUiState(search({ action: 'open', ids: [] }))).toBeNull();
    expect(parseDriveUiState(search({ action: 'create' }))).toBeNull();
    expect(parseDriveUiState(search({ action: 'download', ids: ['file-1'] }))).toBeNull();
  });

  it('ignores missing or malformed state', () => {
    expect(parseDriveUiState('')).toBeNull();
    expect(parseDriveUiState('?state=not-json')).toBeNull();
    expect(parseDriveUiState('?state=null')).toBeNull();
  });
});
