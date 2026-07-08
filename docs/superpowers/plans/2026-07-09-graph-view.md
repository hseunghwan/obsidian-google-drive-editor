# 그래프 뷰 (전체 그래프) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ⌘G로 에디터 자리에 전환되는 Obsidian 스타일 전체 그래프 뷰 — d3-force 시뮬레이션 + pixi.js WebGL 렌더링, vault 전체 스캔 + IndexedDB 캐시.

**Architecture:** 순수 도메인 로직(링크 해석·그래프 모델·설정 파싱) → 스토리지(IndexedDB 링크 캐시) → 앱 서비스(vault 스캐너) → UI(React GraphView + 명령형 pixi/d3 렌더러). 무거운 모듈(pixi, d3)은 dynamic import 뒤 lazy 청크. 스펙: `docs/superpowers/specs/2026-07-09-graph-view-design.md`

**Tech Stack:** TypeScript strict, React 19, Vite, Vitest(jsdom + fake-indexeddb), pixi.js v8, d3-force/d3-zoom/d3-drag/d3-selection

## Global Constraints

- 테스트: `npm test` (vitest run). 타입: `npm run typecheck`. 단일 테스트: `npx vitest run <파일경로>`
- 초기 번들 크기 불변 — pixi/d3는 반드시 dynamic import 청크 (`graphRenderer.ts`만 pixi/d3를 정적 import하고, 그 모듈 자체를 `import()`로 로드)
- 기존 코드 스타일: 세미콜론, 싱글쿼트, 함수형 React, i18n은 `useI18n().t(key)` — 새 UI 문자열은 반드시 `src/i18n/messages.ts`의 `ko`와 `en` 양쪽에 추가
- 커밋 메시지: 한국어 현재형 (`그래프 모델을 추가한다` 스타일), 본문 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- IndexedDB는 기존 `drive-obsidian-editor` DB를 건드리지 않는다 (버전 충돌) — 그래프 캐시는 별도 DB `drive-obsidian-graph`
- `.obsidian/graph.json`은 읽기 전용. 절대 쓰지 않는다

---

### Task 1: 위키링크 해석 공유 함수 추출

`Workspace.tsx`의 `findWikiLinkFile`(title/path 대소문자 무시 매칭)을 도메인 함수로 추출한다. 그래프 엣지 해석과 에디터 링크 클릭이 같은 규칙을 쓰게 하는 기반.

**Files:**
- Create: `src/domain/vault/wikiLinkResolution.ts`
- Create: `src/domain/vault/wikiLinkResolution.test.ts`
- Modify: `src/ui/Workspace.tsx:632-639` (`findWikiLinkFile` 본문 교체)

**Interfaces:**
- Consumes: `VaultFile` (`src/domain/vault/types.ts`)
- Produces: `findWikiLinkTarget(files: VaultFile[], target: string): VaultFile | undefined` — Task 3(graphModel)과 Workspace가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/vault/wikiLinkResolution.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { VaultFile } from './types';
import { findWikiLinkTarget } from './wikiLinkResolution';

function file(overrides: Partial<VaultFile> & Pick<VaultFile, 'id' | 'title' | 'path'>): VaultFile {
  return {
    name: `${overrides.title}.md`,
    parentId: 'folder-root',
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-09T00:00:00.000Z',
    ...overrides
  };
}

