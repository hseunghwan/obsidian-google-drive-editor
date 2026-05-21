import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { reviewRequestStorageKey } from './app/reviewRequestStore';
import { vaultConnectionStorageKey } from './app/vaultConnectionStore';

describe('App', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
    vi.stubGlobal('localStorage', createMemoryStorage());
    document.documentElement.removeAttribute('data-theme');
  });

  it('shows extension loading guidance when Chrome identity is unavailable', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Google Drive vault 연결' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google Drive 연결은 Chrome 확장으로 로드한 뒤 사용할 수 있습니다.'
    );
  });

  it('switches to the workspace while the selected Drive folder loads', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('chrome', {
      identity: {
        getAuthToken: vi.fn().mockResolvedValue({ token: 'access-token' })
      },
      runtime: {
        getManifest: () => ({
          oauth2: {
            client_id: 'valid-client-id.apps.googleusercontent.com'
          }
        })
      }
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'vault-folder', name: 'Vault' }] }))
        .mockReturnValueOnce(new Promise<Response>(() => undefined))
    );

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Google Drive vault 연결' }));
    await user.click(await screen.findByRole('button', { name: 'Vault 선택' }));

    expect(await screen.findByRole('searchbox', { name: 'Vault 파일 검색' })).toBeInTheDocument();
    expect(await screen.findByText('폴더를 불러오는 중입니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Google Drive vault 연결' })).not.toBeInTheDocument();
  });

  it('restores the authenticated Drive vault after a refresh without showing the folder picker', async () => {
    const getAuthToken = vi.fn().mockResolvedValue({ token: 'cached-access-token' });
    stubChromeIdentity(getAuthToken);
    localStorage.setItem(vaultConnectionStorageKey, JSON.stringify({ id: 'vault-folder', name: 'Vault' }));
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(() => undefined)));

    render(<App />);

    expect(await screen.findByRole('searchbox', { name: 'Vault 파일 검색' })).toBeInTheDocument();
    expect(await screen.findByText('폴더를 불러오는 중입니다.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Google Drive 폴더 선택' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Google Drive vault 연결' })).not.toBeInTheDocument();
    expect(getAuthToken).toHaveBeenCalledWith({
      interactive: false,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
  });

  it('switches Google accounts from settings and requires choosing a new vault', async () => {
    const user = userEvent.setup();
    const getAuthToken = vi
      .fn()
      .mockResolvedValueOnce({ token: 'cached-access-token' })
      .mockResolvedValueOnce({ token: 'cached-access-token' });
    const removeCachedAuthToken = vi.fn().mockResolvedValue(undefined);
    stubChromeIdentity(getAuthToken, removeCachedAuthToken);
    localStorage.setItem(vaultConnectionStorageKey, JSON.stringify({ id: 'vault-folder', name: 'Vault' }));
    const fetch = vi
      .fn()
      .mockReturnValueOnce(new Promise<Response>(() => undefined))
      .mockResolvedValueOnce(emptyResponse());
    vi.stubGlobal('fetch', fetch);

    render(<App />);

    await screen.findByRole('searchbox', { name: 'Vault 파일 검색' });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: '설정 열기' }));
    await user.click(screen.getByRole('button', { name: '다른 Google 계정으로 전환' }));

    expect(await screen.findByRole('button', { name: 'Google Drive vault 연결' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/revoke', {
      body: new URLSearchParams({ token: 'cached-access-token' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST'
    });
    expect(removeCachedAuthToken).toHaveBeenCalledWith({ token: 'cached-access-token' });
    expect(localStorage.getItem(vaultConnectionStorageKey)).toBeNull();
  });

  it('opens the Drive folder picker from the sidebar root folder select', async () => {
    const user = userEvent.setup();
    const getAuthToken = vi
      .fn()
      .mockResolvedValueOnce({ token: 'cached-access-token' })
      .mockResolvedValueOnce({ token: 'cached-access-token' });
    stubChromeIdentity(getAuthToken);
    localStorage.setItem(vaultConnectionStorageKey, JSON.stringify({ id: 'vault-folder', name: 'Vault' }));
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(new Promise<Response>(() => undefined))
        .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'next-vault-folder', name: 'Next Vault' }] }))
        .mockReturnValueOnce(new Promise<Response>(() => undefined))
    );

    render(<App />);

    await screen.findByRole('searchbox', { name: 'Vault 파일 검색' });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await user.selectOptions(
      screen.getByRole('combobox', { name: '루트 폴더' }),
      screen.getByRole('option', { name: '루트 폴더 변경' })
    );

    expect(await screen.findByRole('dialog', { name: 'Google Drive 폴더 선택' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Vault 선택' })).toBeInTheDocument();
    expect(getAuthToken).toHaveBeenLastCalledWith({
      interactive: true,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
  });

  it('switches visible onboarding copy between Korean and English', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByText('Google Drive 폴더를 vault로 연결해 Markdown 파일을 편집합니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));
    await user.click(screen.getByRole('button', { name: '설정 열기' }));
    await user.selectOptions(screen.getByLabelText('언어'), 'en');

    expect(screen.getByRole('searchbox', { name: 'Search vault files' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New file' })).toBeInTheDocument();
    expect(screen.getByText('Obsidian Vault')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('keeps language settings in the sidebar menu after entering the workspace', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.queryByLabelText('언어')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));

    expect(screen.queryByLabelText('언어')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '설정 열기' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '설정 열기' }));
    await user.selectOptions(screen.getByLabelText('언어'), 'en');

    await user.selectOptions(screen.getByLabelText('Language'), 'ko');

    expect(screen.getByRole('searchbox', { name: 'Vault 파일 검색' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 파일' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '첫 문서 열기' })).toBeInTheDocument();
  });

  it('stops showing the review toast after the review link is opened', async () => {
    const user = userEvent.setup();

    const { unmount } = render(<App />);

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));
    const toast = await screen.findByLabelText('Chrome Web Store 리뷰 요청');
    await user.click(within(toast).getByRole('link', { name: /리뷰 남기기/ }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Chrome Web Store 리뷰 요청')).not.toBeInTheDocument();
    });
    expect(JSON.parse(localStorage.getItem(reviewRequestStorageKey) ?? '{}')).toEqual(
      expect.objectContaining({ completed: true })
    );

    unmount();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Chrome Web Store 리뷰 요청')).not.toBeInTheDocument();
    });
  });

  it('switches between dark and light theme from sidebar settings', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: '설정 열기' }));
    await user.selectOptions(screen.getByLabelText('테마'), 'light');

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.selectOptions(screen.getByLabelText('테마'), 'dark');

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});

function stubChromeIdentity(getAuthToken: ReturnType<typeof vi.fn>, removeCachedAuthToken = vi.fn()) {
  vi.stubGlobal('chrome', {
    identity: {
      getAuthToken,
      removeCachedAuthToken
    },
    runtime: {
      getManifest: () => ({
        oauth2: {
          client_id: 'valid-client-id.apps.googleusercontent.com'
        }
      })
    }
  });
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}

function emptyResponse(): Response {
  return {
    ok: true,
    status: 200
  } as Response;
}
