# Drive-backed Obsidian-lite MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a testable Chrome extension MVP that opens a Google Drive folder as an Obsidian-lite Markdown workspace.

**Architecture:** The app is a Manifest V3 extension with a React workspace page. Google Drive access is isolated behind `GoogleDriveClient` and `DriveVaultAdapter`; Markdown parsing, vault indexing, and draft persistence stay independent of React so they can be tested before UI wiring.

**Tech Stack:** TypeScript, React, Vite, Vitest, Testing Library, CodeMirror 6, Chrome Extension Manifest V3, Chrome Identity API, Google Picker API, Google Drive API, YAML parser.

---

## Approved Specs

- English design: `docs/superpowers/specs/2026-05-03-drive-backed-obsidian-lite-design.md`
- Korean design: `docs/superpowers/specs/2026-05-03-drive-backed-obsidian-lite-design.ko.md`

## Scope Check

The approved spec describes one coherent MVP: a Drive-backed Markdown workspace. It has multiple components, but they are all required for the same testable product slice. The plan keeps the first implementation focused on the extension icon workspace, Google Picker folder selection, Markdown editing, metadata/tag/wiki-link basics, autosave/manual save, local draft preservation, and metadata-based conflict warning.

## File Structure

```text
.
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── public/
│   └── manifest.json
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── env.d.ts
│   ├── domain/
│   │   ├── markdown/
│   │   │   ├── markdownMetadata.ts
│   │   │   └── markdownMetadata.test.ts
│   │   └── vault/
│   │       ├── errors.ts
│   │       ├── types.ts
│   │       ├── vaultIndex.ts
│   │       └── vaultIndex.test.ts
│   ├── extension/
│   │   └── background.ts
│   ├── integrations/
│   │   └── google/
│   │       ├── driveVaultAdapter.ts
│   │       ├── driveVaultAdapter.test.ts
│   │       ├── googleAuth.ts
│   │       ├── googleDriveClient.ts
│   │       └── googlePicker.ts
│   ├── storage/
│   │   ├── draftStore.ts
│   │   └── draftStore.test.ts
│   ├── test/
│   │   ├── fixtures.ts
│   │   └── setup.ts
│   └── ui/
│       ├── Workspace.tsx
│       ├── Workspace.test.tsx
│       ├── components/
│       │   ├── Breadcrumb.tsx
│       │   ├── FileSidebar.tsx
│       │   ├── MetadataPanel.tsx
│       │   └── SaveStatus.tsx
│       ├── editor/
│       │   ├── MarkdownEditor.tsx
│       │   ├── slashCommands.ts
│       │   └── wikiLinkAutocomplete.ts
│       └── state/
│           ├── workspaceReducer.ts
│           └── workspaceReducer.test.ts
└── docs/
    └── manual-checks/
        └── drive-extension-mvp.md
```

