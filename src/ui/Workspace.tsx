import { useMemo, useReducer } from 'react';

import { VaultIndex } from '../domain/vault/vaultIndex';
import type { VaultFile, VaultRoot } from '../domain/vault/types';
import { Breadcrumb } from './components/Breadcrumb';
import { FileSidebar } from './components/FileSidebar';
import { MetadataPanel } from './components/MetadataPanel';
import { SaveStatus } from './components/SaveStatus';
import { MarkdownEditor } from './editor/MarkdownEditor';
import { createInitialWorkspaceState, workspaceReducer } from './state/workspaceReducer';

interface WorkspaceProps {
  root: VaultRoot;
  files: VaultFile[];
  initialContent: string;
  onSave(content: string): void;
}

export function Workspace({ root, files, initialContent, onSave }: WorkspaceProps) {
  const [state, dispatch] = useReducer(workspaceReducer, createInitialWorkspaceState());
  const index = useMemo(() => {
    const vaultIndex = new VaultIndex();
    vaultIndex.replaceAll(files);
    return vaultIndex;
  }, [files]);

  const activeDocument = state.activeDocument;

  function openFile(file: VaultFile) {
    dispatch({
      type: 'documentOpened',
      root,
      files,
      document: {
        file,
        content: initialContent,
        baselineModifiedTime: file.modifiedTime
      }
    });
  }

  return (
    <div className="workspace">
      <FileSidebar files={files} activeFileId={activeDocument?.file.id} onOpen={openFile} />
      <section className="workspace-main">
        {activeDocument ? (
          <>
            <Breadcrumb path={activeDocument.file.path} />
            <MarkdownEditor
              value={activeDocument.content}
              index={index}
              onChange={(content) => dispatch({ type: 'documentEdited', content })}
            />
            <SaveStatus
              status={state.saveState.status}
              message={state.saveState.message}
              onSave={() => onSave(activeDocument.content)}
            />
          </>
        ) : (
          <button className="open-first-file" type="button" onClick={() => openFile(files[0])}>
            첫 문서 열기
          </button>
        )}
      </section>
      {activeDocument ? <MetadataPanel content={activeDocument.content} /> : null}
    </div>
  );
}
