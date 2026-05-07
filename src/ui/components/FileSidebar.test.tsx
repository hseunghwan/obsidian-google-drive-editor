import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { VaultEntry, VaultFile, VaultFolder } from '../../domain/vault/types';
import { fixtureFolder, fixtureVaultRoot } from '../../test/fixtures';
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

function renderSidebar(entries: VaultEntry[]) {
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
      onOpenSettings={vi.fn()}
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
        onOpenSettings={onOpenSettings}
      />
    );

    expect(screen.getByText(fixtureVaultRoot.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: fixtureVaultRoot.name })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '설정 열기' }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '설정' })).not.toBeInTheDocument();
  });
});