describe('findWikiLinkTarget', () => {
  const files = [
    file({ id: 'file-a', title: 'Alpha', path: 'Alpha.md' }),
    file({ id: 'file-b', title: 'Beta', path: 'Notes/Beta.md' }),
    file({ id: 'file-c', title: 'Beta', path: 'Archive/Beta.md' })
  ];

  it('제목을 대소문자 무시로 매칭한다', () => {
    expect(findWikiLinkTarget(files, 'alpha')?.id).toBe('file-a');
  });

  it('공백을 다듬은 뒤 매칭한다', () => {
    expect(findWikiLinkTarget(files, '  Alpha  ')?.id).toBe('file-a');
  });

  it('.md를 뗀 경로로 매칭한다', () => {
    expect(findWikiLinkTarget(files, 'notes/beta')?.id).toBe('file-b');
  });

  it('중복 제목은 배열 첫 매치를 돌려준다', () => {
    expect(findWikiLinkTarget(files, 'Beta')?.id).toBe('file-b');
  });

  it('매치가 없으면 undefined', () => {
    expect(findWikiLinkTarget(files, 'Gamma')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/vault/wikiLinkResolution.test.ts`
Expected: FAIL — `findWikiLinkTarget` 모듈 없음

- [ ] **Step 3: 구현**

`src/domain/vault/wikiLinkResolution.ts` (Workspace의 기존 로직 그대로 이동):

```ts
import type { VaultFile } from './types';

export function findWikiLinkTarget(files: VaultFile[], target: string): VaultFile | undefined {
  const normalized = target.trim().toLocaleLowerCase();
  return files.find(
    (entry) =>
      entry.title.toLocaleLowerCase() === normalized ||
      entry.path.toLocaleLowerCase().replace(/\.md$/, '') === normalized
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/domain/vault/wikiLinkResolution.test.ts`
Expected: PASS 5건

- [ ] **Step 5: Workspace가 공유 함수를 쓰도록 교체**

`src/ui/Workspace.tsx` 상단 import 블록(다른 domain import 옆)에 추가:

```ts
import { findWikiLinkTarget } from '../domain/vault/wikiLinkResolution';
```

기존 `findWikiLinkFile` 함수(632-639줄)를 다음으로 교체:

```ts
  function findWikiLinkFile(target: string) {
    return findWikiLinkTarget(workspaceFiles, target);
  }
```

- [ ] **Step 6: 전체 테스트 + 타입 확인**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/domain/vault/wikiLinkResolution.ts src/domain/vault/wikiLinkResolution.test.ts src/ui/Workspace.tsx
git commit -m "$(cat <<'EOF'
위키링크 해석을 도메인 함수로 추출한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 그래프 포스 설정 파서

`.obsidian/graph.json`(신뢰 불가 외부 JSON)에서 포스 4개를 안전하게 뽑는 순수 파서.

**Files:**
- Create: `src/domain/graph/graphSettings.ts`
- Create: `src/domain/graph/graphSettings.test.ts`

**Interfaces:**
- Produces: `GraphForceSettings { centerStrength: number; repelStrength: number; linkStrength: number; linkDistance: number }`, `defaultGraphForceSettings: GraphForceSettings`, `parseGraphForceSettings(raw: unknown): GraphForceSettings` — Task 8(렌더러), Task 9(GraphView)가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/graph/graphSettings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { defaultGraphForceSettings, parseGraphForceSettings } from './graphSettings';

describe('parseGraphForceSettings', () => {
  it('graph.json의 포스 값을 채택한다', () => {
    expect(
      parseGraphForceSettings({
        centerStrength: 0.518713248970312,
        repelStrength: 10,
        linkStrength: 1,
        linkDistance: 250,
        showTags: false
      })
    ).toEqual({ centerStrength: 0.518713248970312, repelStrength: 10, linkStrength: 1, linkDistance: 250 });
  });

  it('누락된 키는 기본값으로 채운다', () => {
    expect(parseGraphForceSettings({ repelStrength: 15 })).toEqual({
      ...defaultGraphForceSettings,
      repelStrength: 15
    });
  });

  it('숫자가 아니거나 NaN인 값은 기본값으로 바꾼다', () => {
    expect(parseGraphForceSettings({ centerStrength: 'high', linkDistance: Number.NaN })).toEqual(
      defaultGraphForceSettings
    );
  });

  it('객체가 아니면 전부 기본값', () => {
    expect(parseGraphForceSettings(null)).toEqual(defaultGraphForceSettings);
    expect(parseGraphForceSettings('junk')).toEqual(defaultGraphForceSettings);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/graph/graphSettings.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/domain/graph/graphSettings.ts`:

```ts
export interface GraphForceSettings {
  centerStrength: number;
  repelStrength: number;
  linkStrength: number;
  linkDistance: number;
}

export const defaultGraphForceSettings: GraphForceSettings = {
  centerStrength: 0.5,
  repelStrength: 10,
  linkStrength: 1,
  linkDistance: 250
};

export function parseGraphForceSettings(raw: unknown): GraphForceSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    centerStrength: finiteOr(source.centerStrength, defaultGraphForceSettings.centerStrength),
    repelStrength: finiteOr(source.repelStrength, defaultGraphForceSettings.repelStrength),
    linkStrength: finiteOr(source.linkStrength, defaultGraphForceSettings.linkStrength),
    linkDistance: finiteOr(source.linkDistance, defaultGraphForceSettings.linkDistance)
  };
}

function finiteOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/domain/graph/graphSettings.test.ts`
Expected: PASS 4건

- [ ] **Step 5: 커밋**

```bash
git add src/domain/graph/graphSettings.ts src/domain/graph/graphSettings.test.ts
git commit -m "$(cat <<'EOF'
그래프 포스 설정 파서를 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 그래프 모델 빌더

파일 목록 + 파일별 위키링크 → 노드/엣지. 순수 함수.

**Files:**
- Create: `src/domain/graph/graphModel.ts`
- Create: `src/domain/graph/graphModel.test.ts`

**Interfaces:**
- Consumes: `findWikiLinkTarget` (Task 1), `VaultFile`
- Produces: `GraphNode { id: string; title: string; path: string; degree: number }`, `GraphEdge { sourceId: string; targetId: string }`, `GraphModel { nodes: GraphNode[]; edges: GraphEdge[] }`, `buildGraphModel(files: VaultFile[], wikiLinksByFileId: Map<string, string[]>): GraphModel` — Task 8, 9가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/graph/graphModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { VaultFile } from '../vault/types';
import { buildGraphModel } from './graphModel';

function file(id: string, title: string, path: string): VaultFile {
  return {
    id,
    title,
    path,
    name: `${title}.md`,
    parentId: 'folder-root',
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-09T00:00:00.000Z'
  };
}

const files = [
  file('file-a', 'Alpha', 'Alpha.md'),
  file('file-b', 'Beta', 'Beta.md'),
  file('file-c', 'Gamma', 'Notes/Gamma.md')
];

describe('buildGraphModel', () => {
  it('제목과 경로로 링크를 해석해 엣지를 만든다', () => {
    const model = buildGraphModel(
      files,
      new Map([['file-a', ['beta', 'Notes/Gamma']]])
    );
    expect(model.edges).toEqual([
      { sourceId: 'file-a', targetId: 'file-b' },
      { sourceId: 'file-a', targetId: 'file-c' }
    ]);
  });

  it('미해결 링크와 자기 링크는 버린다', () => {
    const model = buildGraphModel(files, new Map([['file-a', ['Nowhere', 'Alpha']]]));
    expect(model.edges).toEqual([]);
  });

  it('같은 쌍의 중복·역방향 링크는 하나로 합친다', () => {
    const model = buildGraphModel(
      files,
      new Map([
        ['file-a', ['Beta', 'Beta']],
        ['file-b', ['Alpha']]
      ])
    );
    expect(model.edges).toHaveLength(1);
  });

  it('고아 노드도 degree 0으로 포함한다', () => {
    const model = buildGraphModel(files, new Map([['file-a', ['Beta']]]));
    expect(model.nodes).toHaveLength(3);
    const degrees = Object.fromEntries(model.nodes.map((node) => [node.id, node.degree]));
    expect(degrees).toEqual({ 'file-a': 1, 'file-b': 1, 'file-c': 0 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/graph/graphModel.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/domain/graph/graphModel.ts`:

```ts
import type { VaultFile } from '../vault/types';
import { findWikiLinkTarget } from '../vault/wikiLinkResolution';

export interface GraphNode {
  id: string;
  title: string;
  path: string;
  degree: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraphModel(files: VaultFile[], wikiLinksByFileId: Map<string, string[]>): GraphModel {
  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];
  const degrees = new Map<string, number>();

  for (const source of files) {
    for (const target of wikiLinksByFileId.get(source.id) ?? []) {
      // ponytail: 링크마다 O(files) 선형 탐색 — 수백 노트 규모에선 충분, 수만 링크가 되면 조회 맵 도입
      const targetFile = findWikiLinkTarget(files, target);
      if (!targetFile || targetFile.id === source.id) {
        continue;
      }
      const key = [source.id, targetFile.id].sort().join('->');
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push({ sourceId: source.id, targetId: targetFile.id });
      degrees.set(source.id, (degrees.get(source.id) ?? 0) + 1);
      degrees.set(targetFile.id, (degrees.get(targetFile.id) ?? 0) + 1);
    }
  }

  return {
    nodes: files.map((file) => ({
      id: file.id,
      title: file.title,
      path: file.path,
      degree: degrees.get(file.id) ?? 0
    })),
    edges
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/domain/graph/graphModel.test.ts`
Expected: PASS 4건

- [ ] **Step 5: 커밋**

```bash
git add src/domain/graph/graphModel.ts src/domain/graph/graphModel.test.ts
git commit -m "$(cat <<'EOF'
위키링크로 그래프 노드와 엣지를 만드는 모델을 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 링크 캐시 스토어 (IndexedDB)

파일별 위키링크 캐시. `draftStore.ts` 패턴 복제. **주의: 기존 `drive-obsidian-editor` DB가 아니라 별도 DB `drive-obsidian-graph`** — 같은 DB에 스토어를 추가하면 버전 충돌.

**Files:**
- Create: `src/storage/graphLinkStore.ts`
- Create: `src/storage/graphLinkStore.test.ts`

**Interfaces:**
- Produces: `GraphLinkRecord { vaultRootId: string; fileId: string; modifiedTime: string; wikiLinks: string[] }`, `GraphLinkStore { getAll(vaultRootId: string): Promise<GraphLinkRecord[]>; putMany(records: GraphLinkRecord[]): Promise<void> }`, `IndexedDbGraphLinkStore implements GraphLinkStore` — Task 5, 9가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`src/storage/graphLinkStore.test.ts`:

```ts
import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { IndexedDbGraphLinkStore } from './graphLinkStore';

function record(vaultRootId: string, fileId: string, wikiLinks: string[] = []) {
  return { vaultRootId, fileId, modifiedTime: '2026-07-09T00:00:00.000Z', wikiLinks };
}

describe('IndexedDbGraphLinkStore', () => {
  it('저장한 레코드를 vault 단위로 다시 읽는다', async () => {
    const store = new IndexedDbGraphLinkStore('graph-test-roundtrip');
    await store.putMany([record('root-1', 'file-a', ['Beta']), record('root-1', 'file-b')]);

    const records = await store.getAll('root-1');
    expect(records).toHaveLength(2);
    expect(records.find((entry) => entry.fileId === 'file-a')?.wikiLinks).toEqual(['Beta']);
  });

  it('다른 vault의 레코드는 섞이지 않는다', async () => {
    const store = new IndexedDbGraphLinkStore('graph-test-isolation');
    await store.putMany([record('root-1', 'file-a'), record('root-2', 'file-b')]);

    expect(await store.getAll('root-1')).toHaveLength(1);
  });

  it('같은 파일을 다시 저장하면 덮어쓴다', async () => {
    const store = new IndexedDbGraphLinkStore('graph-test-overwrite');
    await store.putMany([record('root-1', 'file-a', ['Old'])]);
    await store.putMany([record('root-1', 'file-a', ['New'])]);

    const records = await store.getAll('root-1');
    expect(records).toHaveLength(1);
    expect(records[0].wikiLinks).toEqual(['New']);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/storage/graphLinkStore.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/storage/graphLinkStore.ts`:

```ts
export interface GraphLinkRecord {
  vaultRootId: string;
  fileId: string;
  modifiedTime: string;
  wikiLinks: string[];
}

export interface GraphLinkStore {
  getAll(vaultRootId: string): Promise<GraphLinkRecord[]>;
  putMany(records: GraphLinkRecord[]): Promise<void>;
}

const storeName = 'links';

export class IndexedDbGraphLinkStore implements GraphLinkStore {
  constructor(private readonly databaseName = 'drive-obsidian-graph') {}

  async getAll(vaultRootId: string): Promise<GraphLinkRecord[]> {
    const db = await this.open();
    const range = IDBKeyRange.bound(`${vaultRootId}:`, `${vaultRootId}:￿`);
    const records = await requestToPromise<GraphLinkRecord[]>(
      transactionStore(db, 'readonly').getAll(range)
    );
    db.close();
    return records;
  }

  async putMany(records: GraphLinkRecord[]): Promise<void> {
    const db = await this.open();
    const store = transactionStore(db, 'readwrite');
    await Promise.all(
      records.map((record) => requestToPromise(store.put(record, recordKey(record))))
    );
    db.close();
  }

  private open(): Promise<IDBDatabase> {
    const request = indexedDB.open(this.databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    return requestToPromise(request);
  }
}

function recordKey(record: GraphLinkRecord) {
  return `${record.vaultRootId}:${record.fileId}`;
}

function transactionStore(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/storage/graphLinkStore.test.ts`
Expected: PASS 3건

- [ ] **Step 5: 커밋**

```bash
git add src/storage/graphLinkStore.ts src/storage/graphLinkStore.test.ts
git commit -m "$(cat <<'EOF'
그래프 링크 캐시용 IndexedDB 스토어를 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: vault 링크 스캐너

vault 전체를 BFS로 훑어 md 목록을 만들고, 캐시와 modifiedTime을 대조해 변경분만 본문을 받아 위키링크를 추출한다. 동시성 6, 진행률 콜백, 중단 플래그, 부분 실패 허용.

**Files:**
- Create: `src/app/graphScanner.ts`
- Create: `src/app/graphScanner.test.ts`

**Interfaces:**
- Consumes: `extractMarkdownMetadata` (`src/domain/markdown/markdownMetadata.ts`), `GraphLinkStore`/`GraphLinkRecord` (Task 4), `VaultFile`/`VaultFolder`
- Produces:

```ts
interface GraphScanDeps {
  vaultRootId: string;
  listFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  listMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  readFileContent(fileId: string): Promise<string>;
  store: GraphLinkStore;
  onProgress?(done: number, total: number): void;
  isCancelled?(): boolean;
  concurrency?: number;
}
interface GraphScanResult {
  files: VaultFile[];
  wikiLinksByFileId: Map<string, string[]>;
  failedFileIds: string[];
  cancelled: boolean;
}
scanVaultLinks(deps: GraphScanDeps): Promise<GraphScanResult>
```

Task 9(GraphView)가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/graphScanner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import type { VaultFile, VaultFolder } from '../domain/vault/types';
import type { GraphLinkRecord, GraphLinkStore } from '../storage/graphLinkStore';
import { scanVaultLinks } from './graphScanner';

function file(id: string, title: string, path: string, parentId = 'root-1'): VaultFile {
  return {
    id,
    title,
    path,
    name: `${title}.md`,
    parentId,
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-07-09T00:00:00.000Z'
  };
}

function folder(id: string, name: string, path: string): VaultFolder {
  return {
    id,
    name,
    path,
    parentId: 'root-1',
    kind: 'folder',
    mimeType: 'application/vnd.google-apps.folder',
    modifiedTime: '2026-07-09T00:00:00.000Z'
  };
}

function memoryStore(seed: GraphLinkRecord[] = []): GraphLinkStore {
  const records = new Map(seed.map((record) => [`${record.vaultRootId}:${record.fileId}`, record]));
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

const rootFiles = [file('file-a', 'Alpha', 'Alpha.md')];
const nestedFiles = [file('file-b', 'Beta', 'Notes/Beta.md', 'folder-notes')];

function listDeps() {
  return {
    listFolders: vi.fn(async (parentFolderId: string) =>
      parentFolderId === 'root-1' ? [folder('folder-notes', 'Notes', 'Notes')] : []
    ),
    listMarkdownFiles: vi.fn(async (parentFolderId: string) => {
      if (parentFolderId === 'root-1') return rootFiles;
      if (parentFolderId === 'folder-notes') return nestedFiles;
      return [];
    })
  };
}

describe('scanVaultLinks', () => {
  it('하위 폴더까지 훑어 링크를 추출하고 캐시에 남긴다', async () => {
    const store = memoryStore();
    const readFileContent = vi.fn(async (fileId: string) => (fileId === 'file-a' ? '[[Beta]] 본문' : '링크 없음'));

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store
    });

    expect(result.files.map((entry) => entry.id).sort()).toEqual(['file-a', 'file-b']);
    expect(result.wikiLinksByFileId.get('file-a')).toEqual(['Beta']);
    expect(result.failedFileIds).toEqual([]);
    expect(await store.getAll('root-1')).toHaveLength(2);
  });

  it('modifiedTime이 같은 파일은 다시 받지 않는다', async () => {
    const store = memoryStore([
      { vaultRootId: 'root-1', fileId: 'file-a', modifiedTime: '2026-07-09T00:00:00.000Z', wikiLinks: ['Beta'] },
      { vaultRootId: 'root-1', fileId: 'file-b', modifiedTime: '2026-07-09T00:00:00.000Z', wikiLinks: [] }
    ]);
    const readFileContent = vi.fn();

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store
    });

    expect(readFileContent).not.toHaveBeenCalled();
    expect(result.wikiLinksByFileId.get('file-a')).toEqual(['Beta']);
  });

  it('개별 파일 실패는 건너뛰고 옛 캐시를 쓴다', async () => {
    const store = memoryStore([
      { vaultRootId: 'root-1', fileId: 'file-a', modifiedTime: '2026-01-01T00:00:00.000Z', wikiLinks: ['Beta'] }
    ]);
    const readFileContent = vi.fn(async (fileId: string) => {
      if (fileId === 'file-a') throw new Error('rate limited');
      return '';
    });

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store
    });

    expect(result.failedFileIds).toEqual(['file-a']);
    expect(result.wikiLinksByFileId.get('file-a')).toEqual(['Beta']);
    expect(result.wikiLinksByFileId.get('file-b')).toEqual([]);
  });

  it('중단 플래그가 서면 남은 파일을 받지 않는다', async () => {
    let calls = 0;
    const readFileContent = vi.fn(async () => {
      calls += 1;
      return '';
    });

    const result = await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent,
      store: memoryStore(),
      concurrency: 1,
      isCancelled: () => calls >= 1
    });

    expect(result.cancelled).toBe(true);
    expect(readFileContent).toHaveBeenCalledTimes(1);
  });

  it('진행률을 보고한다', async () => {
    const onProgress = vi.fn();

    await scanVaultLinks({
      vaultRootId: 'root-1',
      ...listDeps(),
      readFileContent: async () => '',
      store: memoryStore(),
      onProgress
    });

    expect(onProgress).toHaveBeenCalledWith(0, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/app/graphScanner.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/app/graphScanner.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/graphScanner.test.ts`
Expected: PASS 5건

- [ ] **Step 5: 커밋**

```bash
git add src/app/graphScanner.ts src/app/graphScanner.test.ts
git commit -m "$(cat <<'EOF'
vault 전체 링크를 증분 스캔하는 스캐너를 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Drive에서 .obsidian/graph.json 읽기

Drive 클라이언트에 폴더 내 파일명 조회를 추가하고, 어댑터와 워크스페이스 로더에 graph.json 읽기 + 파일 본문 읽기를 노출한다.

**Files:**
- Modify: `src/integrations/google/googleDriveClient.ts` (인터페이스에 `findFileInFolder` 추가)
- Modify: `src/integrations/google/httpGoogleDriveClient.ts` (구현 추가)
- Modify: `src/integrations/google/httpGoogleDriveClient.test.ts` (테스트 추가)
- Modify: `src/integrations/google/driveVaultAdapter.ts` (`readGraphSettings` 추가)
- Modify: `src/integrations/google/driveVaultAdapter.test.ts` (mock 팩토리 갱신 + 테스트 추가)
- Modify: `src/app/driveWorkspaceLoader.ts` (`readFileContent`, `loadGraphSettings` 노출)

**Interfaces:**
- Produces: `GoogleDriveClient.findFileInFolder(folderId: string, name: string): Promise<GoogleDriveFile | null>`, `DriveVaultAdapter.readGraphSettings(rootFolderId: string): Promise<unknown>`, `DriveWorkspace.readFileContent(fileId: string): Promise<string>`, `DriveWorkspace.loadGraphSettings(): Promise<unknown>` — Task 9, 10이 사용

- [ ] **Step 1: http 클라이언트 실패 테스트 작성**

`src/integrations/google/httpGoogleDriveClient.test.ts`에 기존 it 블록들 옆에 추가 (파일 하단의 `jsonResponse` 헬퍼 재사용):

```ts
  it('폴더 안에서 정확한 이름의 파일을 찾는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ files: [{ id: 'file-graph', name: 'graph.json', mimeType: 'application/json', modifiedTime: '2026-07-09T00:00:00.000Z' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const found = await new HttpGoogleDriveClient('access-token').findFileInFolder('folder-obsidian', 'graph.json');

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get('q')).toBe(
      "'folder-obsidian' in parents and name = 'graph.json' and trashed = false"
    );
    expect(found?.id).toBe('file-graph');
  });

  it('폴더에 파일이 없으면 null을 돌려준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ files: [] })));

    const found = await new HttpGoogleDriveClient('access-token').findFileInFolder('folder-obsidian', 'graph.json');

    expect(found).toBeNull();
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/integrations/google/httpGoogleDriveClient.test.ts`
Expected: FAIL — `findFileInFolder is not a function` (타입 에러 포함)

- [ ] **Step 3: 인터페이스 + http 구현**

`src/integrations/google/googleDriveClient.ts`의 `GoogleDriveClient` 인터페이스에서 `downloadText` 선언 위에 추가:

```ts
  findFileInFolder(folderId: string, name: string): Promise<GoogleDriveFile | null>;
```

`src/integrations/google/httpGoogleDriveClient.ts`의 `searchByName` 메서드 뒤에 추가 (기존 `escapeDriveQueryValue`, `driveBaseUrl`, `this.request` 그대로 사용):

```ts
  async findFileInFolder(folderId: string, name: string): Promise<GoogleDriveFile | null> {
    const params = new URLSearchParams({
      q: `'${escapeDriveQueryValue(folderId)}' in parents and name = '${escapeDriveQueryValue(name)}' and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime, parents)',
      pageSize: '1'
    });

    const response = await this.request<GoogleDriveListResponse>(`${driveBaseUrl}?${params.toString()}`);
    return response.files[0] ?? null;
  }
```

주의: `this.request`가 제네릭이 아니면 기존 메서드들이 반환 타입을 어떻게 얻는지 파일에서 확인해 같은 방식을 따른다.

- [ ] **Step 4: http 테스트 통과 확인**

Run: `npx vitest run src/integrations/google/httpGoogleDriveClient.test.ts`
Expected: PASS (신규 2건 포함)

- [ ] **Step 5: 어댑터 실패 테스트 작성**

`src/integrations/google/driveVaultAdapter.test.ts`의 `client()` 팩토리에 한 줄 추가:

```ts
    findFileInFolder: vi.fn().mockResolvedValue(null),
```

테스트 추가 (기존 describe 안, `drafts()` 등 기존 헬퍼 스타일 확인 후 동일하게):

```ts
  it('.obsidian/graph.json을 읽어 파싱한다', async () => {
    const drive = client({
      listFolders: vi.fn().mockResolvedValue({
        files: [
          {
            id: 'folder-obsidian',
            name: '.obsidian',
            mimeType: 'application/vnd.google-apps.folder',
            modifiedTime: '2026-07-09T00:00:00.000Z'
          }
        ]
      }),
      findFileInFolder: vi.fn().mockResolvedValue({
        id: 'file-graph',
        name: 'graph.json',
        mimeType: 'application/json',
        modifiedTime: '2026-07-09T00:00:00.000Z'
      }),
      downloadText: vi.fn().mockResolvedValue('{"repelStrength": 12}')
    });
    const adapter = new DriveVaultAdapter(drive, await drafts());

    expect(await adapter.readGraphSettings('root-1')).toEqual({ repelStrength: 12 });
  });

  it('.obsidian 폴더가 없으면 null', async () => {
    const adapter = new DriveVaultAdapter(client(), await drafts());
    expect(await adapter.readGraphSettings('root-1')).toBeNull();
  });

  it('graph.json이 깨진 JSON이면 null', async () => {
    const drive = client({
      listFolders: vi.fn().mockResolvedValue({
        files: [
          {
            id: 'folder-obsidian',
            name: '.obsidian',
            mimeType: 'application/vnd.google-apps.folder',
            modifiedTime: '2026-07-09T00:00:00.000Z'
          }
        ]
      }),
      findFileInFolder: vi.fn().mockResolvedValue({
        id: 'file-graph',
        name: 'graph.json',
        mimeType: 'application/json',
        modifiedTime: '2026-07-09T00:00:00.000Z'
      }),
      downloadText: vi.fn().mockResolvedValue('not json')
    });
    const adapter = new DriveVaultAdapter(drive, await drafts());

    expect(await adapter.readGraphSettings('root-1')).toBeNull();
  });
```

주의: 기존 테스트 파일의 `DraftStore` 생성 방식(`drafts()` 헬퍼가 없으면 파일 내 실제 패턴)을 그대로 따른다.

- [ ] **Step 6: 어댑터 구현**

`src/integrations/google/driveVaultAdapter.ts`의 `readFile` 메서드 뒤에 추가:

```ts
  async readGraphSettings(rootFolderId: string): Promise<unknown> {
    try {
      const folders = await this.listFolders(rootFolderId);
      const obsidianFolder = folders.find((folder) => folder.name === '.obsidian');
      if (!obsidianFolder) {
        return null;
      }
      const file = await this.drive.findFileInFolder(obsidianFolder.id, 'graph.json');
      if (!file) {
        return null;
      }
      return JSON.parse(await this.drive.downloadText(file.id));
    } catch {
      return null;
    }
  }
```

- [ ] **Step 7: 어댑터 테스트 통과 확인**

Run: `npx vitest run src/integrations/google/driveVaultAdapter.test.ts`
Expected: PASS (신규 3건 포함)

- [ ] **Step 8: 로더에 노출**

`src/app/driveWorkspaceLoader.ts`:

`DriveWorkspace` 인터페이스의 `loadFile` 선언 아래 추가:

```ts
  readFileContent(fileId: string): Promise<string>;
  loadGraphSettings(): Promise<unknown>;
```

반환 객체의 `prefetchFile` 아래 추가:

```ts
    readFileContent: (fileId) => adapter.readFile(fileId),
    loadGraphSettings: () => adapter.readGraphSettings(root.id),
```

- [ ] **Step 9: 전체 테스트 + 타입 확인**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS (다른 테스트의 mock GoogleDriveClient가 `Partial`이 아닌 곳에서 타입 에러가 나면 그 mock에도 `findFileInFolder: vi.fn().mockResolvedValue(null)` 추가)

- [ ] **Step 10: 커밋**

```bash
git add src/integrations/google src/app/driveWorkspaceLoader.ts
git commit -m "$(cat <<'EOF'
Drive에서 .obsidian/graph.json을 읽는 경로를 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: workspaceReducer에 viewMode 추가

**Files:**
- Modify: `src/ui/state/workspaceReducer.ts`
- Modify: `src/ui/state/workspaceReducer.test.ts`

**Interfaces:**
- Produces: `WorkspaceState.viewMode: 'editor' | 'graph'`, 액션 `{ type: 'viewModeChanged'; viewMode: 'editor' | 'graph' }`. `documentOpened`는 항상 `viewMode: 'editor'`로 되돌린다 (그래프 노드 클릭 → 문서 열림 → 에디터 복귀가 이 규칙 하나로 처리됨) — Task 10이 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/state/workspaceReducer.test.ts`에 추가 (기존 테스트의 fixture 사용 방식을 따르고, `documentOpened` 테스트에 쓰는 기존 fixture를 재사용):

```ts
  it('viewModeChanged로 그래프 뷰를 켜고 끈다', () => {
    const opened = workspaceReducer(createInitialWorkspaceState(), {
      type: 'viewModeChanged',
      viewMode: 'graph'
    });
    expect(opened.viewMode).toBe('graph');

    const closed = workspaceReducer(opened, { type: 'viewModeChanged', viewMode: 'editor' });
    expect(closed.viewMode).toBe('editor');
  });

  it('초기 상태는 에디터 뷰다', () => {
    expect(createInitialWorkspaceState().viewMode).toBe('editor');
  });
```

그리고 문서 열림 복귀 테스트 — 파일 상단에 이미 import된 `fixtureVaultRoot`, `fixtureFiles` 재사용:

```ts
  it('문서를 열면 에디터 뷰로 돌아온다', () => {
    const inGraph = workspaceReducer(createInitialWorkspaceState(), {
      type: 'viewModeChanged',
      viewMode: 'graph'
    });
    const opened = workspaceReducer(inGraph, {
      type: 'documentOpened',
      root: fixtureVaultRoot,
      files: fixtureFiles,
      document: {
        file: fixtureFiles[0],
        content: '# Home',
        baselineModifiedTime: fixtureFiles[0].modifiedTime
      }
    });
    expect(opened.viewMode).toBe('editor');
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/state/workspaceReducer.test.ts`
Expected: FAIL — `viewMode` 없음

- [ ] **Step 3: 구현**

`src/ui/state/workspaceReducer.ts`:

`WorkspaceState`에 추가:

```ts
  viewMode: 'editor' | 'graph';
```

`WorkspaceAction` 유니온에 추가:

```ts
  | { type: 'viewModeChanged'; viewMode: 'editor' | 'graph' }
```

`createInitialWorkspaceState` 반환 객체에 `viewMode: 'editor',` 추가.

reducer의 `documentOpened` case 반환 객체에 `viewMode: 'editor',` 추가 (이 case는 state 스프레드 없이 새 객체를 만들므로 필수).

switch에 case 추가:

```ts
    case 'viewModeChanged':
      return { ...state, viewMode: action.viewMode };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/ui/state/workspaceReducer.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/ui/state/workspaceReducer.ts src/ui/state/workspaceReducer.test.ts
git commit -m "$(cat <<'EOF'
워크스페이스에 에디터/그래프 뷰 모드를 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 의존성 설치 + pixi/d3 그래프 렌더러

명령형 렌더러 코어. **이 태스크만 단위 테스트 없음** — jsdom에 WebGL이 없다. 검증은 typecheck + Task 10의 dev 서버 육안 확인.

**Files:**
- Modify: `package.json` (의존성)
- Create: `src/ui/graph/graphRenderer.ts`

**Interfaces:**
- Consumes: `GraphModel`, `GraphNode` (Task 3), `GraphForceSettings` (Task 2)
- Produces:

```ts
interface GraphRendererOptions { forces: GraphForceSettings; onNodeClick(nodeId: string): void; }
interface GraphRendererHandle { setForces(forces: GraphForceSettings): void; setSearch(query: string): void; destroy(): void; }
createGraphRenderer(container: HTMLElement, model: GraphModel, options: GraphRendererOptions): Promise<GraphRendererHandle>
```

Task 9가 dynamic import로 사용.

- [ ] **Step 1: 의존성 설치**

```bash
npm install pixi.js d3-force d3-zoom d3-drag d3-selection
npm install -D @types/d3-force @types/d3-zoom @types/d3-drag @types/d3-selection
```

Expected: package.json dependencies에 5개, devDependencies에 4개 추가

- [ ] **Step 2: 렌더러 구현**

`src/ui/graph/graphRenderer.ts` (이 파일만 pixi/d3를 정적 import — 호출자는 반드시 `import()`로 이 모듈을 로드해야 lazy 청크가 유지된다):

```ts
import { drag } from 'd3-drag';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

import type { GraphModel, GraphNode } from '../../domain/graph/graphModel';
import type { GraphForceSettings } from '../../domain/graph/graphSettings';

export interface GraphRendererOptions {
  forces: GraphForceSettings;
  onNodeClick(nodeId: string): void;
}

export interface GraphRendererHandle {
  setForces(forces: GraphForceSettings): void;
  setSearch(query: string): void;
  destroy(): void;
}

interface SimNode extends GraphNode, SimulationNodeDatum {}

interface NodeVisual {
  node: SimNode;
  holder: Container;
  circle: Graphics;
  label: Text;
}

const labelZoomThreshold = 1.2;

export async function createGraphRenderer(
  container: HTMLElement,
  model: GraphModel,
  options: GraphRendererOptions
): Promise<GraphRendererHandle> {
  const colors = {
    node: cssColor('--color-lavender', '#a78bfa'),
    nodeHighlight: cssColor('--color-amethyst', '#7c3aed'),
    line: cssColor('--color-graphite', '#3f3f3f'),
    label: cssColor('--color-bright-gray', '#eeeeee')
  };

  const app = new Application();
  await app.init({ backgroundAlpha: 0, antialias: true, resizeTo: container });
  app.ticker.stop();
  container.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);
  const linkGraphics = new Graphics();
  world.addChild(linkGraphics);

  const simNodes: SimNode[] = model.nodes.map((node) => ({ ...node }));
  const simLinks = model.edges.map((edge) => ({ source: edge.sourceId, target: edge.targetId }));
  const neighborIds = buildNeighborIds(model);

  const labelStyle = new TextStyle({
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 11,
    fill: colors.label
  });

  const visuals: NodeVisual[] = simNodes.map((node) => {
    const radius = nodeRadius(node);
    const circle = new Graphics().circle(0, 0, radius).fill(0xffffff);
    circle.tint = colors.node;
    const label = new Text({ text: node.title, style: labelStyle, resolution: 2 });
    label.anchor.set(0.5, 0);
    label.y = radius + 4;
    label.alpha = 0;
    const holder = new Container();
    holder.addChild(circle);
    holder.addChild(label);
    world.addChild(holder);
    return { node, holder, circle, label };
  });

  let transform: ZoomTransform = zoomIdentity;
  let hoveredId: string | null = null;
  let searchQuery = '';

  function applyStyles() {
    const query = searchQuery.trim().toLocaleLowerCase();
    const hoveredNeighbors = hoveredId ? neighborIds.get(hoveredId) : undefined;
    for (const visual of visuals) {
      const matchesSearch = !query || visual.node.title.toLocaleLowerCase().includes(query);
      const isHovered = hoveredId === visual.node.id;
      const isNeighbor = Boolean(hoveredNeighbors?.has(visual.node.id));
      let alpha = matchesSearch ? 1 : 0.15;
      if (hoveredId && !isHovered && !isNeighbor) {
        alpha = Math.min(alpha, 0.2);
      }
      visual.holder.alpha = alpha;
      visual.circle.tint = isHovered ? colors.nodeHighlight : colors.node;
      visual.label.alpha = isHovered || isNeighbor || transform.k > labelZoomThreshold ? 1 : 0;
    }
  }

  function render() {
    for (const visual of visuals) {
      visual.holder.position.set(visual.node.x ?? 0, visual.node.y ?? 0);
    }
    linkGraphics.clear();
    for (const link of simLinks) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      const dimmed = hoveredId !== null && source.id !== hoveredId && target.id !== hoveredId;
      linkGraphics
        .moveTo(source.x ?? 0, source.y ?? 0)
        .lineTo(target.x ?? 0, target.y ?? 0)
        .stroke({ width: 1, color: colors.line, alpha: dimmed ? 0.15 : 0.5 });
    }
    app.render();
  }

  const sim = forceSimulation(simNodes)
    .force('link', forceLink(simLinks).id((node) => (node as SimNode).id))
    .force('charge', forceManyBody())
    .force('center', forceCenter(container.clientWidth / 2, container.clientHeight / 2))
    .force(
      'collide',
      forceCollide<SimNode>().radius((node) => nodeRadius(node) + 4)
    )
    .on('tick', render);

  function applyForces(forces: GraphForceSettings) {
    (sim.force('center') as ReturnType<typeof forceCenter>).strength(forces.centerStrength);
    (sim.force('charge') as ReturnType<typeof forceManyBody<SimNode>>).strength(-30 * forces.repelStrength);
    (sim.force('link') as ReturnType<typeof forceLink<SimNode, (typeof simLinks)[number]>>)
      .distance(forces.linkDistance)
      .strength(forces.linkStrength);
  }
  applyForces(options.forces);
  sim.alpha(1).restart();

  function findNodeAt(worldX: number, worldY: number): SimNode | null {
    let closest: SimNode | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const node of simNodes) {
      const distance = Math.hypot((node.x ?? 0) - worldX, (node.y ?? 0) - worldY);
      if (distance < nodeRadius(node) + 3 && distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    }
    return closest;
  }

  function hitTest(clientX: number, clientY: number): SimNode | null {
    const rect = app.canvas.getBoundingClientRect();
    const [worldX, worldY] = transform.invert([clientX - rect.left, clientY - rect.top]);
    return findNodeAt(worldX, worldY);
  }

  const canvasSelection = select(app.canvas);

  const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.1, 4])
    .filter((event: MouseEvent | WheelEvent) => {
      if (event.type === 'wheel') {
        return true;
      }
      return hitTest(event.clientX, event.clientY) === null;
    })
    .on('zoom', (event) => {
      transform = event.transform;
      world.position.set(transform.x, transform.y);
      world.scale.set(transform.k);
      applyStyles();
      render();
    });
  canvasSelection.call(zoomBehavior);

  const dragBehavior = drag<HTMLCanvasElement, unknown>()
    .container(app.canvas)
    .subject((event) => {
      const [worldX, worldY] = transform.invert([event.x, event.y]);
      return findNodeAt(worldX, worldY) ?? undefined;
    })
    .on('start', (event) => {
      const node = event.subject as SimNode;
      node.fx = node.x;
      node.fy = node.y;
      sim.alphaTarget(0.3).restart();
    })
    .on('drag', (event) => {
      const node = event.subject as SimNode;
      const [worldX, worldY] = transform.invert([event.x, event.y]);
      node.fx = worldX;
      node.fy = worldY;
    })
    .on('end', (event) => {
      const node = event.subject as SimNode;
      node.fx = null;
      node.fy = null;
      sim.alphaTarget(0);
    });
  canvasSelection.call(dragBehavior);

  function handlePointerMove(event: PointerEvent) {
    const node = hitTest(event.clientX, event.clientY);
    const nextId = node?.id ?? null;
    if (nextId !== hoveredId) {
      hoveredId = nextId;
      app.canvas.style.cursor = node ? 'pointer' : 'default';
      applyStyles();
      render();
    }
  }

  function handleClick(event: MouseEvent) {
    const node = hitTest(event.clientX, event.clientY);
    if (node) {
      options.onNodeClick(node.id);
    }
  }

  app.canvas.addEventListener('pointermove', handlePointerMove);
  app.canvas.addEventListener('click', handleClick);

  const resizeObserver = new ResizeObserver(() => {
    (sim.force('center') as ReturnType<typeof forceCenter>)
      .x(container.clientWidth / 2)
      .y(container.clientHeight / 2);
    render();
  });
  resizeObserver.observe(container);

  return {
    setForces(forces) {
      applyForces(forces);
      sim.alpha(0.5).restart();
    },
    setSearch(query) {
      searchQuery = query;
      applyStyles();
      render();
    },
    destroy() {
      resizeObserver.disconnect();
      sim.stop();
      canvasSelection.on('.zoom', null).on('.drag', null);
      app.canvas.removeEventListener('pointermove', handlePointerMove);
      app.canvas.removeEventListener('click', handleClick);
      app.destroy(true, { children: true, texture: true });
    }
  };
}

function nodeRadius(node: GraphNode) {
  return 4 + 2 * Math.sqrt(node.degree);
}

function buildNeighborIds(model: GraphModel) {
  const neighborIds = new Map<string, Set<string>>();
  for (const edge of model.edges) {
    ensure(neighborIds, edge.sourceId).add(edge.targetId);
    ensure(neighborIds, edge.targetId).add(edge.sourceId);
  }
  return neighborIds;
}

function ensure(map: Map<string, Set<string>>, key: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
}

function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
```

주의사항:
- d3 force accessor의 제네릭 캐스팅이 strict 모드에서 안 맞으면 `as unknown as` 대신 해당 force 변수를 지역 상수로 뽑아 타입을 명시한다 (예: `const linkForce = forceLink<SimNode, { source: string | SimNode; target: string | SimNode }>(simLinks)`). 컴파일이 우선, 런타임 동작은 동일.
- 색상은 생성 시점에 한 번 읽는다. 그래프 열린 채 테마 전환 시 색이 안 바뀌는 건 알려진 v1 제약 (`// ponytail: 테마 색은 생성 시점 스냅샷 — 전환 시 그래프 재열림으로 충분`이라고 주석).

- [ ] **Step 3: 타입 확인**

Run: `npm run typecheck`
Expected: PASS. 실패하면 위 주의사항의 캐스팅 방식으로 수정.

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json src/ui/graph/graphRenderer.ts
git commit -m "$(cat <<'EOF'
d3-force와 pixi.js 기반 그래프 렌더러를 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: GraphView 컴포넌트 + i18n + 스타일

스캔 진행률 → 렌더러 마운트 → 검색/슬라이더 UI. 렌더러는 mock으로 테스트.

**Files:**
- Create: `src/ui/graph/GraphView.tsx`
- Create: `src/ui/graph/GraphView.test.tsx`
- Modify: `src/i18n/messages.ts` (`ko`와 `en` 양쪽에 graph.* 키)
- Modify: `src/styles.css` (그래프 뷰 스타일)

**Interfaces:**
- Consumes: `scanVaultLinks` (Task 5), `buildGraphModel` (Task 3), `parseGraphForceSettings`/`defaultGraphForceSettings` (Task 2), `IndexedDbGraphLinkStore`/`GraphLinkStore` (Task 4), `createGraphRenderer` (Task 8, dynamic import)
- Produces:

```ts
interface GraphViewProps {
  root: VaultRoot;
  loadFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  loadMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  readFileContent(fileId: string): Promise<string>;
  loadGraphSettings?(): Promise<unknown>;
  onOpenFile(file: VaultFile): void;
  linkStore?: GraphLinkStore;
}
export function GraphView(props: GraphViewProps)
```

Task 10이 사용.

- [ ] **Step 1: i18n 키 추가**

`src/i18n/messages.ts`의 `ko` 객체에 추가:

```ts
  'graph.scanning': '링크 스캔 중',
  'graph.readFailures': '일부 파일을 읽지 못했습니다',
  'graph.retry': '다시 시도',
  'graph.empty': '표시할 노트가 없습니다.',
  'graph.rendererFailed': '그래프를 그릴 수 없습니다. WebGL을 사용할 수 없는 환경입니다.',
  'graph.searchPlaceholder': '노트 검색',
  'graph.forces': '포스',
  'graph.centerStrength': '중심 강도',
  'graph.repelStrength': '반발 강도',
  'graph.linkStrength': '링크 강도',
  'graph.linkDistance': '링크 거리',
```

`en` 객체(145줄 부근, `Record<keyof typeof ko, string>` 타입이라 누락 시 컴파일 에러)에 추가:

```ts
  'graph.scanning': 'Scanning links',
  'graph.readFailures': 'Some files could not be read',
  'graph.retry': 'Retry',
  'graph.empty': 'No notes to show.',
  'graph.rendererFailed': 'Cannot render the graph. WebGL is unavailable.',
  'graph.searchPlaceholder': 'Search notes',
  'graph.forces': 'Forces',
  'graph.centerStrength': 'Center strength',
  'graph.repelStrength': 'Repel strength',
  'graph.linkStrength': 'Link strength',
  'graph.linkDistance': 'Link distance',
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/ui/graph/GraphView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VaultFile } from '../../domain/vault/types';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { GraphLinkStore } from '../../storage/graphLinkStore';
import { GraphView, type GraphViewProps } from './GraphView';

const rendererHandle = { setForces: vi.fn(), setSearch: vi.fn(), destroy: vi.fn() };
const createGraphRenderer = vi.fn(async () => rendererHandle);

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
});
```

주의: `I18nProvider`가 props 없이 렌더 안 되면 `src/ui/Workspace.test.tsx`의 래핑 방식을 그대로 따른다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/ui/graph/GraphView.test.tsx`
Expected: FAIL — GraphView 모듈 없음

- [ ] **Step 4: 구현**

`src/ui/graph/GraphView.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';

import { scanVaultLinks } from '../../app/graphScanner';
import { buildGraphModel } from '../../domain/graph/graphModel';
import {
  defaultGraphForceSettings,
  parseGraphForceSettings,
  type GraphForceSettings
} from '../../domain/graph/graphSettings';
import type { VaultFile, VaultFolder, VaultRoot } from '../../domain/vault/types';
import { useI18n } from '../../i18n/I18nProvider';
import { IndexedDbGraphLinkStore, type GraphLinkStore } from '../../storage/graphLinkStore';
import type { GraphRendererHandle } from './graphRenderer';

const forceStorageKey = 'drive-obsidian-editor:graph-forces';

export interface GraphViewProps {
  root: VaultRoot;
  loadFolders(parentFolderId: string, parentPath: string): Promise<VaultFolder[]>;
  loadMarkdownFiles(parentFolderId: string, parentPath: string): Promise<VaultFile[]>;
  readFileContent(fileId: string): Promise<string>;
  loadGraphSettings?(): Promise<unknown>;
  onOpenFile(file: VaultFile): void;
  linkStore?: GraphLinkStore;
}

type GraphPhase = 'scanning' | 'ready' | 'empty' | 'rendererFailed';

interface ForceSliderConfig {
  key: keyof GraphForceSettings;
  labelKey: 'graph.centerStrength' | 'graph.repelStrength' | 'graph.linkStrength' | 'graph.linkDistance';
  min: number;
  max: number;
  step: number;
}

const forceSliders: ForceSliderConfig[] = [
  { key: 'centerStrength', labelKey: 'graph.centerStrength', min: 0, max: 1, step: 0.01 },
  { key: 'repelStrength', labelKey: 'graph.repelStrength', min: 0, max: 20, step: 0.5 },
  { key: 'linkStrength', labelKey: 'graph.linkStrength', min: 0, max: 2, step: 0.05 },
  { key: 'linkDistance', labelKey: 'graph.linkDistance', min: 30, max: 500, step: 10 }
];

export function GraphView({
  root,
  loadFolders,
  loadMarkdownFiles,
  readFileContent,
  loadGraphSettings,
  onOpenFile,
  linkStore
}: GraphViewProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<GraphPhase>('scanning');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failedCount, setFailedCount] = useState(0);
  const [forces, setForces] = useState<GraphForceSettings>(defaultGraphForceSettings);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GraphRendererHandle | null>(null);
  const filesRef = useRef(new Map<string, VaultFile>());

  useEffect(() => {
    let cancelled = false;
    const store = linkStore ?? new IndexedDbGraphLinkStore();

    async function openGraph() {
      setPhase('scanning');
      setFailedCount(0);

      const initialForces = await resolveInitialForces(loadGraphSettings);
      if (cancelled) {
        return;
      }
      setForces(initialForces);

      const scan = await scanVaultLinks({
        vaultRootId: root.id,
        listFolders: loadFolders,
        listMarkdownFiles: loadMarkdownFiles,
        readFileContent,
        store,
        onProgress: (done, total) => {
          if (!cancelled) {
            setProgress({ done, total });
          }
        },
        isCancelled: () => cancelled
      });
      if (cancelled) {
        return;
      }

      setFailedCount(scan.failedFileIds.length);
      filesRef.current = new Map(scan.files.map((entry) => [entry.id, entry]));
      if (scan.files.length === 0) {
        setPhase('empty');
        return;
      }

      const model = buildGraphModel(scan.files, scan.wikiLinksByFileId);
      try {
        const { createGraphRenderer } = await import('./graphRenderer');
        if (cancelled || !containerRef.current) {
          return;
        }
        const renderer = await createGraphRenderer(containerRef.current, model, {
          forces: initialForces,
          onNodeClick: (nodeId) => {
            const target = filesRef.current.get(nodeId);
            if (target) {
              onOpenFile(target);
            }
          }
        });
        if (cancelled) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        setPhase('ready');
      } catch {
        if (!cancelled) {
          setPhase('rendererFailed');
        }
      }
    }

    void openGraph();
    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
    // eslint 없음 — 의도된 의존성: 재시도와 vault 전환 시에만 재실행
  }, [root.id, retryToken]);

  function updateForce(key: keyof GraphForceSettings, value: number) {
    setForces((current) => {
      const next = { ...current, [key]: value };
      rendererRef.current?.setForces(next);
      try {
        window.localStorage?.setItem(forceStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  function updateSearch(value: string) {
    setSearchQuery(value);
    rendererRef.current?.setSearch(value);
  }

  return (
    <div className="graph-view" data-testid="graph-view">
      <div className="graph-toolbar">
        <input
          type="search"
          value={searchQuery}
          placeholder={t('graph.searchPlaceholder')}
          onChange={(event) => updateSearch(event.target.value)}
        />
        <details className="graph-forces">
          <summary>{t('graph.forces')}</summary>
          {forceSliders.map((slider) => (
            <label key={slider.key}>
              <span>{t(slider.labelKey)}</span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={forces[slider.key]}
                onChange={(event) => updateForce(slider.key, Number(event.target.value))}
              />
            </label>
          ))}
        </details>
      </div>
      {failedCount > 0 ? (
        <div className="graph-banner" role="alert">
          <span>
            {t('graph.readFailures')} ({failedCount})
          </span>
          <button type="button" onClick={() => setRetryToken((token) => token + 1)}>
            {t('graph.retry')}
          </button>
        </div>
      ) : null}
      <div className="graph-canvas" ref={containerRef}>
        {phase === 'scanning' ? (
          <p className="graph-status">
            {t('graph.scanning')}
            {progress.total > 0 ? ` (${progress.done}/${progress.total})` : ''}
          </p>
        ) : null}
        {phase === 'empty' ? <p className="graph-status">{t('graph.empty')}</p> : null}
        {phase === 'rendererFailed' ? <p className="graph-status">{t('graph.rendererFailed')}</p> : null}
      </div>
    </div>
  );
}

async function resolveInitialForces(loadGraphSettings?: () => Promise<unknown>): Promise<GraphForceSettings> {
  try {
    const stored = window.localStorage?.getItem(forceStorageKey);
    if (stored) {
      return parseGraphForceSettings(JSON.parse(stored));
    }
  } catch {
    // ignore storage failures
  }
  try {
    if (loadGraphSettings) {
      return parseGraphForceSettings(await loadGraphSettings());
    }
  } catch {
    // ignore settings load failures
  }
  return defaultGraphForceSettings;
}
```

- [ ] **Step 5: 스타일 추가**

`src/styles.css` 끝에 추가:

```css
.graph-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.graph-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 12px;
}

.graph-toolbar input[type='search'] {
  flex: 0 0 220px;
}

.graph-forces {
  margin-left: auto;
  font-size: 12px;
}

.graph-forces label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.graph-forces label span {
  flex: 0 0 80px;
  color: var(--color-muted-gray);
}

.graph-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  color: var(--color-warning-yellow);
  font-size: 13px;
}

.graph-canvas {
  position: relative;
  flex: 1;
  min-height: 0;
}

.graph-canvas canvas {
  position: absolute;
  inset: 0;
}

.graph-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted-gray);
  margin: 0;
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/ui/graph/GraphView.test.tsx && npm run typecheck`
Expected: PASS 5건

- [ ] **Step 7: 커밋**

```bash
git add src/ui/graph/GraphView.tsx src/ui/graph/GraphView.test.tsx src/i18n/messages.ts src/styles.css
git commit -m "$(cat <<'EOF'
스캔 진행률과 검색·포스 슬라이더를 갖춘 그래프 뷰를 추가한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Workspace/App 통합 + ⌘G + 로드맵 갱신 + 최종 검증

**Files:**
- Modify: `src/ui/Workspace.tsx` (props, ⌘G, 뷰 전환 렌더)
- Modify: `src/ui/Workspace.test.tsx` (⌘G 토글 테스트)
- Modify: `src/App.tsx` (props 전달, mock vault 대응)
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: `GraphView` (Task 9), `viewModeChanged` (Task 7), `DriveWorkspace.readFileContent`/`loadGraphSettings` (Task 6)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/Workspace.test.tsx` 상단(다른 vi.mock 옆 또는 import 아래)에 렌더러 mock 추가:

```ts
vi.mock('./graph/graphRenderer', () => ({
  createGraphRenderer: vi.fn(async () => ({ setForces: vi.fn(), setSearch: vi.fn(), destroy: vi.fn() }))
}));
```

테스트 추가 — 파일에 이미 있는 `renderWorkspace(overrides)` 헬퍼(47줄)와 `fireEvent`를 그대로 사용:

```ts
  it('⌘G로 그래프 뷰를 켜고 다시 눌러 끈다', async () => {
    renderWorkspace({ readFileContent: async () => '' });

    fireEvent.keyDown(window, { key: 'g', metaKey: true });
    expect(await screen.findByTestId('graph-view')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'g', metaKey: true });
    await waitFor(() => expect(screen.queryByTestId('graph-view')).not.toBeInTheDocument());
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/Workspace.test.tsx`
Expected: 신규 테스트 FAIL — graph-view 없음

- [ ] **Step 3: Workspace 수정**

`src/ui/Workspace.tsx`:

(a) import 추가:

```ts
import { GraphView } from './graph/GraphView';
```

(b) `WorkspaceProps`에 추가 (`prefetchFile` 아래):

```ts
  readFileContent?(fileId: string): Promise<string>;
  loadGraphSettings?(): Promise<unknown>;
```

함수 시그니처 구조분해에도 `readFileContent`, `loadGraphSettings` 추가.

(c) `handleShortcut`의 ⌘E 분기 아래에 ⌘G 분기 추가:

```ts
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'g' && readFileContent) {
        event.preventDefault();
        dispatch({ type: 'viewModeChanged', viewMode: state.viewMode === 'graph' ? 'editor' : 'graph' });
        return;
      }
```

(이 effect는 의존성 배열 없이 매 렌더 재등록되므로 `state.viewMode`가 항상 최신이다.)

(d) `<main className="workspace-main">` 안의 기존 콘텐츠 전체(에디터 헤더 + EditorComponent + 빈 상태 블록)를 삼항으로 감싼다:

```tsx
        <main className="workspace-main">
          {state.viewMode === 'graph' && readFileContent ? (
            <GraphView
              root={root}
              loadFolders={loadFolders}
              loadMarkdownFiles={loadMarkdownFiles}
              readFileContent={readFileContent}
              loadGraphSettings={loadGraphSettings}
              onOpenFile={(file) => {
                void openFile(file);
              }}
            />
          ) : (
            <>
              {/* 기존 workspace-main 내부 콘텐츠 그대로 */}
            </>
          )}
        </main>
```

주의: 기존 내부 콘텐츠를 삭제하지 말고 `<>...</>`로 감싸 else 분기로 옮기기만 한다. `openFile`은 `documentOpened`를 dispatch하므로 reducer가 viewMode를 'editor'로 되돌린다 (Task 7).

- [ ] **Step 4: App 연결**

`src/App.tsx`:

Drive 워크스페이스 `<Workspace ...>` props에 추가 (`prefetchFile` 아래):

```tsx
      readFileContent={workspace.readFileContent}
      loadGraphSettings={workspace.loadGraphSettings}
```

`openMockWorkspace`의 setWorkspace 객체에 추가 (DriveWorkspace 타입 충족):

```ts
      readFileContent: async () => '',
      loadGraphSettings: async () => null,
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/ui/Workspace.test.tsx && npm test && npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 6: 로드맵 갱신**

`docs/roadmap.md`의 "하지 않음 (재확인 전까지)" 표에서 다음 행을 삭제:

```
| 그래프 뷰(전체·로컬) | 세 렌즈 모두 최하점(4~11). README 비범위 명시. "가벼운 편집 공간" 정체성과 정면 충돌 |
```

"요약 실행 순서" 코드 블록 아래(또는 Phase 4 언급 근처)에 한 줄 추가:

```
그래프 뷰(전체)는 2026-07-09 재평가로 착수 — `docs/superpowers/specs/2026-07-09-graph-view-design.md`
```

`README.md`의 비범위 목록(99줄 `- graph view`)에서도 해당 줄 삭제.

- [ ] **Step 7: 빌드 + 번들 확인**

Run: `npm run build && ls -S dist/assets | head -5`
Expected: 빌드 성공. pixi/d3가 든 그래프 청크가 별도 파일로 분리돼 있고, 진입 청크 크기가 이전과 비슷 (`git stash` 없이 확인하려면 main 진입 js 파일 크기가 수백 KB로 튀지 않았는지만 본다)

- [ ] **Step 8: dev 서버 육안 검증**

`npm run dev` (또는 preview 도구) → Mock vault 열기 → ⌘G:
- 그래프 뷰 전환, 스캔 문구 → 렌더 확인 (mock은 노드 0~수 개)
- 콘솔 에러 없는지 확인
- ⌘G 재입력으로 에디터 복귀

실제 Drive vault 접근이 가능하면: 노드 드래그·줌·호버 하이라이트·검색 딤·슬라이더 반응·노드 클릭 → 문서 열림까지 확인.

- [ ] **Step 9: 커밋**

```bash
git add src/ui/Workspace.tsx src/ui/Workspace.test.tsx src/App.tsx docs/roadmap.md README.md
git commit -m "$(cat <<'EOF'
⌘G로 여는 전체 그래프 뷰를 통합한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review 결과

- 스펙 커버리지: 전체 그래프(T3/T8/T9), 스캔+캐시(T4/T5), 에디터 자리 전환+⌘G(T7/T10), 기본 인터랙션+검색+슬라이더(T8/T9), graph.json 읽기 전용(T2/T6/T9), lazy 청크(T8/T9/T10 Step 7), 링크 해석 공유화(T1), 로드맵 갱신(T10) — 전부 태스크에 매핑됨
- 렌더러 무단위테스트는 스펙이 명시한 결정 (jsdom WebGL 부재) — T10 Step 8 육안 검증으로 대체
- 타입 일관성: `GraphForceSettings`/`GraphModel`/`GraphLinkStore`/`scanVaultLinks`/`createGraphRenderer` 시그니처를 태스크 간 대조 완료