## Task 1: Project Scaffold And Build Tooling

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `public/manifest.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/env.d.ts`
- Create: `src/extension/background.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create base package metadata**

Create `package.json`:

```json
{
  "name": "obsidian-google-drive-editor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b",
    "lint": "tsc -b --pretty false"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

- [ ] **Step 2: Install runtime and test dependencies**

Run:

```bash
npm install react react-dom @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/autocomplete yaml
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom fake-indexeddb
```

Expected: `package-lock.json` is created and `package.json` contains installed dependencies.

- [ ] **Step 3: Add TypeScript configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "chrome"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

Install the missing type packages:

```bash
npm install -D @types/chrome @types/node
```

Expected: `npm run typecheck` can load Chrome and Node globals after scaffold files exist.

- [ ] **Step 4: Add Vite configuration**

Create `vite.config.ts`:

```ts
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        workspace: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/extension/background.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts']
  }
});
```

- [ ] **Step 5: Add extension manifest and app shell**

Create `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Drive Obsidian Editor",
  "description": "Edit Google Drive Markdown folders as an Obsidian-lite vault.",
  "version": "0.1.0",
  "action": {
    "default_title": "Open Drive Obsidian Editor"
  },
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "permissions": ["identity", "storage"],
  "host_permissions": [
    "https://accounts.google.com/*",
    "https://www.googleapis.com/*",
    "https://apis.google.com/*"
  ]
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Drive Obsidian Editor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>Drive Obsidian Editor</h1>
      <p>Google Drive vault 연결을 준비하고 있습니다.</p>
    </main>
  );
}
```

Create `src/extension/background.ts`:

```ts
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
```

Create `src/env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="chrome" />
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.local
.superpowers/
```

Create `src/styles.css`:

```css
:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #1e1e1e;
  color: #dcddde;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
}
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
npm run typecheck
npm run build
npm test
```

Expected:

```text
TypeScript exits 0
Vite build exits 0
Vitest exits 0 with no test files or no failing tests
```

- [ ] **Step 7: Commit scaffold**

```bash
git add .gitignore package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html public/manifest.json src
git commit -m "확장 앱 기반을 만들기 위한 빌드 골격을 추가" -m "React, TypeScript, Vite, Manifest V3 진입점을 먼저 세워 이후 도메인 모듈과 Drive 연동을 작은 단위로 붙일 수 있게 했다.

Constraint: 저장소가 문서만 있는 초기 상태였음
Confidence: high
Scope-risk: narrow
Directive: 확장 manifest와 Vite background entry 경로를 함께 검증할 것
Tested: npm run typecheck, npm run build, npm test
Not-tested: Chrome에서 unpacked extension 수동 로드

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

## Task 2: Domain Contracts And Test Fixtures

**Files:**
- Create: `src/domain/vault/types.ts`
- Create: `src/domain/vault/errors.ts`
- Create: `src/test/fixtures.ts`

- [ ] **Step 1: Define vault domain types**

Create `src/domain/vault/types.ts`:

```ts
export type VaultItemKind = 'folder' | 'markdown';

export interface VaultItem {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  kind: VaultItemKind;
  mimeType: string;
  modifiedTime: string;
}

export interface VaultFile extends VaultItem {
  kind: 'markdown';
  title: string;
}

export interface VaultFolder extends VaultItem {
  kind: 'folder';
}

export type VaultEntry = VaultFile | VaultFolder;

export interface VaultRoot {
  id: string;
  name: string;
}

export interface OpenDocument {
  file: VaultFile;
  content: string;
  baselineModifiedTime: string;
}

export interface SaveResult {
  fileId: string;
  modifiedTime: string;
}
```

- [ ] **Step 2: Define app error classes**

Create `src/domain/vault/errors.ts`:

```ts
export type VaultErrorCode =
  | 'AuthRequired'
  | 'PermissionDenied'
  | 'RateLimited'
  | 'NetworkFailed'
  | 'RemoteChanged'
  | 'DuplicateName'
  | 'NotFound';

export class VaultError extends Error {
  constructor(
    public readonly code: VaultErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

export function isVaultError(error: unknown, code?: VaultErrorCode): error is VaultError {
  return error instanceof VaultError && (code === undefined || error.code === code);
}
```

- [ ] **Step 3: Add shared test fixtures**

Create `src/test/fixtures.ts`:

```ts
import type { VaultFile, VaultFolder, VaultRoot } from '../domain/vault/types';

export const fixtureVaultRoot: VaultRoot = {
  id: 'drive-folder-root',
  name: 'Obsidian Vault'
};

export const fixtureFolder: VaultFolder = {
  id: 'folder-projects',
  name: 'Projects',
  path: 'Projects',
  parentId: fixtureVaultRoot.id,
  kind: 'folder',
  mimeType: 'application/vnd.google-apps.folder',
  modifiedTime: '2026-05-03T00:00:00.000Z'
};

export const fixtureFiles: VaultFile[] = [
  {
    id: 'file-home',
    name: 'Home.md',
    title: 'Home',
    path: 'Home.md',
    parentId: fixtureVaultRoot.id,
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-05-03T00:01:00.000Z'
  },
  {
    id: 'file-project-note',
    name: 'Project Note.md',
    title: 'Project Note',
    path: 'Projects/Project Note.md',
    parentId: fixtureFolder.id,
    kind: 'markdown',
    mimeType: 'text/markdown',
    modifiedTime: '2026-05-03T00:02:00.000Z'
  }
];
```

- [ ] **Step 4: Verify type contracts**

Run:

```bash
npm run typecheck
```

Expected: TypeScript exits 0.

- [ ] **Step 5: Commit domain contracts**

```bash
git add src/domain/vault src/test/fixtures.ts
git commit -m "vault 도메인 경계를 먼저 고정" -m "Drive API와 UI가 공유할 최소 타입과 오류 모델을 정의해 이후 구현이 같은 언어를 사용하게 했다.

Constraint: Drive 저장소 세부를 UI에 노출하지 않는 설계 경계
Confidence: high
Scope-risk: narrow
Directive: Google Drive response shape은 이 타입으로 변환한 뒤 상위 계층에 전달할 것
Tested: npm run typecheck
Not-tested: 런타임 Drive API 변환

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

## Task 3: MarkdownMetadata Parser And Mutator

**Files:**
- Create: `src/domain/markdown/markdownMetadata.test.ts`
- Create: `src/domain/markdown/markdownMetadata.ts`

- [ ] **Step 1: Write failing metadata tests**

Create `src/domain/markdown/markdownMetadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  extractMarkdownMetadata,
  setFrontmatterProperty
} from './markdownMetadata';

describe('extractMarkdownMetadata', () => {
  it('extracts frontmatter, inline tags, and wiki links', () => {
    const source = `---
title: Home
status: draft
---
# Home #daily

See [[Project Note]] and #project/alpha.
`;

    expect(extractMarkdownMetadata(source)).toEqual({
      frontmatter: {
        title: 'Home',
        status: 'draft'
      },
      tags: ['daily', 'project/alpha'],
      wikiLinks: ['Project Note'],
      bodyStart: source.indexOf('# Home')
    });
  });

  it('returns empty frontmatter when the document has no YAML block', () => {
    const source = '# Untitled\n\nBody with [[Link]].';

    expect(extractMarkdownMetadata(source)).toEqual({
      frontmatter: {},
      tags: [],
      wikiLinks: ['Link'],
      bodyStart: 0
    });
  });
});

describe('setFrontmatterProperty', () => {
  it('updates an existing property without changing the body', () => {
    const source = `---
title: Home
status: draft
---
# Home
`;

    expect(setFrontmatterProperty(source, 'status', 'published')).toBe(`---
title: Home
status: published
---
# Home
`);
  });

  it('creates a frontmatter block when missing', () => {
    expect(setFrontmatterProperty('# Home\n', 'title', 'Home')).toBe(`---
title: Home
---
# Home
`);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/domain/markdown/markdownMetadata.test.ts
```

Expected: FAIL because `markdownMetadata.ts` does not exist.

- [ ] **Step 3: Implement MarkdownMetadata**

Create `src/domain/markdown/markdownMetadata.ts`:

```ts
import { parse, stringify } from 'yaml';

export interface MarkdownMetadata {
  frontmatter: Record<string, unknown>;
  tags: string[];
  wikiLinks: string[];
  bodyStart: number;
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const tagPattern = /(^|\s)#([A-Za-z0-9_/-]+)/g;
const wikiLinkPattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

export function extractMarkdownMetadata(source: string): MarkdownMetadata {
  const frontmatterMatch = source.match(frontmatterPattern);
  const frontmatter = frontmatterMatch ? parse(frontmatterMatch[1]) ?? {} : {};
  const bodyStart = frontmatterMatch ? frontmatterMatch[0].length : 0;

  return {
    frontmatter,
    tags: uniqueMatches(source, tagPattern),
    wikiLinks: uniqueMatches(source, wikiLinkPattern),
    bodyStart
  };
}

export function setFrontmatterProperty(
  source: string,
  key: string,
  value: string | number | boolean | string[]
): string {
  const frontmatterMatch = source.match(frontmatterPattern);
  const current = frontmatterMatch ? parse(frontmatterMatch[1]) ?? {} : {};
  const next = { ...current, [key]: value };
  const frontmatter = `---\n${stringify(next).trimEnd()}\n---\n`;

  if (!frontmatterMatch) {
    return `${frontmatter}${source}`;
  }

  return `${frontmatter}${source.slice(frontmatterMatch[0].length)}`;
}

function uniqueMatches(source: string, pattern: RegExp): string[] {
  const values = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    values.add(match[2] ?? match[1]);
  }
  return [...values];
}
```

- [ ] **Step 4: Run metadata tests**

Run:

```bash
npm test -- src/domain/markdown/markdownMetadata.test.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run typecheck
npm test
```

Expected: TypeScript exits 0 and Vitest exits 0.

- [ ] **Step 6: Commit MarkdownMetadata**

```bash
git add src/domain/markdown
git commit -m "옵시디언 기본 메타데이터 편집 경계를 구현" -m "YAML frontmatter, inline tag, wiki link를 순수 함수로 다뤄 UI와 Drive adapter에서 독립적으로 검증할 수 있게 했다.

Constraint: MVP 호환 범위는 frontmatter, #tag, [[Wiki Link]]로 제한됨
Rejected: React component 내부 문자열 처리 | 편집 로직 테스트가 어려워짐
Confidence: high
Scope-risk: narrow
Directive: body 보존 테스트 없이 frontmatter mutation을 바꾸지 말 것
Tested: npm run typecheck, npm test
Not-tested: Dataview, backlink, block reference

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

## Task 4: VaultIndex Search And Link Candidates

**Files:**
- Create: `src/domain/vault/vaultIndex.test.ts`
- Create: `src/domain/vault/vaultIndex.ts`

- [ ] **Step 1: Write failing VaultIndex tests**

Create `src/domain/vault/vaultIndex.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixtureFiles } from '../../test/fixtures';
import { VaultIndex } from './vaultIndex';

describe('VaultIndex', () => {
  it('searches markdown files by title and path', () => {
    const index = new VaultIndex();
    index.replaceAll(fixtureFiles);

    expect(index.searchFiles('project')).toEqual([
      {
        id: 'file-project-note',
        title: 'Project Note',
        path: 'Projects/Project Note.md',
        ambiguous: false
      }
    ]);
  });

  it('marks duplicate note titles as ambiguous', () => {
    const index = new VaultIndex();
    index.replaceAll([
      ...fixtureFiles,
      {
        ...fixtureFiles[1],
        id: 'file-archive-project-note',
        path: 'Archive/Project Note.md'
      }
    ]);

    expect(index.searchFiles('project note')).toEqual([
      {
        id: 'file-archive-project-note',
        title: 'Project Note',
        path: 'Archive/Project Note.md',
        ambiguous: true
      },
      {
        id: 'file-project-note',
        title: 'Project Note',
        path: 'Projects/Project Note.md',
        ambiguous: true
      }
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/domain/vault/vaultIndex.test.ts
```

Expected: FAIL because `vaultIndex.ts` does not exist.

- [ ] **Step 3: Implement VaultIndex**

Create `src/domain/vault/vaultIndex.ts`:

```ts
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
      .filter((file) => {
        const haystack = normalize(`${file.title} ${file.path}`);
        return haystack.includes(normalizedQuery);
      })
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
```

- [ ] **Step 4: Run VaultIndex tests**

Run:

```bash
npm test -- src/domain/vault/vaultIndex.test.ts
```

Expected: PASS with 2 tests.

- [ ] **Step 5: Run full verification and commit**

```bash
npm run typecheck
npm test
git add src/domain/vault/vaultIndex.ts src/domain/vault/vaultIndex.test.ts
git commit -m "vault 파일 검색과 내부 링크 후보 색인을 구현" -m "파일명과 경로 검색을 같은 색인으로 처리해 sidebar 검색과 [[...]] autocomplete가 같은 결과를 공유하게 했다.

Constraint: MVP 내부 링크는 파일명 기반 [[Wiki Link]]로 제한됨
Confidence: high
Scope-risk: narrow
Directive: duplicate title ambiguity 표시는 링크 삽입 UI에서 유지할 것
Tested: npm run typecheck, npm test
Not-tested: 대형 vault background indexing

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

Expected: TypeScript exits 0, Vitest exits 0, commit succeeds.

## Task 5: DraftStore For Save Failure Recovery

**Files:**
- Create: `src/storage/draftStore.test.ts`
- Create: `src/storage/draftStore.ts`

- [ ] **Step 1: Write failing DraftStore tests**

Create `src/storage/draftStore.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbDraftStore } from './draftStore';

describe('IndexedDbDraftStore', () => {
  it('saves and retrieves a draft by vault and file id', async () => {
    const store = new IndexedDbDraftStore('test-drafts');

    await store.saveDraft({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local edit',
      baselineModifiedTime: '2026-05-03T00:00:00.000Z',
      savedAt: '2026-05-03T00:10:00.000Z',
      reason: 'NetworkFailed'
    });

    await expect(store.getDraft('root', 'file-home')).resolves.toEqual({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local edit',
      baselineModifiedTime: '2026-05-03T00:00:00.000Z',
      savedAt: '2026-05-03T00:10:00.000Z',
      reason: 'NetworkFailed'
    });
  });

  it('removes a recovered draft', async () => {
    const store = new IndexedDbDraftStore('test-drafts-delete');

    await store.saveDraft({
      vaultRootId: 'root',
      fileId: 'file-home',
      content: '# Local edit',
      baselineModifiedTime: '2026-05-03T00:00:00.000Z',
      savedAt: '2026-05-03T00:10:00.000Z',
      reason: 'NetworkFailed'
    });

    await store.deleteDraft('root', 'file-home');

    await expect(store.getDraft('root', 'file-home')).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/storage/draftStore.test.ts
```

Expected: FAIL because `draftStore.ts` does not exist.

- [ ] **Step 3: Implement IndexedDbDraftStore**

Create `src/storage/draftStore.ts`:

```ts
export interface DraftRecord {
  vaultRootId: string;
  fileId: string;
  content: string;
  baselineModifiedTime: string;
  savedAt: string;
  reason: string;
}

export interface DraftStore {
  saveDraft(draft: DraftRecord): Promise<void>;
  getDraft(vaultRootId: string, fileId: string): Promise<DraftRecord | null>;
  deleteDraft(vaultRootId: string, fileId: string): Promise<void>;
}

const storeName = 'drafts';

export class IndexedDbDraftStore implements DraftStore {
  constructor(private readonly databaseName = 'drive-obsidian-editor') {}

  async saveDraft(draft: DraftRecord): Promise<void> {
    const db = await this.open();
    await requestToPromise(
      transactionStore(db, 'readwrite').put(draft, draftKey(draft.vaultRootId, draft.fileId))
    );
    db.close();
  }

  async getDraft(vaultRootId: string, fileId: string): Promise<DraftRecord | null> {
    const db = await this.open();
    const draft = await requestToPromise<DraftRecord | undefined>(
      transactionStore(db, 'readonly').get(draftKey(vaultRootId, fileId))
    );
    db.close();
    return draft ?? null;
  }

  async deleteDraft(vaultRootId: string, fileId: string): Promise<void> {
    const db = await this.open();
    await requestToPromise(
      transactionStore(db, 'readwrite').delete(draftKey(vaultRootId, fileId))
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

function draftKey(vaultRootId: string, fileId: string) {
  return `${vaultRootId}:${fileId}`;
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

- [ ] **Step 4: Run DraftStore tests**

Run:

```bash
npm test -- src/storage/draftStore.test.ts
```

Expected: PASS with 2 tests.

- [ ] **Step 5: Run full verification and commit**

```bash
npm run typecheck
npm test
git add src/storage
git commit -m "저장 실패 복구를 위한 local draft 저장소를 구현" -m "Drive write 실패 시 editor content를 IndexedDB에 보존해 네트워크나 인증 오류가 데이터 손실로 이어지지 않게 했다.

Constraint: MVP는 online-first지만 저장 실패 초안 보존이 필요함
Rejected: chrome.storage.sync에 본문 저장 | sync quota와 불필요한 계정 동기화 위험
Confidence: high
Scope-risk: narrow
Directive: save failure 경로는 DraftStore 저장 성공 여부를 사용자에게 보여줄 것
Tested: npm run typecheck, npm test
Not-tested: 실제 브라우저 IndexedDB quota pressure

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

Expected: TypeScript exits 0, Vitest exits 0, commit succeeds.

## Task 6: GoogleDriveClient And DriveVaultAdapter

**Files:**
- Create: `src/integrations/google/googleDriveClient.ts`
- Create: `src/integrations/google/driveVaultAdapter.test.ts`
- Create: `src/integrations/google/driveVaultAdapter.ts`

- [ ] **Step 1: Define GoogleDriveClient boundary**

Create `src/integrations/google/googleDriveClient.ts`:

```ts
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: string[];
}

export interface GoogleDriveListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export interface GoogleDriveClient {
  listChildren(folderId: string, pageToken?: string): Promise<GoogleDriveListResponse>;
  downloadText(fileId: string): Promise<string>;
  updateText(fileId: string, content: string): Promise<GoogleDriveFile>;
  createTextFile(parentFolderId: string, name: string, content: string): Promise<GoogleDriveFile>;
  createFolder(parentFolderId: string, name: string): Promise<GoogleDriveFile>;
  getMetadata(fileId: string): Promise<GoogleDriveFile>;
}
```

- [ ] **Step 2: Write failing adapter tests**

Create `src/integrations/google/driveVaultAdapter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbDraftStore } from '../../storage/draftStore';
import { DriveVaultAdapter } from './driveVaultAdapter';
import type { GoogleDriveClient } from './googleDriveClient';

function client(overrides: Partial<GoogleDriveClient> = {}): GoogleDriveClient {
  return {
    listChildren: vi.fn().mockResolvedValue({ files: [] }),
    downloadText: vi.fn().mockResolvedValue(''),
    updateText: vi.fn().mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:03:00.000Z'
    }),
    createTextFile: vi.fn(),
    createFolder: vi.fn(),
    getMetadata: vi.fn().mockResolvedValue({
      id: 'file-home',
      name: 'Home.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:02:00.000Z'
    }),
    ...overrides
  };
}

describe('DriveVaultAdapter', () => {
  it('lists markdown files and folders with pagination', async () => {
    const drive = client({
      listChildren: vi
        .fn()
        .mockResolvedValueOnce({
          nextPageToken: 'page-2',
          files: [
            {
              id: 'folder-projects',
              name: 'Projects',
              mimeType: 'application/vnd.google-apps.folder',
              modifiedTime: '2026-05-03T00:00:00.000Z'
            }
          ]
        })
        .mockResolvedValueOnce({
          files: [
            {
              id: 'file-home',
              name: 'Home.md',
              mimeType: 'text/markdown',
              modifiedTime: '2026-05-03T00:01:00.000Z'
            }
          ]
        })
    });
    const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-list'));

    await expect(adapter.listChildren('root')).resolves.toEqual([
      {
        id: 'folder-projects',
        name: 'Projects',
        path: 'Projects',
        parentId: 'root',
        kind: 'folder',
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: '2026-05-03T00:00:00.000Z'
      },
      {
        id: 'file-home',
        name: 'Home.md',
        title: 'Home',
        path: 'Home.md',
        parentId: 'root',
        kind: 'markdown',
        mimeType: 'text/markdown',
        modifiedTime: '2026-05-03T00:01:00.000Z'
      }
    ]);
  });

  it('blocks save when remote metadata changed', async () => {
    const adapter = new DriveVaultAdapter(client(), new IndexedDbDraftStore('adapter-conflict'));

    await expect(
      adapter.saveFile('root', 'file-home', '# Local', '2026-05-03T00:01:00.000Z')
    ).rejects.toMatchObject({ code: 'RemoteChanged' });
  });
});
```

- [ ] **Step 3: Run adapter tests to verify failure**

Run:

```bash
npm test -- src/integrations/google/driveVaultAdapter.test.ts
```

Expected: FAIL because `driveVaultAdapter.ts` does not exist.

- [ ] **Step 4: Implement DriveVaultAdapter**

Create `src/integrations/google/driveVaultAdapter.ts`:

```ts
import { VaultError } from '../../domain/vault/errors';
import type { SaveResult, VaultEntry } from '../../domain/vault/types';
import type { DraftStore } from '../../storage/draftStore';
import type { GoogleDriveClient, GoogleDriveFile } from './googleDriveClient';

const folderMimeType = 'application/vnd.google-apps.folder';

export class DriveVaultAdapter {
  constructor(
    private readonly drive: GoogleDriveClient,
    private readonly drafts: DraftStore
  ) {}

  async listChildren(folderId: string): Promise<VaultEntry[]> {
    const files: GoogleDriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const page = await this.drive.listChildren(folderId, pageToken);
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);

    return files
      .filter((file) => file.mimeType === folderMimeType || file.name.endsWith('.md'))
      .map((file) => toVaultItem(file, folderId));
  }

  async readFile(fileId: string) {
    return this.drive.downloadText(fileId);
  }

  async saveFile(
    vaultRootId: string,
    fileId: string,
    content: string,
    expectedModifiedTime: string
  ): Promise<SaveResult> {
    const metadata = await this.drive.getMetadata(fileId);
    if (metadata.modifiedTime > expectedModifiedTime) {
      await this.drafts.saveDraft({
        vaultRootId,
        fileId,
        content,
        baselineModifiedTime: expectedModifiedTime,
        savedAt: new Date().toISOString(),
        reason: 'RemoteChanged'
      });
      throw new VaultError('RemoteChanged', 'Remote file changed before save.');
    }

    try {
      const updated = await this.drive.updateText(fileId, content);
      return {
        fileId: updated.id,
        modifiedTime: updated.modifiedTime
      };
    } catch (error) {
      await this.drafts.saveDraft({
        vaultRootId,
        fileId,
        content,
        baselineModifiedTime: expectedModifiedTime,
        savedAt: new Date().toISOString(),
        reason: 'NetworkFailed'
      });
      throw error;
    }
  }
}

function toVaultItem(file: GoogleDriveFile, parentId: string): VaultEntry {
  if (file.mimeType === folderMimeType) {
    return {
      id: file.id,
      name: file.name,
      path: file.name,
      parentId,
      kind: 'folder',
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime
    };
  }

  return {
    id: file.id,
    name: file.name,
    title: file.name.replace(/\.md$/i, ''),
    path: file.name,
    parentId,
    kind: 'markdown',
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime
  };
}
```

- [ ] **Step 5: Run adapter tests**

Run:

```bash
npm test -- src/integrations/google/driveVaultAdapter.test.ts
```

Expected: PASS with 2 tests.

- [ ] **Step 6: Add duplicate name and create operation tests**

Extend `driveVaultAdapter.test.ts` with create tests before implementing create methods:

```ts
it('creates markdown files when the parent folder has no duplicate name', async () => {
  const drive = client({
    listChildren: vi.fn().mockResolvedValue({ files: [] }),
    createTextFile: vi.fn().mockResolvedValue({
      id: 'file-new-note',
      name: 'New Note.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-05-03T00:04:00.000Z'
    })
  });
  const adapter = new DriveVaultAdapter(drive, new IndexedDbDraftStore('adapter-create-file'));

  await expect(adapter.createFile('root', 'New Note.md', '# New Note')).resolves.toMatchObject({
    id: 'file-new-note',
    name: 'New Note.md',
    kind: 'markdown'
  });
});

it('rejects duplicate names in the same parent folder', async () => {
  const adapter = new DriveVaultAdapter(
    client({
      listChildren: vi.fn().mockResolvedValue({
        files: [
          {
            id: 'file-home',
            name: 'Home.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-05-03T00:01:00.000Z'
          }
        ]
      })
    }),
    new IndexedDbDraftStore('adapter-duplicate')
  );

  await expect(adapter.createFile('root', 'Home.md', '# Home')).rejects.toMatchObject({
    code: 'DuplicateName'
  });
});
```

Run:

```bash
npm test -- src/integrations/google/driveVaultAdapter.test.ts
```

Expected: FAIL because `createFile` is missing.

- [ ] **Step 7: Implement create methods and duplicate guard**

Add these methods to `DriveVaultAdapter`:

```ts
  async createFile(parentFolderId: string, name: string, content: string) {
    await this.assertNameAvailable(parentFolderId, name);
    const file = await this.drive.createTextFile(parentFolderId, name, content);
    return toVaultItem(file, parentFolderId);
  }

  async createFolder(parentFolderId: string, name: string) {
    await this.assertNameAvailable(parentFolderId, name);
    const folder = await this.drive.createFolder(parentFolderId, name);
    return toVaultItem(folder, parentFolderId);
  }

  private async assertNameAvailable(parentFolderId: string, name: string) {
    const children = await this.listChildren(parentFolderId);
    if (children.some((child) => child.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new VaultError('DuplicateName', `Name already exists in this folder: ${name}`);
    }
  }
```

- [ ] **Step 8: Run full verification and commit**

```bash
npm run typecheck
npm test
git add src/integrations/google
git commit -m "Google Drive 저장소를 vault adapter 뒤로 격리" -m "Drive 파일 listing, content update, duplicate guard, modifiedTime 충돌 경고를 adapter 경계에서 처리하게 했다.

Constraint: UI는 Google Drive response shape에 직접 의존하지 않아야 함
Rejected: UI component에서 Drive API 직접 호출 | 테스트와 오류 처리가 분산됨
Confidence: medium
Scope-risk: moderate
Directive: Drive scope 변경이나 query 변경은 adapter tests와 manual Drive check를 함께 갱신할 것
Tested: npm run typecheck, npm test
Not-tested: 실제 Google Drive API quota, OAuth consent, Picker folder grant

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

Expected: TypeScript exits 0, Vitest exits 0, commit succeeds.

## Task 7: Chrome Identity And Google Picker Wiring

**Files:**
- Create: `src/integrations/google/googleAuth.ts`
- Create: `src/integrations/google/googlePicker.ts`
- Modify: `src/env.d.ts`
- Create: `docs/manual-checks/drive-extension-mvp.md`

- [ ] **Step 1: Add OAuth scope constants**

Create `src/integrations/google/googleAuth.ts`:

```ts
export const driveScopes = ['https://www.googleapis.com/auth/drive.file'] as const;

export interface GoogleAuthClient {
  getAccessToken(interactive: boolean): Promise<string>;
}

export class ChromeIdentityAuthClient implements GoogleAuthClient {
  async getAccessToken(interactive: boolean): Promise<string> {
    const token = await chrome.identity.getAuthToken({
      interactive,
      scopes: [...driveScopes]
    });

    if (!token) {
      throw new Error('Google access token was not returned.');
    }

    return token;
  }
}
```

- [ ] **Step 2: Add Picker wrapper**

Create `src/integrations/google/googlePicker.ts`:

```ts
export interface PickedFolder {
  id: string;
  name: string;
}

export interface GooglePickerClient {
  pickVaultFolder(accessToken: string): Promise<PickedFolder>;
}

export class BrowserGooglePickerClient implements GooglePickerClient {
  constructor(
    private readonly developerKey: string,
    private readonly appId: string
  ) {}

  async pickVaultFolder(accessToken: string): Promise<PickedFolder> {
    await loadPickerApi();

    return new Promise((resolve, reject) => {
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);

      const picker = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(this.developerKey)
        .setAppId(this.appId)
        .addView(view)
        .setCallback((data: google.picker.ResponseObject) => {
          if (data.action === google.picker.Action.CANCEL) {
            reject(new Error('Folder selection was cancelled.'));
            return;
          }

          if (data.action === google.picker.Action.PICKED) {
            const document = data.docs[0];
            resolve({ id: document.id, name: document.name });
          }
        })
        .build();

      picker.setVisible(true);
    });
  }
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve) => {
    gapi.load('picker', () => resolve());
  });
}
```

- [ ] **Step 3: Add global types for Picker**

Append to `src/env.d.ts`:

```ts
declare const gapi: {
  load(api: 'picker', callback: () => void): void;
};

declare namespace google.picker {
  enum ViewId {
    FOLDERS = 'FOLDERS'
  }

  enum Action {
    CANCEL = 'cancel',
    PICKED = 'picked'
  }

  interface DocumentObject {
    id: string;
    name: string;
  }

  interface ResponseObject {
    action: Action;
    docs: DocumentObject[];
  }

  class DocsView {
    constructor(viewId: ViewId);
    setIncludeFolders(includeFolders: boolean): DocsView;
    setSelectFolderEnabled(selectFolderEnabled: boolean): DocsView;
  }

  class PickerBuilder {
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    addView(view: DocsView): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }

  interface Picker {
    setVisible(visible: boolean): void;
  }
}
```

- [ ] **Step 4: Document required Google Cloud configuration**

Create `docs/manual-checks/drive-extension-mvp.md`:

```md
# Drive Extension MVP Manual Checks

## Google Cloud setup

1. Create a Google Cloud project for local extension testing.
2. Enable Google Drive API and Google Picker API.
3. Create a Chrome Extension OAuth client.
4. Add the unpacked extension id as the OAuth client extension id after the first local load.
5. Create an API key restricted to Google Picker API during development.
6. Store the OAuth client id, Picker API key, and app id in local environment or extension configuration used by the implementation.

## Manual Drive checks

1. Load `dist/` as an unpacked extension in Chrome.
2. Click the extension icon.
3. Authenticate with the test Google account.
4. Select a test Drive folder through Picker.
5. Create `Home.md`.
6. Edit and save `Home.md`.
7. Confirm the Drive file content changed in Google Drive.
8. Modify `Home.md` outside the extension.
9. Save from the extension and confirm the conflict warning appears before overwrite.
10. Force network failure and confirm local draft recovery appears when reopening the file.
```

- [ ] **Step 5: Verify build and commit**

```bash
npm run typecheck
npm run build
git add src/integrations/google/googleAuth.ts src/integrations/google/googlePicker.ts src/env.d.ts docs/manual-checks/drive-extension-mvp.md
git commit -m "Google 인증과 Picker 연결 경로를 추가" -m "Drive folder를 vault root로 선택하기 위한 Chrome Identity, Google Picker wrapper, 수동 검증 절차를 추가했다.

Constraint: 실제 Google Cloud client id와 API key는 로컬 환경 설정이 필요함
Rejected: 전체 Drive scope 선점 | MVP는 drive.file scope로 먼저 검증하고 권한 마찰을 낮춤
Confidence: medium
Scope-risk: moderate
Directive: drive.file로 folder traversal이 실패하면 scope 변경 근거를 문서와 adapter tests에 남길 것
Tested: npm run typecheck, npm run build
Not-tested: 실제 OAuth consent, Picker popup, Chrome Web Store review

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

Expected: TypeScript exits 0, Vite build exits 0, commit succeeds.

## Task 8: Workspace State And Editor UI

**Files:**
- Create: `src/ui/state/workspaceReducer.test.ts`
- Create: `src/ui/state/workspaceReducer.ts`
- Create: `src/ui/editor/MarkdownEditor.tsx`
- Create: `src/ui/editor/slashCommands.ts`
- Create: `src/ui/editor/wikiLinkAutocomplete.ts`
- Create: `src/ui/components/FileSidebar.tsx`
- Create: `src/ui/components/Breadcrumb.tsx`
- Create: `src/ui/components/MetadataPanel.tsx`
- Create: `src/ui/components/SaveStatus.tsx`
- Create: `src/ui/Workspace.test.tsx`
- Create: `src/ui/Workspace.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing reducer tests**

Create `src/ui/state/workspaceReducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixtureFiles, fixtureVaultRoot } from '../../test/fixtures';
import { createInitialWorkspaceState, workspaceReducer } from './workspaceReducer';

describe('workspaceReducer', () => {
  it('opens a document and marks save state clean', () => {
    const state = createInitialWorkspaceState();
    const next = workspaceReducer(state, {
      type: 'documentOpened',
      root: fixtureVaultRoot,
      files: fixtureFiles,
      document: {
        file: fixtureFiles[0],
        content: '# Home',
        baselineModifiedTime: fixtureFiles[0].modifiedTime
      }
    });

    expect(next.activeDocument?.content).toBe('# Home');
    expect(next.saveState.status).toBe('saved');
  });

  it('marks document dirty after edit', () => {
    const state = workspaceReducer(createInitialWorkspaceState(), {
      type: 'documentOpened',
      root: fixtureVaultRoot,
      files: fixtureFiles,
      document: {
        file: fixtureFiles[0],
        content: '# Home',
        baselineModifiedTime: fixtureFiles[0].modifiedTime
      }
    });

    const next = workspaceReducer(state, {
      type: 'documentEdited',
      content: '# Home\n\nNew line'
    });

    expect(next.activeDocument?.content).toContain('New line');
    expect(next.saveState.status).toBe('dirty');
  });
});
```

- [ ] **Step 2: Implement workspace reducer**

Create `src/ui/state/workspaceReducer.ts`:

```ts
import type { OpenDocument, VaultFile, VaultRoot } from '../../domain/vault/types';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'conflict';

export interface WorkspaceState {
  root: VaultRoot | null;
  files: VaultFile[];
  activeDocument: OpenDocument | null;
  saveState: {
    status: SaveStatus;
    message: string;
  };
}

export type WorkspaceAction =
  | {
      type: 'documentOpened';
      root: VaultRoot;
      files: VaultFile[];
      document: OpenDocument;
    }
  | { type: 'documentEdited'; content: string }
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded'; modifiedTime: string }
  | { type: 'saveFailed'; message: string }
  | { type: 'remoteConflict'; message: string };

export function createInitialWorkspaceState(): WorkspaceState {
  return {
    root: null,
    files: [],
    activeDocument: null,
    saveState: {
      status: 'idle',
      message: 'Vault를 선택하세요.'
    }
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'documentOpened':
      return {
        root: action.root,
        files: action.files,
        activeDocument: action.document,
        saveState: {
          status: 'saved',
          message: '저장됨'
        }
      };
    case 'documentEdited':
      return {
        ...state,
        activeDocument: state.activeDocument
          ? { ...state.activeDocument, content: action.content }
          : null,
        saveState: {
          status: 'dirty',
          message: '저장되지 않은 변경'
        }
      };
    case 'saveStarted':
      return { ...state, saveState: { status: 'saving', message: '저장 중' } };
    case 'saveSucceeded':
      return {
        ...state,
        activeDocument: state.activeDocument
          ? { ...state.activeDocument, baselineModifiedTime: action.modifiedTime }
          : null,
        saveState: { status: 'saved', message: '저장됨' }
      };
    case 'saveFailed':
      return { ...state, saveState: { status: 'failed', message: action.message } };
    case 'remoteConflict':
      return { ...state, saveState: { status: 'conflict', message: action.message } };
  }
}
```

- [ ] **Step 3: Run reducer tests**

```bash
npm test -- src/ui/state/workspaceReducer.test.ts
```

Expected: PASS with 2 tests.

- [ ] **Step 4: Add editor command modules**

Create `src/ui/editor/slashCommands.ts`:

```ts
export type SlashCommandId = 'link' | 'wikilink' | 'tag' | 'property';

export interface SlashCommand {
  id: SlashCommandId;
  label: string;
  insertText: string;
}

export const slashCommands: SlashCommand[] = [
  { id: 'link', label: 'Markdown link', insertText: '[text](https://example.com)' },
  { id: 'wikilink', label: 'Wiki link', insertText: '[[Home]]' },
  { id: 'tag', label: 'Tag', insertText: '#tag' },
  { id: 'property', label: 'Property', insertText: 'property: value' }
];
```

Create `src/ui/editor/wikiLinkAutocomplete.ts`:

```ts
import type { CompletionSource } from '@codemirror/autocomplete';
import type { VaultIndex } from '../../domain/vault/vaultIndex';

export function wikiLinkAutocomplete(index: VaultIndex): CompletionSource {
  return (context) => {
    const word = context.matchBefore(/\[\[[^\]]*/);
    if (!word) {
      return null;
    }

    const query = word.text.replace('[[', '');
    return {
      from: word.from,
      options: index.searchFiles(query).map((file) => ({
        label: `[[${file.title}]]`,
        detail: file.ambiguous ? `${file.path} - duplicate title` : file.path,
        apply: `[[${file.title}]]`
      }))
    };
  };
}
```

Create `src/ui/editor/MarkdownEditor.tsx`:

```tsx
import { autocompletion } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import type { VaultIndex } from '../../domain/vault/vaultIndex';
import { wikiLinkAutocomplete } from './wikiLinkAutocomplete';

interface MarkdownEditorProps {
  value: string;
  index: VaultIndex;
  onChange(value: string): void;
}

export function MarkdownEditor({ value, index, onChange }: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        markdown(),
        keymap.of([]),
        autocompletion({ override: [wikiLinkAutocomplete(index)] }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        })
      ]
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [index, onChange, value]);

  return <div className="editor-pane" ref={hostRef} />;
}
```

- [ ] **Step 5: Add UI components**

Create `src/ui/components/SaveStatus.tsx`:

```tsx
import type { SaveStatus as SaveStatusValue } from '../state/workspaceReducer';

interface SaveStatusProps {
  status: SaveStatusValue;
  message: string;
  onSave(): void;
}

export function SaveStatus({ status, message, onSave }: SaveStatusProps) {
  return (
    <div className={`save-status save-status-${status}`}>
      <span>{message}</span>
      <button type="button" onClick={onSave}>
        저장
      </button>
    </div>
  );
}
```

Create `src/ui/components/FileSidebar.tsx`:

```tsx
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
```

Create `src/ui/components/Breadcrumb.tsx`:

```tsx
interface BreadcrumbProps {
  path: string;
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  const parts = path.split('/');
  return (
    <nav className="breadcrumb" aria-label="Current path">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>{part}</span>
      ))}
    </nav>
  );
}
```

Create `src/ui/components/MetadataPanel.tsx`:

```tsx
import { extractMarkdownMetadata } from '../../domain/markdown/markdownMetadata';

