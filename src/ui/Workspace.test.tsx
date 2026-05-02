import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fixtureFiles, fixtureVaultRoot } from '../test/fixtures';
import { Workspace } from './Workspace';

describe('Workspace', () => {
  it('opens a file and shows properties, tags, and save action', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <Workspace
        root={fixtureVaultRoot}
        files={fixtureFiles}
        initialContent={`---
title: Home
---
# Home #daily`}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: /Home/ }));

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('#daily')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalled();
  });
});
