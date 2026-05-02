import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('shows extension loading guidance when Chrome identity is unavailable', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Google Drive vault 연결' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google Drive 연결은 Chrome 확장으로 로드한 뒤 사용할 수 있습니다.'
    );
  });

  it('switches visible onboarding copy between Korean and English', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByText('Google Drive 폴더를 vault로 연결해 Markdown 파일을 편집합니다.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('언어'), 'en');

    expect(screen.getByText('Edit Markdown files by connecting a Google Drive folder as a vault.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Google Drive vault' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open mock vault' })).toBeInTheDocument();
  });

  it('keeps the selected language when entering the workspace', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.selectOptions(screen.getByLabelText('언어'), 'en');
    await user.click(screen.getByRole('button', { name: 'Open mock vault' }));

    expect(screen.getByRole('searchbox', { name: 'Search vault files' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open first document' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Language'), 'ko');

    expect(screen.getByRole('searchbox', { name: 'Vault 파일 검색' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 파일' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '첫 문서 열기' })).toBeInTheDocument();
  });
});
