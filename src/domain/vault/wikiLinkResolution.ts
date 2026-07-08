import type { VaultFile } from './types';

export function findWikiLinkTarget(files: VaultFile[], target: string): VaultFile | undefined {
  const normalized = target.trim().toLocaleLowerCase();
  return files.find(
    (entry) =>
      entry.title.toLocaleLowerCase() === normalized ||
      entry.path.toLocaleLowerCase().replace(/\.md$/, '') === normalized
  );
}