interface MetadataPanelProps {
  content: string;
}

export function MetadataPanel({ content }: MetadataPanelProps) {
  const metadata = extractMarkdownMetadata(content);
  const entries = Object.entries(metadata.frontmatter);

  return (
    <section className="metadata-panel" aria-label="Properties and tags">
      <h2>Properties</h2>
      {entries.length === 0 ? (
        <p>등록된 프로퍼티가 없습니다.</p>
      ) : (
        entries.map(([key, value]) => (
          <div className="property-row" key={key}>
            <span>{key}</span>
            <code>{String(value)}</code>
          </div>
        ))
      )}
      <h2>Tags</h2>
      <div className="tag-list">
        {metadata.tags.map((tag) => (
          <span className="tag" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add Workspace integration test**

Create `src/ui/Workspace.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fixtureFiles, fixtureVaultRoot } from '../test/fixtures';
import { Workspace } from './Workspace';

describe('Workspace', () => {
  it('opens a file and shows properties, tags, and save action', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <Workspace
        root={fixtureVaultRoot}
        files={fixtureFiles}
        initialContent={`---
title: Home
---
# Home #daily`}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: /Home/ }));

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('#daily')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Implement Workspace**

Create `src/ui/Workspace.tsx`:

```tsx
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
      <FileSidebar
        files={files}
        activeFileId={activeDocument?.file.id}
        onOpen={openFile}
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
              onSave={() => onSave(activeDocument.content)}
            />
          </>
        ) : (
          <button type="button" onClick={() => openFile(files[0])}>
            첫 문서 열기
          </button>
        )}
      </section>
      {activeDocument ? <MetadataPanel content={activeDocument.content} /> : null}
    </div>
  );
}
```

Modify `src/App.tsx` to render a mock workspace until Drive connection is wired into app state:

```tsx
import { fixtureFiles, fixtureVaultRoot } from './test/fixtures';
import { Workspace } from './ui/Workspace';

export function App() {
  return (
    <Workspace
      root={fixtureVaultRoot}
      files={fixtureFiles}
      initialContent={`---
title: Home
---
# Home #daily

See [[Project Note]].`}
      onSave={() => undefined}
    />
  );
}
```

- [ ] **Step 8: Add workspace styles**

Append to `src/styles.css`:

```css
.workspace {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 280px;
  background: #1e1e1e;
}

.sidebar,
.metadata-panel {
  background: #252526;
  border-color: #343434;
  border-style: solid;
}

.sidebar {
  border-width: 0 1px 0 0;
  padding: 12px;
}

.metadata-panel {
  border-width: 0 0 0 1px;
  padding: 16px;
}

.sidebar-item {
  width: 100%;
  display: grid;
  gap: 3px;
  padding: 8px;
  border: 0;
  color: #dcddde;
  background: transparent;
  text-align: left;
}

.sidebar-item.active,
.sidebar-item:hover {
  background: #333333;
}

.sidebar-item small {
  color: #9a9a9a;
}

.workspace-main {
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.breadcrumb,
.save-status {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #343434;
}

.save-status {
  justify-content: space-between;
  border-top: 1px solid #343434;
  border-bottom: 0;
}

.editor-pane {
  min-height: 0;
}

.editor-pane .cm-editor {
  height: 100%;
  background: #1e1e1e;
  color: #dcddde;
}

.property-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  color: #8aadf4;
}
```

- [ ] **Step 9: Verify workspace UI**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: TypeScript exits 0, Vitest exits 0, Vite build exits 0.

- [ ] **Step 10: Commit workspace UI**

```bash
git add src/App.tsx src/styles.css src/ui
git commit -m "옵시디언 라이트 workspace 편집 화면을 연결" -m "CodeMirror editor, sidebar, breadcrumb, metadata panel, save status를 mock vault 데이터 위에 연결해 Drive 연동 전에도 편집 경험을 검증할 수 있게 했다.

Constraint: UI 우선순위는 Obsidian layout 복제보다 편집 경험임
Rejected: Drive API 연결 후 UI 작성 | editor와 metadata UX 검증이 늦어짐
Confidence: medium
Scope-risk: moderate
Directive: Workspace는 mock provider와 Drive provider 양쪽에서 같은 props 형태로 동작해야 함
Tested: npm run typecheck, npm test, npm run build
Not-tested: 실제 Chrome extension viewport, Google Drive-backed file open

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

## Task 9: Drive-backed Workspace Flow And Release Checks

**Files:**
- Modify: `src/ui/Workspace.tsx`
- Modify: `src/ui/Workspace.test.tsx`
- Modify: `src/App.tsx`
- Create: `src/app/driveWorkspaceLoader.ts`
- Create: `src/integrations/google/httpGoogleDriveClient.ts`
- Create: `.env.example`
- Modify: `docs/manual-checks/drive-extension-mvp.md`

- [ ] **Step 1: Update Workspace to load and save active Drive documents**

Modify `src/ui/Workspace.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fixtureFiles, fixtureVaultRoot } from '../test/fixtures';
import { Workspace } from './Workspace';

describe('Workspace', () => {
  it('opens a file, shows metadata, and saves the active document', async () => {
    const user = userEvent.setup();
    const saveDocument = vi.fn().mockResolvedValue({
      fileId: 'file-home',
      modifiedTime: '2026-05-03T00:11:00.000Z'
    });

    render(
      <Workspace
        root={fixtureVaultRoot}
        files={fixtureFiles}
        loadFile={async (file) => ({
          file,
          content: `---
title: Home
---
# Home #daily`,
          baselineModifiedTime: file.modifiedTime
        })}
        saveDocument={saveDocument}
      />
    );

    await user.click(screen.getByRole('button', { name: /Home/ }));

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('#daily')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ id: 'file-home' })
      })
    );
    expect(await screen.findByText('저장됨')).toBeInTheDocument();
  });
});
```

Modify `src/ui/Workspace.tsx`:

```tsx
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
          <button type="button" onClick={() => void openFile(files[0])}>
            첫 문서 열기
          </button>
        )}
      </section>
      {activeDocument ? <MetadataPanel content={activeDocument.content} /> : null}
    </div>
  );
}
```

Run:

```bash
npm test -- src/ui/Workspace.test.tsx
```

Expected: PASS with updated Workspace behavior.

- [ ] **Step 2: Implement HTTP Google Drive client**

Create `src/integrations/google/httpGoogleDriveClient.ts`:

```ts
import type { GoogleDriveClient, GoogleDriveFile, GoogleDriveListResponse } from './googleDriveClient';

