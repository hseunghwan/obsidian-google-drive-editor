import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fixtureFiles, fixtureVaultRoot } from '../test/fixtures';
import { Workspace } from './Workspace';

describe('Workspace', () => {
  it('opens a file, shows metadata, and saves the active document', async () => {
    const user = userEvent.setup();
    const saveDocument = vi.fn().mockResolvedValue({
      fileId: 'file-home',
      modifiedTime: '2026-05-03T00:11:00.000Z'
    });

    render(
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
      />
    );

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
});
