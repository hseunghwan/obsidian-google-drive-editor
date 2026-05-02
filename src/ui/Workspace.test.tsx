import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fixtureFiles, fixtureVaultRoot } from '../test/fixtures';
import type { MarkdownEditorProps } from './editor/MarkdownEditor';
import { Workspace } from './Workspace';

const saveDocument = vi.fn().mockResolvedValue({
  fileId: 'file-home',
  modifiedTime: '2026-05-03T00:11:00.000Z'
});

const createFile = vi.fn().mockResolvedValue({
  id: 'file-new-note',
  name: 'New Note.md',
  title: 'New Note',
  path: 'New Note.md',
  parentId: fixtureVaultRoot.id,
  kind: 'markdown',
  mimeType: 'text/markdown',
  modifiedTime: '2026-05-03T00:12:00.000Z'
});

const createFolder = vi.fn().mockResolvedValue({
  id: 'folder-new',
  name: 'New Folder',
  path: 'New Folder',
  parentId: fixtureVaultRoot.id,
  kind: 'folder',
  mimeType: 'application/vnd.google-apps.folder',
  modifiedTime: '2026-05-03T00:13:00.000Z'
});

function renderWorkspace() {
  return render(
    <Workspace
      root={fixtureVaultRoot}
      files={fixtureFiles}
      loadFile={async (file) => ({
        file,
        content: `---
title: Home
---
# Home #daily`,
        baselineModifiedTime: file.modifiedTime
      })}
      saveDocument={saveDocument}
      createFile={createFile}
      createFolder={createFolder}
      autosaveDelayMs={10}
    />
  );
}

describe('Workspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('opens a file, shows metadata, and saves the active document', async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(screen.getByRole('button', { name: /Home/ }));

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('#daily')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ id: 'file-home' })
      })
    );
    expect(await screen.findByText('저장됨')).toBeInTheDocument();
  });

  it('filters sidebar files by title or path', async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.type(screen.getByRole('searchbox', { name: 'Vault 파일 검색' }), 'project');

    expect(screen.getByRole('button', { name: /Project Note/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Home/ })).not.toBeInTheDocument();
  });

  it('creates a markdown file from the sidebar', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('New Note');

    renderWorkspace();

    await user.click(screen.getByRole('button', { name: '새 파일' }));

    expect(createFile).toHaveBeenCalledWith(fixtureVaultRoot.id, 'New Note.md', '# New Note\n');
    expect(await screen.findByText('New Note')).toBeInTheDocument();
  });

  it('creates a folder from the sidebar', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('New Folder');

    renderWorkspace();

    await user.click(screen.getByRole('button', { name: '새 폴더' }));

    expect(createFolder).toHaveBeenCalledWith(fixtureVaultRoot.id, 'New Folder');
    expect(await screen.findByText('폴더 생성됨')).toBeInTheDocument();
  });

  it('autosaves dirty editor content after the debounce delay', async () => {
    render(
      <Workspace
        root={fixtureVaultRoot}
        files={fixtureFiles}
        loadFile={async (file) => ({
          file,
          content: '# Home',
          baselineModifiedTime: file.modifiedTime
        })}
        saveDocument={saveDocument}
        createFile={createFile}
        createFolder={createFolder}
        autosaveDelayMs={10}
        EditorComponent={TestEditor}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    const editor = await screen.findByRole('textbox', { name: 'Markdown editor' });
    saveDocument.mockClear();
    vi.useFakeTimers();

    fireEvent.change(editor, {
      target: { value: '# Home\nAutosaved' }
    });
    vi.advanceTimersByTime(20);

    await vi.runAllTimersAsync();
    expect(saveDocument).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('renders an empty vault state without trying to open an undefined file', () => {
    render(
      <Workspace
        root={fixtureVaultRoot}
        files={[]}
        loadFile={vi.fn()}
        saveDocument={saveDocument}
        createFile={createFile}
        createFolder={createFolder}
      />
    );

    expect(screen.getByText('이 vault에 Markdown 파일이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '첫 문서 열기' })).not.toBeInTheDocument();
  });
});

function TestEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <textarea
      aria-label="Markdown editor"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