const driveBaseUrl = 'https://www.googleapis.com/drive/v3/files';
const uploadBaseUrl = 'https://www.googleapis.com/upload/drive/v3/files';

export class HttpGoogleDriveClient implements GoogleDriveClient {
  constructor(private readonly accessToken: string) {}

  async listChildren(folderId: string, pageToken?: string): Promise<GoogleDriveListResponse> {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, parents)',
      pageSize: '100'
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    return this.request(`${driveBaseUrl}?${params.toString()}`);
  }

  async downloadText(fileId: string): Promise<string> {
    const response = await fetch(`${driveBaseUrl}/${fileId}?alt=media`, {
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`Drive download failed: ${response.status}`);
    }
    return response.text();
  }

  async updateText(fileId: string, content: string): Promise<GoogleDriveFile> {
    return this.request(`${uploadBaseUrl}/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime,parents`, {
      method: 'PATCH',
      headers: {
        ...this.headers(),
        'Content-Type': 'text/markdown; charset=utf-8'
      },
      body: content
    });
  }

  async createTextFile(parentFolderId: string, name: string, content: string): Promise<GoogleDriveFile> {
    const metadata = await this.request<GoogleDriveFile>(`${driveBaseUrl}?fields=id,name,mimeType,modifiedTime,parents`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        parents: [parentFolderId],
        mimeType: 'text/markdown'
      })
    });
    return this.updateText(metadata.id, content);
  }

  async createFolder(parentFolderId: string, name: string): Promise<GoogleDriveFile> {
    return this.request(`${driveBaseUrl}?fields=id,name,mimeType,modifiedTime,parents`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        parents: [parentFolderId],
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
  }

  async getMetadata(fileId: string): Promise<GoogleDriveFile> {
    return this.request(`${driveBaseUrl}/${fileId}?fields=id,name,mimeType,modifiedTime,parents`);
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...this.headers(),
        ...init.headers
      }
    });
    if (!response.ok) {
      throw new Error(`Drive request failed: ${response.status}`);
    }
    return response.json();
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`
    };
  }
}
```

