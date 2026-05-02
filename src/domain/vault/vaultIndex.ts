import type { VaultFile } from './types';

export interface FileSearchResult {
  id: string;
  title: string;
  path: string;
  ambiguous: boolean;
}

export class VaultIndex {
  private files = new Map<string, VaultFile>();

  replaceAll(files: VaultFile[]) {
    this.files = new Map(files.map((file) => [file.id, file]));
  }

  upsert(file: VaultFile) {
    this.files.set(file.id, file);
  }

  getFile(fileId: string) {
    return this.files.get(fileId);
  }

  getAllFiles() {
    return [...this.files.values()].sort(compareByPath);
  }

  searchFiles(query: string): FileSearchResult[] {
    const normalizedQuery = normalize(query);
    const titleCounts = countTitles(this.getAllFiles());

    return this.getAllFiles()
      .filter((file) => normalize(`${file.title} ${file.path}`).includes(normalizedQuery))
      .map((file) => ({
        id: file.id,
        title: file.title,
        path: file.path,
        ambiguous: (titleCounts.get(normalize(file.title)) ?? 0) > 1
      }));
  }
}

function countTitles(files: VaultFile[]) {
  const counts = new Map<string, number>();
  for (const file of files) {
    const title = normalize(file.title);
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  return counts;
}

function compareByPath(left: VaultFile, right: VaultFile) {
  return left.path.localeCompare(right.path, undefined, { sensitivity: 'base' });
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}
