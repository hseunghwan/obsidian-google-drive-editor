import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VaultFile } from '../../domain/vault/types';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { GraphLinkStore } from '../../storage/graphLinkStore';
import { GraphView, type GraphViewProps } from './GraphView';

const rendererHandle = { setForces: vi.fn(), setSearch: vi.fn(), destroy: vi.fn() };
const createGraphRenderer = vi.fn(async (..._args: unknown[]) => rendererHandle);

vi.mock('./graphRenderer', () => ({
  createGraphRenderer: (...args: unknown[]) =>
    (createGraphRenderer as (...inner: unknown[]) => Promise<typeof rendererHandle>)(...args)
}));

function file(id: string, title: string, path: string): VaultFile {
  return {
    id,
    title,
    path,
    name: `${title}.md`,
    parentId: 'root-1',
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-09T00:00:00.000Z'
  };
}

function memoryStore(): GraphLinkStore {
  const records = new Map<string, Parameters<GraphLinkStore['putMany']>[0][number]>();
  return {
    async getAll(vaultRootId) {
      return [...records.values()].filter((record) => record.vaultRootId === vaultRootId);
    },
    async putMany(next) {
      for (const record of next) {
        records.set(`${record.vaultRootId}:${record.fileId}`, record);
      }
    }
  };
}

function renderGraphView(overrides: Partial<GraphViewProps> = {}) {
  const props: GraphViewProps = {
    root: { id: 'root-1', name: 'Vault' },
    loadFolders: async () => [],
    loadMarkdownFiles: async () => [file('file-a', 'Alpha', 'Alpha.md'), file('file-b', 'Beta', 'Beta.md')],
    readFileContent: async (fileId) => (fileId === 'file-a' ? '[[Beta]]' : ''),
    onOpenFile: vi.fn(),
    linkStore: memoryStore(),
    ...overrides
  };
  render(
    <I18nProvider>
      <GraphView {...props} />
    </I18nProvider>
  );
  return props;
}

beforeEach(() => {
  createGraphRenderer.mockClear();
  rendererHandle.destroy.mockClear();
  rendererHandle.setSearch.mockClear();
  window.localStorage.clear();
});

describe('GraphView', () => {
  it('스캔 후 그래프 모델로 렌더러를 만든다', async () => {
    renderGraphView();

    await waitFor(() => expect(createGraphRenderer).toHaveBeenCalledTimes(1));
    const model = createGraphRenderer.mock.calls[0][1] as { nodes: unknown[]; edges: unknown[] };
    expect(model.nodes).toHaveLength(2);
    expect(model.edges).toHaveLength(1);
  });

  it('노드 클릭이 파일 열기로 이어진다', async () => {
    const props = renderGraphView();

    await waitFor(() => expect(createGraphRenderer).toHaveBeenCalled());
    const options = createGraphRenderer.mock.calls[0][2] as { onNodeClick(nodeId: string): void };
    options.onNodeClick('file-b');

    expect(props.onOpenFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-b' }));
  });

  it('읽기 실패 시 배너와 다시 시도 버튼을 보여준다', async () => {
    renderGraphView({
      readFileContent: async () => {
        throw new Error('rate limited');
      }
    });

    expect(await screen.findByText(/일부 파일을 읽지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('검색 입력이 렌더러 필터로 전달된다', async () => {
    renderGraphView();
    await waitFor(() => expect(createGraphRenderer).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('노트 검색'), 'Al');

    expect(rendererHandle.setSearch).toHaveBeenLastCalledWith('Al');
  });

  it('빈 vault면 빈 상태 문구를 보여준다', async () => {
    renderGraphView({ loadMarkdownFiles: async () => [] });

    expect(await screen.findByText('표시할 노트가 없습니다.')).toBeInTheDocument();
    expect(createGraphRenderer).not.toHaveBeenCalled();
  });

  it('스캔 실패 시 실패 문구와 다시 시도 버튼을 보여준다', async () => {
    renderGraphView({
      loadMarkdownFiles: async () => {
        throw new Error('offline');
      }
    });

    expect(await screen.findByText('링크 스캔에 실패했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(createGraphRenderer).not.toHaveBeenCalled();
  });
});