- [ ] **Step 3: Add Drive workspace loader**

Create `src/app/driveWorkspaceLoader.ts`:

```ts
import type { OpenDocument, SaveResult, VaultFile, VaultRoot } from '../domain/vault/types';
import { DriveVaultAdapter } from '../integrations/google/driveVaultAdapter';
import type { GoogleAuthClient } from '../integrations/google/googleAuth';
import type { GoogleDriveClient } from '../integrations/google/googleDriveClient';
import type { GooglePickerClient } from '../integrations/google/googlePicker';
import type { DraftStore } from '../storage/draftStore';

export interface DriveWorkspace {
  root: VaultRoot;
  files: VaultFile[];
  loadFile(file: VaultFile): Promise<OpenDocument>;
  saveDocument(document: OpenDocument): Promise<SaveResult>;
}

interface LoadDriveWorkspaceDeps {
  auth: GoogleAuthClient;
  picker: GooglePickerClient;
  createDriveClient(accessToken: string): GoogleDriveClient;
  drafts: DraftStore;
}

export async function loadDriveWorkspace(deps: LoadDriveWorkspaceDeps): Promise<DriveWorkspace> {
  const accessToken = await deps.auth.getAccessToken(true);
  const pickedFolder = await deps.picker.pickVaultFolder(accessToken);
  const adapter = new DriveVaultAdapter(deps.createDriveClient(accessToken), deps.drafts);
  const root: VaultRoot = { id: pickedFolder.id, name: pickedFolder.name };
  const files = await collectMarkdownFiles(adapter, root.id);

  return {
    root,
    files,
    loadFile: async (file) => ({
      file,
      content: await adapter.readFile(file.id),
      baselineModifiedTime: file.modifiedTime
    }),
    saveDocument: (document) =>
      adapter.saveFile(
        root.id,
        document.file.id,
        document.content,
        document.baselineModifiedTime
      )
  };
}

async function collectMarkdownFiles(
  adapter: DriveVaultAdapter,
  folderId: string,
  parentPath = ''
): Promise<VaultFile[]> {
  const entries = await adapter.listChildren(folderId);
  const files: VaultFile[] = [];

  for (const entry of entries) {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (entry.kind === 'markdown') {
      files.push({ ...entry, path });
    }
    if (entry.kind === 'folder') {
      files.push(...(await collectMarkdownFiles(adapter, entry.id, path)));
    }
  }

  return files;
}
```

