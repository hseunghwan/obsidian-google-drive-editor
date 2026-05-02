import { type ComponentType, useEffect, useMemo, useReducer, useState } from 'react';

import { isVaultError } from '../domain/vault/errors';
import { VaultIndex } from '../domain/vault/vaultIndex';
import type { OpenDocument, SaveResult, VaultFile, VaultFolder, VaultRoot } from '../domain/vault/types';
import { Breadcrumb } from './components/Breadcrumb';
import { FileSidebar } from './components/FileSidebar';
import { MetadataPanel } from './components/MetadataPanel';
import { SaveStatus } from './components/SaveStatus';
import { MarkdownEditor, type MarkdownEditorProps } from './editor/MarkdownEditor';
import { createInitialWorkspaceState, workspaceReducer } from './state/workspaceReducer';

interface WorkspaceProps {
  root: VaultRoot;
  files: VaultFile[];
  loadFile(file: VaultFile): Promise<OpenDocument>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
  createFile(parentFolderId: string, name: string, content: string): Promise<VaultFile>;
  createFolder(parentFolderId: string, name: string): Promise<VaultFolder>;
  autosaveDelayMs?: number;
  EditorComponent?: ComponentType<MarkdownEditorProps>;
}

export function Workspace({
  root,
  files,
  loadFile,
  saveDocument,
  createFile,
  createFolder,
  autosaveDelayMs = 1200,
  EditorComponent = MarkdownEditor
}: WorkspaceProps) {
  const [state, dispatch] = useReducer(workspaceReducer, createInitialWorkspaceState());
  const [workspaceFiles, setWorkspaceFiles] = useState(files);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setWorkspaceFiles(files);
  }, [files]);

  const index = useMemo(() => {
    const vaultIndex = new VaultIndex();
    vaultIndex.replaceAll(workspaceFiles);
    return vaultIndex;
  }, [workspaceFiles]);

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return workspaceFiles;
    }
    const resultIds = new Set(index.searchFiles(normalizedQuery).map((file) => file.id));
    return workspaceFiles.filter((file) => resultIds.has(file.id));
  }, [index, query, workspaceFiles]);

  const activeDocument = state.activeDocument;

  async function openFile(file: VaultFile) {
    const document = await loadFile(file);
    dispatch({
      type: 'documentOpened',
      root,
      files: workspaceFiles,
      document
    });
  }

  async function saveDocumentWithState(document: OpenDocument) {
    dispatch({ type: 'saveStarted' });

    try {
      const result = await saveDocument(document);
      dispatch({ type: 'saveSucceeded', modifiedTime: result.modifiedTime });
    } catch (error) {
      if (isVaultError(error, 'RemoteChanged')) {
        dispatch({ type: 'remoteConflict', message: '원격 변경이 감지되었습니다.' });
        return;
      }
      dispatch({ type: 'saveFailed', message: '저장 실패. 로컬 초안을 보존했습니다.' });
    }
  }

  async function saveActiveDocument() {
    if (!state.activeDocument) {
      return;
    }

    await saveDocumentWithState(state.activeDocument);
  }

  useEffect(() => {
    if (state.saveState.status !== 'dirty' || !activeDocument) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveDocumentWithState(activeDocument);
    }, autosaveDelayMs);

    return () => window.clearTimeout(timer);
  }, [activeDocument, autosaveDelayMs, state.saveState.status]);

  async function createMarkdownFile() {
    const rawName = window.prompt('새 Markdown 파일 이름');
    const title = rawName?.trim();
    if (!title) {
      return;
    }

    const name = title.endsWith('.md') ? title : `${title}.md`;
    const nextFile = await createFile(root.id, name, `# ${name.replace(/\.md$/i, '')}\n`);
    const nextFiles = [...workspaceFiles, nextFile].sort((left, right) => left.path.localeCompare(right.path));
    setWorkspaceFiles(nextFiles);
    setNotice(null);
    dispatch({
      type: 'documentOpened',
      root,
      files: nextFiles,
      document: {
        file: nextFile,
        content: `# ${nextFile.title}\n`,
        baselineModifiedTime: nextFile.modifiedTime
      }
    });
  }

  async function createVaultFolder() {
    const rawName = window.prompt('새 폴더 이름');
    const name = rawName?.trim();
    if (!name) {
      return;
    }

    await createFolder(root.id, name);
    setNotice('폴더 생성됨');
  }

  return (
    <div className="workspace">
      <FileSidebar
        files={visibleFiles}
        query={query}
        activeFileId={activeDocument?.file.id}
        onQueryChange={setQuery}
        onOpen={(file) => void openFile(file)}
        onCreateFile={() => void createMarkdownFile()}
        onCreateFolder={() => void createVaultFolder()}
      />
      <section className="workspace-main">
        {activeDocument ? (
          <>
            <Breadcrumb path={activeDocument.file.path} />
            <EditorComponent
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
        ) : workspaceFiles.length === 0 ? (
          <div className="empty-vault">
            <p>이 vault에 Markdown 파일이 없습니다.</p>
            <button type="button" onClick={() => void createMarkdownFile()}>
              새 파일
            </button>
          </div>
        ) : (
          <button className="open-first-file" type="button" onClick={() => void openFile(visibleFiles[0] ?? workspaceFiles[0])}>
            첫 문서 열기
          </button>
        )}
        {notice ? <p className="workspace-notice">{notice}</p> : null}
      </section>
      {activeDocument ? <MetadataPanel content={activeDocument.content} /> : null}
    </div>
  );
}
