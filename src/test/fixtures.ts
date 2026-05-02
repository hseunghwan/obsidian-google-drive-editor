import type { VaultFile, VaultFolder, VaultRoot } from '../domain/vault/types';

export const fixtureVaultRoot: VaultRoot = {
  id: 'drive-folder-root',
  name: 'Obsidian Vault'
};

export const fixtureFolder: VaultFolder = {
  id: 'folder-projects',
  name: 'Projects',
  path: 'Projects',
  parentId: fixtureVaultRoot.id,
  kind: 'folder',
  mimeType: 'application/vnd.google-apps.folder',
  modifiedTime: '2026-05-03T00:00:00.000Z'
};

export const fixtureFiles: VaultFile[] = [
  {
    id: 'file-home',
    name: 'Home.md',
    title: 'Home',
    path: 'Home.md',
    parentId: fixtureVaultRoot.id,
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-05-03T00:01:00.000Z'
  },
  {
    id: 'file-project-note',
    name: 'Project Note.md',
    title: 'Project Note',
    path: 'Projects/Project Note.md',
    parentId: fixtureFolder.id,
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-05-03T00:02:00.000Z'
  }
];