- [ ] **Step 4: Add environment documentation**

Create `.env.example`:

```dotenv
VITE_GOOGLE_PICKER_DEVELOPER_KEY=
VITE_GOOGLE_PICKER_APP_ID=
```

Append this to `docs/manual-checks/drive-extension-mvp.md`:

```md
## Local environment

`VITE_GOOGLE_PICKER_DEVELOPER_KEY` and `VITE_GOOGLE_PICKER_APP_ID` are public browser configuration values for local testing. The OAuth client id for `chrome.identity.getAuthToken` must be configured in `public/manifest.json` under `oauth2.client_id` after creating the Chrome Extension OAuth client in Google Cloud Console.
```

- [ ] **Step 5: Wire App to mock and Drive onboarding state**

Modify `src/App.tsx`:

```tsx
import { useState } from 'react';
import { loadDriveWorkspace, type DriveWorkspace } from './app/driveWorkspaceLoader';
import { ChromeIdentityAuthClient } from './integrations/google/googleAuth';
import { HttpGoogleDriveClient } from './integrations/google/httpGoogleDriveClient';
import { BrowserGooglePickerClient } from './integrations/google/googlePicker';
import { IndexedDbDraftStore } from './storage/draftStore';
import { fixtureFiles, fixtureVaultRoot } from './test/fixtures';
import { Workspace } from './ui/Workspace';

export function App() {
  const [workspace, setWorkspace] = useState<DriveWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connectDrive() {
    const developerKey = import.meta.env.VITE_GOOGLE_PICKER_DEVELOPER_KEY;
    const appId = import.meta.env.VITE_GOOGLE_PICKER_APP_ID;

    if (!developerKey || !appId) {
      setError('Google Picker 설정값이 없습니다. .env.local을 확인하세요.');
      return;
    }

    try {
      const nextWorkspace = await loadDriveWorkspace({
        auth: new ChromeIdentityAuthClient(),
        picker: new BrowserGooglePickerClient(developerKey, appId),
        createDriveClient: (accessToken) => new HttpGoogleDriveClient(accessToken),
        drafts: new IndexedDbDraftStore()
      });
      setWorkspace(nextWorkspace);
      setError(null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Drive 연결 실패');
    }
  }

  function openMockWorkspace() {
    setWorkspace({
      root: fixtureVaultRoot,
      files: fixtureFiles,
      loadFile: async (file) => ({
        file,
        content: `---
