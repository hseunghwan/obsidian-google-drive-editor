import type { VaultFile } from '../../domain/vault/types';

interface FileSidebarProps {
  files: VaultFile[];
  query: string;
  activeFileId?: string;
  onQueryChange(query: string): void;
  onOpen(file: VaultFile): void;
  onCreateFile(): void;
  onCreateFolder(): void;
}

export function FileSidebar({
  files,
  query,
  activeFileId,
  onQueryChange,
  onOpen,
  onCreateFile,
  onCreateFolder
}: FileSidebarProps) {
  return (
    <aside className="sidebar" aria-label="Vault files">
      <div className="sidebar-tools">
        <input
          aria-label="Vault 파일 검색"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="파일 검색"
        />
        <div className="sidebar-actions">
          <button type="button" onClick={onCreateFile}>
            새 파일
          </button>
          <button type="button" onClick={onCreateFolder}>
            새 폴더
          </button>
        </div>
      </div>
      {files.map((file) => (
        <button
          className={file.id === activeFileId ? 'sidebar-item active' : 'sidebar-item'}
          key={file.id}
          type="button"
          onClick={() => onOpen(file)}
        >
          <span>{file.title}</span>
          <small>{file.path}</small>
        </button>
      ))}
      {files.length === 0 ? <p className="sidebar-empty">표시할 Markdown 파일이 없습니다.</p> : null}
    </aside>
  );
}
