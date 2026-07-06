import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { VaultEntry, VaultFile, VaultFolder } from '../../domain/vault/types';
import { fixtureFiles, fixtureFolder, fixtureVaultRoot } from '../../test/fixtures';
import { FileSidebar } from './FileSidebar';

const areaFolder: VaultFolder = {
  id: 'folder-area',
  name: 'Area',
  path: 'Projects/Area',
  parentId: fixtureFolder.id,
  kind: 'folder',
  mimeType: 'application/vnd.google-apps.folder',
  modifiedTime: '2026-05-03T00:14:00.000Z'
};

const nestedNote: VaultFile = {
  id: 'file-nested-note',
  name: 'Nested Note.md',
  title: 'Nested Note',
  path: 'Projects/Area/Nested Note.md',
  parentId: areaFolder.id,
  kind: 'markdown',
  mimeType: 'text/markdown',
  modifiedTime: '2026-05-03T00:15:00.000Z'
};

function renderSidebar(
  entries: VaultEntry[],
  overrides: Partial<ComponentProps<typeof FileSidebar>> = {}
) {
  return render(
    <FileSidebar
      rootId={fixtureVaultRoot.id}
      rootName={fixtureVaultRoot.name}
      entries={entries}
      query=""
      expandedFolderIds={new Set([fixtureFolder.id, areaFolder.id])}
      loadingFolderIds={new Set()}
      onQueryChange={vi.fn()}
      onOpen={vi.fn()}
      onToggleFolder={vi.fn()}
      onCreateFile={vi.fn()}
      onCreateFolder={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      onChangeRootFolder={vi.fn()}
      onOpenSettings={vi.fn()}
      {...overrides}
    />
  );
}

describe('FileSidebar', () => {
  it('marks expanded descendants with their tree depth', () => {
    renderSidebar([fixtureFolder, areaFolder, nestedNote]);

    expect(screen.getByRole('button', { name: /^Projects$/ })).toHaveAttribute('data-depth', '0');
    expect(screen.getByRole('button', { name: /^Area$/ })).toHaveAttribute('data-depth', '1');
    expect(screen.getByRole('button', { name: /Nested Note/ })).toHaveAttribute('data-depth', '2');
  });

  it('shows only the note title in file rows', () => {
    renderSidebar([fixtureFolder, areaFolder, nestedNote]);

    expect(screen.getByRole('button', { name: 'Nested Note' })).toBeInTheDocument();
    expect(screen.queryByText('Projects/Area/Nested Note.md')).not.toBeInTheDocument();
  });

  it('routes folder menu actions to the selected folder', async () => {
    const user = userEvent.setup();
    const onCreateFile = vi.fn();
    const onCreateFolder = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    renderSidebar([fixtureFolder], {
      onCreateFile,
      onCreateFolder,
      onRename,
      onDelete
    });

    const menu = screen.getByRole('combobox', { name: 'Projects 더보기' });

    await user.selectOptions(menu, 'create-file');
    expect(onCreateFile).toHaveBeenCalledWith(fixtureFolder.id);

    await user.selectOptions(menu, 'create-folder');
    expect(onCreateFolder).toHaveBeenCalledWith(fixtureFolder.id);

    await user.selectOptions(menu, 'rename');
    expect(onRename).toHaveBeenCalledWith(fixtureFolder);

    await user.selectOptions(menu, 'delete');
    expect(onDelete).toHaveBeenCalledWith(fixtureFolder);
  });

  it('routes file menu actions without opening the file', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    renderSidebar([fixtureFiles[0]], {
      onOpen,
      onRename,
      onDelete
    });

    const menu = screen.getByRole('combobox', { name: 'Home 더보기' });

    await user.selectOptions(menu, 'rename');
    expect(onRename).toHaveBeenCalledWith(fixtureFiles[0]);
    expect(onOpen).not.toHaveBeenCalled();

    await user.selectOptions(menu, 'delete');
    expect(onDelete).toHaveBeenCalledWith(fixtureFiles[0]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('copies the vault path from the item menu', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    renderSidebar([fixtureFiles[0]]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Home 더보기' }), 'copy-path');

    expect(writeText).toHaveBeenCalledWith('Home.md');
  });

  it('opens the entry in Google Drive from the item menu', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    renderSidebar([fixtureFiles[0], fixtureFolder]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Home 더보기' }), 'open-drive');
    expect(open).toHaveBeenCalledWith(
      'https://drive.google.com/file/d/file-home/view',
      '_blank',
      'noopener'
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Projects 더보기' }), 'open-drive');
    expect(open).toHaveBeenCalledWith(
      `https://drive.google.com/drive/folders/${fixtureFolder.id}`,
      '_blank',
      'noopener'
    );
  });

  it('opens the shortcut list from the footer help button', async () => {
    const user = userEvent.setup();

    renderSidebar([fixtureFiles[0]]);

    await user.click(screen.getByRole('button', { name: '단축키 보기' }));

    const dialog = screen.getByRole('dialog', { name: '단축키' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('저장');
    expect(dialog).toHaveTextContent('볼드');

    await user.click(screen.getByRole('button', { name: '단축키 닫기' }));
    expect(screen.queryByRole('dialog', { name: '단축키' })).not.toBeInTheDocument();
  });

  it('moves the root folder name to the sidebar footer beside the settings button', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();

    render(
      <FileSidebar
        rootId={fixtureVaultRoot.id}
        rootName={fixtureVaultRoot.name}
        entries={[fixtureFolder]}
        query=""
        expandedFolderIds={new Set()}
        loadingFolderIds={new Set()}
        onQueryChange={vi.fn()}
        onOpen={vi.fn()}
        onToggleFolder={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onChangeRootFolder={vi.fn()}
        onOpenSettings={onOpenSettings}
      />
    );

    expect(screen.getByText(fixtureVaultRoot.name)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '루트 폴더' })).toHaveClass('sidebar-vault-summary');

    await user.click(screen.getByRole('button', { name: '설정 열기' }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '설정' })).not.toBeInTheDocument();
  });

  it('opens root folder selection from the vault summary select', async () => {
    const user = userEvent.setup();
    const onChangeRootFolder = vi.fn();

    renderSidebar([fixtureFolder], { onChangeRootFolder });

    const rootSelect = screen.getByRole('combobox', { name: '루트 폴더' });
    expect(rootSelect).toHaveValue(fixtureVaultRoot.id);
    await user.selectOptions(rootSelect, screen.getByRole('option', { name: '루트 폴더 변경' }));

    expect(onChangeRootFolder).toHaveBeenCalledTimes(1);
    expect(rootSelect).toHaveValue(fixtureVaultRoot.id);
  });
});
