import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BrowserGooglePickerClient } from './googlePicker';

const pickerMessages = {
  title: 'Google Drive 폴더 선택',
  rootName: '내 드라이브',
  back: '뒤로',
  close: '닫기',
  selectCurrent: '현재 폴더 선택',
  selectFolder: '선택',
  openFolder: '열기',
  loading: '폴더를 불러오는 중',
  empty: '이 위치에 폴더가 없습니다.',
  cancelledMessage: '폴더 선택이 취소되었습니다.',
  loadFailedMessage: 'Drive 폴더를 불러오지 못했습니다.'
};

describe('BrowserGooglePickerClient', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens a Drive folder explorer instead of prompting for a folder URL or id', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        files: [{ id: 'vault-folder', name: 'Vault' }]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new BrowserGooglePickerClient(pickerMessages);
    const pickedFolder = client.pickVaultFolder('access-token');

    await screen.findByRole('button', { name: 'Vault 선택' });
    expect(screen.getByRole('dialog', { name: 'Google Drive 폴더 선택' })).toBeInTheDocument();
    expect(promptSpy).not.toHaveBeenCalled();

    const firstRequest = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstRequest.searchParams.get('q')).toBe(
      "'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer access-token' }
    });

    await user.click(screen.getByRole('button', { name: 'Vault 선택' }));

    await expect(pickedFolder).resolves.toEqual({ id: 'vault-folder', name: 'Vault' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Google Drive 폴더 선택' })).not.toBeInTheDocument();
    });
  });

  it('navigates through Drive folders before selecting the current folder', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'projects', name: 'Projects' }] }))
      .mockResolvedValueOnce(jsonResponse({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new BrowserGooglePickerClient(pickerMessages);
    const pickedFolder = client.pickVaultFolder('access-token');

    await user.click(await screen.findByRole('button', { name: 'Projects 열기' }));
    expect(await screen.findByText('이 위치에 폴더가 없습니다.')).toBeInTheDocument();

    const secondRequest = new URL(fetchMock.mock.calls[1][0] as string);
    expect(secondRequest.searchParams.get('q')).toBe(
      "'projects' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    );

    await user.click(screen.getByRole('button', { name: '현재 폴더 선택' }));

    await expect(pickedFolder).resolves.toEqual({ id: 'projects', name: 'Projects' });
  });

  it('rejects when the folder explorer is cancelled', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ files: [] })));

    const client = new BrowserGooglePickerClient(pickerMessages);
    const pickedFolder = client.pickVaultFolder('access-token');
    const cancelled = expect(pickedFolder).rejects.toThrow('폴더 선택이 취소되었습니다.');

    await user.click(await screen.findByRole('button', { name: '닫기' }));

    await cancelled;
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