title: Home
---
# Home #daily

See [[Project Note]].`,
        baselineModifiedTime: file.modifiedTime
      }),
      saveDocument: async (document) => ({
        fileId: document.file.id,
        modifiedTime: new Date().toISOString()
      })
    });
  }

  if (!workspace) {
    return (
      <main className="app-shell">
        <h1>Drive Obsidian Editor</h1>
        <p>Google Drive 폴더를 vault로 연결해 Markdown 파일을 편집합니다.</p>
        <button type="button" onClick={() => void connectDrive()}>
          Google Drive vault 연결
        </button>
        <button type="button" onClick={openMockWorkspace}>
          Mock vault 열기
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </main>
    );
  }

  return (
    <Workspace
      root={workspace.root}
      files={workspace.files}
      loadFile={workspace.loadFile}
      saveDocument={workspace.saveDocument}
    />
  );
}
```

- [ ] **Step 6: Run final automated verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: TypeScript exits 0, Vitest exits 0, Vite build exits 0.

- [ ] **Step 7: Load extension manually**

Run:

```bash
npm run build
```

Then open Chrome extension management and load `/Users/cycle1223/workspace/obsidian-google-drive-editor/dist` as unpacked extension.

Expected:

```text
Extension loads without manifest errors.
Clicking the extension icon opens the workspace page.
Mock vault flow opens the editor.
```

