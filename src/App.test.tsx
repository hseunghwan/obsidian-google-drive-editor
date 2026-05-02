import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
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

  it('shows a loading state after a Drive folder is selected', async () => {
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

    expect(await screen.findByText('Drive vault를 불러오는 중입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google Drive vault 연결' })).toBeDisabled();
  });

  it('switches visible onboarding copy between Korean and English', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByText('Google Drive 폴더를 vault로 연결해 Markdown 파일을 편집합니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));
    await user.click(screen.getByRole('button', { name: '설정' }));
    await user.selectOptions(screen.getByLabelText('언어'), 'en');

    expect(screen.getByRole('searchbox', { name: 'Search vault files' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('keeps language settings in the sidebar menu after entering the workspace', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.queryByLabelText('언어')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));

    expect(screen.queryByLabelText('언어')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '설정' }));
    await user.selectOptions(screen.getByLabelText('언어'), 'en');

    await user.selectOptions(screen.getByLabelText('Language'), 'ko');

    expect(screen.getByRole('searchbox', { name: 'Vault 파일 검색' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 파일' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '첫 문서 열기' })).toBeInTheDocument();
  });

  it('switches between dark and light theme from sidebar settings', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Mock vault 열기' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: '설정' }));
    await user.selectOptions(screen.getByLabelText('테마'), 'light');

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.selectOptions(screen.getByLabelText('테마'), 'dark');

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
