import { useMemo, useReducer } from 'react';

import { isVaultError } from '../domain/vault/errors';
import { VaultIndex } from '../domain/vault/vaultIndex';
import type { OpenDocument, SaveResult, VaultFile, VaultRoot } from '../domain/vault/types';
import { Breadcrumb } from './components/Breadcrumb';
import { FileSidebar } from './components/FileSidebar';
import { MetadataPanel } from './components/MetadataPanel';
import { SaveStatus } from './components/SaveStatus';
import { MarkdownEditor } from './editor/MarkdownEditor';
import { createInitialWorkspaceState, workspaceReducer } from './state/workspaceReducer';

interface WorkspaceProps {
  root: VaultRoot;
  files: VaultFile[];
  loadFile(file: VaultFile): Promise<OpenDocument>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
}

export function Workspace({ root, files, loadFile, saveDocument }: WorkspaceProps) {
  const [state, dispatch] = useReducer(workspaceReducer, createInitialWorkspaceState());
  const index = useMemo(() => {
    const vaultIndex = new VaultIndex();
    vaultIndex.replaceAll(files);
    return vaultIndex;
  }, [files]);

  const activeDocument = state.activeDocument;

  async function openFile(file: VaultFile) {
    const document = await loadFile(file);
    dispatch({
      type: 'documentOpened',
      root,
      files,
      document
    });
  }

  async function saveActiveDocument() {
    if (!activeDocument) {
      return;
    }

    dispatch({ type: 'saveStarted' });

    try {
      const result = await saveDocument(activeDocument);
      dispatch({ type: 'saveSucceeded', modifiedTime: result.modifiedTime });
    } catch (error) {
      if (isVaultError(error, 'RemoteChanged')) {
        dispatch({ type: 'remoteConflict', message: '원격 변경이 감지되었습니다.' });
        return;
      }
      dispatch({ type: 'saveFailed', message: '저장 실패. 로컬 초안을 보존했습니다.' });
    }
  }

  return (
    <div className="workspace">
      <FileSidebar
        files={files}
        activeFileId={activeDocument?.file.id}
        onOpen={(file) => void openFile(file)}
      />
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
              onSave={() => void saveActiveDocument()}
            />
          </>
        ) : (
          <button className="open-first-file" type="button" onClick={() => void openFile(files[0])}>
            첫 문서 열기
          </button>
        )}
      </section>
      {activeDocument ? <MetadataPanel content={activeDocument.content} /> : null}
    </div>
  );
}
