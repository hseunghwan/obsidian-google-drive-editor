import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import {
  assertManifestReady,
  createZipArchive,
  listPackageFiles,
  oauthClientIdPlaceholder
} from './packageChromeExtension.mjs';

describe('packageChromeExtension', () => {
  it('fails when the manifest still has the OAuth placeholder', () => {
    expect(() =>
      assertManifestReady({
        manifest_version: 3,
        oauth2: { client_id: oauthClientIdPlaceholder }
      })
    ).toThrow('OAuth client id is still a placeholder');
  });

  it('lists package files in deterministic order without macOS metadata files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chrome-package-'));
    try {
      await writeFile(join(root, 'manifest.json'), '{}');
      await writeFile(join(root, '.DS_Store'), '');
      await writeFile(join(root, 'index.html'), '');

      await expect(listPackageFiles(root)).resolves.toEqual(['index.html', 'manifest.json']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('creates a Chrome Web Store uploadable zip archive', async () => {
    const archive = await createZipArchive([
      { path: 'manifest.json', data: Buffer.from('{"manifest_version":3}') },
      { path: 'index.html', data: Buffer.from('<main></main>') }
    ]);

    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(archive.includes(Buffer.from('manifest.json'))).toBe(true);
    expect(archive.includes(Buffer.from('index.html'))).toBe(true);
    expect(archive.readUInt32LE(archive.length - 22)).toBe(0x06054b50);
  });
});
