import { extractMarkdownMetadata } from '../domain/markdown/markdownMetadata';
import type { VaultFile, VaultFolder } from '../domain/vault/types';
import type { GraphLinkRecord, GraphLinkStore } from '../storage/graphLinkStore';

export interface GraphScanDeps {
  vaultRootId: string;
  listFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  listMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  readFileContent(fileId: string): Promise<string>;
  store: GraphLinkStore;
  onProgress?(done: number, total: number): void;
  isCancelled?(): boolean;
  concurrency?: number;
}

export interface GraphScanResult {
  files: VaultFile[];
  wikiLinksByFileId: Map<string, string[]>;
  failedFileIds: string[];
  cancelled: boolean;
}

const skippedFolderNames = new Set(['.obsidian', '.trash']);

export async function scanVaultLinks(deps: GraphScanDeps): Promise<GraphScanResult> {
  const files = await listAllMarkdownFiles(deps);
  const cached = new Map(
    (await deps.store.getAll(deps.vaultRootId)).map((record) => [record.fileId, record])
  );

  const wikiLinksByFileId = new Map<string, string[]>();
  const staleFiles: VaultFile[] = [];
  for (const file of files) {
    const record = cached.get(file.id);
    if (record && record.modifiedTime === file.modifiedTime) {
      wikiLinksByFileId.set(file.id, record.wikiLinks);
    } else {
      staleFiles.push(file);
    }
  }

  const failedFileIds: string[] = [];
  const freshRecords: GraphLinkRecord[] = [];
  const queue = [...staleFiles];
  let done = 0;
  let cancelled = false;
  deps.onProgress?.(0, staleFiles.length);

  async function worker() {
    for (;;) {
      if (deps.isCancelled?.()) {
        cancelled = true;
        return;
      }
      const file = queue.shift();
      if (!file) {
        return;
      }
      try {
        const content = await deps.readFileContent(file.id);
        const wikiLinks = extractMarkdownMetadata(content).wikiLinks;
        wikiLinksByFileId.set(file.id, wikiLinks);
        freshRecords.push({
          vaultRootId: deps.vaultRootId,
          fileId: file.id,
          modifiedTime: file.modifiedTime,
          wikiLinks
        });
      } catch {
        const record = cached.get(file.id);
        if (record) {
          wikiLinksByFileId.set(file.id, record.wikiLinks);
        }
        failedFileIds.push(file.id);
      }
      done += 1;
      deps.onProgress?.(done, staleFiles.length);
    }
  }

  const workerCount = Math.min(deps.concurrency ?? 6, Math.max(queue.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (freshRecords.length > 0) {
    await deps.store.putMany(freshRecords);
  }

  return { files, wikiLinksByFileId, failedFileIds, cancelled };
}

async function listAllMarkdownFiles(
  deps: Pick<GraphScanDeps, 'vaultRootId' | 'listFolders' | 'listMarkdownFiles' | 'isCancelled'>
): Promise<VaultFile[]> {
  const files: VaultFile[] = [];
  const queue = [{ id: deps.vaultRootId, path: '' }];

  while (queue.length > 0) {
    if (deps.isCancelled?.()) {
      break;
    }
    const current = queue.shift()!;
    const [markdownFiles, folders] = await Promise.all([
      deps.listMarkdownFiles(current.id, current.path),
      deps.listFolders(current.id, current.path)
    ]);
    files.push(...markdownFiles);
    queue.push(
      ...folders
        .filter((child) => !skippedFolderNames.has(child.name))
        .map((child) => ({ id: child.id, path: child.path }))
    );
  }

  return files;
}
