import type { VaultFile } from '../../domain/vault/types';

interface FileSidebarProps {
  files: VaultFile[];
  activeFileId?: string;
  onOpen(file: VaultFile): void;
}

export function FileSidebar({ files, activeFileId, onOpen }: FileSidebarProps) {
  return (
    <aside className="sidebar" aria-label="Vault files">
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
    </aside>
  );
}
