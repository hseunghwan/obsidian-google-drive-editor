import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

export const oauthClientIdPlaceholder = 'REPLACE_WITH_CHROME_EXTENSION_OAUTH_CLIENT_ID';
const oauthClientIdEnvName = 'VITE_GOOGLE_OAUTH_CLIENT_ID';

export async function packageChromeExtension(projectRoot, options = {}) {
  const root = resolve(projectRoot);
  const localEnv = await loadLocalEnv(root);
  const buildEnv = { ...process.env, ...localEnv };
  const oauthClientId = buildEnv[oauthClientIdEnvName]?.trim();
  if (!oauthClientId) {
    throw new Error(`Set ${oauthClientIdEnvName} in .env.local before running npm run package:chrome.`);
  }

  if (options.build !== false) {
    runBuild(root, buildEnv);
  }

  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const distDir = join(root, 'dist');
  const manifest = JSON.parse(await readFile(join(distDir, 'manifest.json'), 'utf8'));

  assertManifestReady(manifest);

  const releaseDir = join(root, 'release');
  const zipPath = join(releaseDir, `${packageJson.name}-${packageJson.version}-chrome.zip`);
  const files = await listPackageFiles(distDir);
  const archive = await createZipArchive(
    await Promise.all(
      files.map(async (file) => ({
        path: file,
        data: await readFile(join(distDir, file))
      }))
    )
  );

  await mkdir(dirname(zipPath), { recursive: true });
  await writeFile(zipPath, archive);
  console.log(`Chrome extension package created: ${relative(root, zipPath)}`);
}

export async function loadLocalEnv(projectRoot) {
  try {
    return parseEnvFile(await readFile(join(projectRoot, '.env.local'), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export function parseEnvFile(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    values[match[1]] = parseEnvValue(match[2].trim());
  }
  return values;
}

export function assertManifestReady(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error('Chrome Web Store package requires Manifest V3.');
  }

  const clientId = manifest.oauth2?.client_id?.trim();
  if (!clientId || clientId === oauthClientIdPlaceholder || clientId.includes('REPLACE_WITH')) {
    throw new Error(
      'OAuth client id is still a placeholder. Set VITE_GOOGLE_OAUTH_CLIENT_ID and run npm run build before packaging.'
    );
  }
}

function runBuild(projectRoot, env) {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: projectRoot,
    env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`npm run build failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function parseEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, '');
}

export async function listPackageFiles(rootDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.DS_Store') {
        continue;
      }

      const absolutePath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if ((await stat(absolutePath)).isFile()) {
        files.push(relative(rootDir, absolutePath).split(sep).join('/'));
      }
    }
  }

  await walk(rootDir);
  return files.sort((left, right) => left.localeCompare(right));
}

export async function createZipArchive(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const data = Buffer.from(entry.data);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const { dosTime, dosDate } = currentDosTimestamp();

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function currentDosTimestamp() {
  const now = new Date();
  const year = Math.max(now.getFullYear(), 1980);
  return {
    dosTime: (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  };
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await packageChromeExtension(process.cwd());
}