- [ ] **Step 8: Update manual check results**

Append a dated result section to `docs/manual-checks/drive-extension-mvp.md`:

```md
## Result - 2026-05-03

- Automated verification: `npm run typecheck`, `npm test`, `npm run build`.
- Unpacked extension load: record Chrome result here after running the manual check.
- OAuth/Picker live Drive test: record Google Cloud configuration and outcome here after credentials are available.
- Known release blocker: live Drive save remains blocked until OAuth client id, Picker API key, and test Drive folder are configured.
```

- [ ] **Step 9: Commit final MVP integration slice**

```bash
git add .env.example src/App.tsx src/app/driveWorkspaceLoader.ts src/ui/Workspace.tsx src/ui/Workspace.test.tsx src/integrations/google/httpGoogleDriveClient.ts docs/manual-checks/drive-extension-mvp.md
git commit -m "Drive 기반 workspace MVP의 통합 경로를 닫음" -m "HTTP Drive client, Drive workspace loader, 저장 가능한 Workspace 계약을 연결해 mock flow와 실제 Drive flow가 같은 화면을 사용하게 했다.

Constraint: 실제 OAuth와 Picker 검증은 Google Cloud credential이 있어야 가능함
Rejected: credential 없이 live Drive test 성공으로 간주 | 외부 권한이 없는 상태에서 검증 주장을 할 수 없음
Confidence: medium
Scope-risk: moderate
Directive: OAuth credential 설정 후 manual check 결과를 같은 문서에 기록할 것
Tested: npm run typecheck, npm test, npm run build
Not-tested: live Google Drive folder selection and save without credentials

Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

## Final Verification Checklist

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.
- [ ] `npm run build` exits 0.
- [ ] `dist/` loads as an unpacked Chrome extension.
- [ ] Extension icon opens the workspace page.
- [ ] Mock vault file opens in the editor.
- [ ] Metadata panel shows YAML properties and `#tag`.
- [ ] `[[...]]` autocomplete returns `VaultIndex` file candidates.
- [ ] Save failure path writes a `DraftStore` record in tests.
- [ ] Modified remote metadata path raises `RemoteChanged` in tests.
- [ ] Manual Google Drive live check is recorded when credentials are configured.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-03-drive-backed-obsidian-lite-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
