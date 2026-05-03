import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import {
  assertManifestReady,
  createZipArchive,
  listPackageFiles,
  loadLocalEnv,
  oauthClientIdPlaceholder,
  parseEnvFile
} from './packageChromeExtension.mjs';

describe('packageChromeExtension', () => {
  it('reads the Chrome OAuth client id from .env.local', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chrome-package-env-'));
    try {
      await writeFile(
        join(root, '.env.local'),
        'VITE_GOOGLE_OAUTH_CLIENT_ID=local-client-id.apps.googleusercontent.com\n'
      );

      await expect(loadLocalEnv(root)).resolves.toMatchObject({
        VITE_GOOGLE_OAUTH_CLIENT_ID: 'local-client-id.apps.googleusercontent.com'
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('parses quoted and commented .env.local values', () => {
    expect(
      parseEnvFile(`
        # local Chrome extension OAuth config
        export VITE_GOOGLE_OAUTH_CLIENT_ID="quoted-client-id.apps.googleusercontent.com"
        IGNORED=value # trailing comment
      `)
    ).toMatchObject({
      VITE_GOOGLE_OAUTH_CLIENT_ID: 'quoted-client-id.apps.googleusercontent.com',
      IGNORED: 'value'
    });
  });

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
