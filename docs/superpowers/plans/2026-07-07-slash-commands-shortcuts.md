# 슬래시 커맨드·단축키 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian 명령어 팔레트 전수 검토(`docs/obsidian-command-palette-review.md`)에서 "적용"(이미 구현된 9개 제외, 신규 22개)과 "변형"(7개)으로 판정한 항목을 슬래시 커맨드 확장 + 에디터 keymap + 앱 단축키 + 사이드바 메뉴로 구현한다.

**Architecture:** 에디터 편집 커맨드는 CM6 `StateCommand`로 작성해 keymap과 테스트에서 공유한다. 기본 편집기능(undo/줄이동/들여쓰기)은 `@codemirror/commands`의 기성 keymap을 조립만 한다. 앱 레벨 단축키(저장/모드/검색/새 노트/⌥1~9 탭 이동)는 Workspace의 window keydown 리스너 하나로 처리한다. 슬래시 커맨드는 기존 `slashCommands` 배열에 항목만 추가한다. 경로 복사·Drive에서 열기는 FileSidebar의 기존 항목 메뉴(select)에 옵션을 추가해 FileSidebar 내부에서 자체 처리한다(새 prop 없음).

**Tech Stack:** React 19, TypeScript(strict), CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/commands` 신규 설치), vitest + @testing-library/react (jsdom).

## Global Constraints

- 마크다운 원문 보존이 제품 1원칙: 커맨드는 사용자가 명시적으로 실행한 변경 외에 문서를 건드리지 않는다.
- 브라우저 예약 단축키 사용 금지: ⌘1~9, ⌘W, ⌘N, ⌘T, ⌘, 는 바인딩하지 않는다.
- 모든 사용자 노출 문자열은 `src/i18n/messages.ts`에 ko/en 두 벌 추가 (`en`은 `Record<keyof typeof ko, string>`이라 한쪽만 추가하면 typecheck 실패).
- 기존 스타일 준수: 세미콜론, 싱글쿼트, 2-space 들여쓰기, 함수형 컴포넌트. AGENTS.md의 surgical-change 원칙.
- 커밋 메시지는 저장소 관례대로 한국어 한 문장 (예: `문서 내용을 캐시하고 사이드바에서 프리페치해 열기 지연을 줄인다`).
- 검증 명령: `npm test` (vitest run), `npm run typecheck`.
- 작업 디렉터리: `/Users/cycle/workspace/obsidian-google-drive-editor`.

---

### Task 1: 마크다운 편집 커맨드 모듈

**Files:**
- Create: `src/ui/editor/markdownCommands.ts`
- Create: `src/ui/editor/markdownCommands.test.ts`
- Modify: `package.json` (의존성 추가는 npm 명령으로)

**Interfaces:**
- Consumes: `@codemirror/state`의 `EditorSelection`, `StateCommand`, `@codemirror/view`의 `KeyBinding`.
- Produces (Task 2가 사용):
  - `setHeading(level: number): StateCommand` — 현재 줄을 `#{level} `로 설정, 이미 같은 레벨이면 제거(토글)
  - `toggleInlineMark(marker: string): StateCommand` — 선택 양끝에 marker 삽입/제거 (`**` 볼드, `*` 이탤릭)
  - `insertLink: StateCommand` — 선택을 `[선택](url)`로 감싸고 `url` 부분 선택
  - `cycleListMarker: StateCommand` — 일반 줄 → `- ` → `- [ ] ` → 일반 줄 순환
  - `markdownKeymap: KeyBinding[]` — 위 커맨드의 키 바인딩 (Mod-b/Mod-i/Mod-k/Mod-l/Mod-Shift-1~6)

- [ ] **Step 1: @codemirror/commands 설치**

```bash
npm install @codemirror/commands
```

Expected: package.json dependencies에 `@codemirror/commands` 추가됨. 실패(레지스트리 등) 시 중단하고 보고.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/ui/editor/markdownCommands.test.ts` 생성:

```ts
import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { cycleListMarker, insertLink, setHeading, toggleInlineMark } from './markdownCommands';

function run(command: StateCommand, doc: string, anchor: number, head = anchor) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
  command({
    state,
    dispatch: (transaction) => {
      state = transaction.state;
    }
  });
  return state;
}

describe('setHeading', () => {
  it('sets a heading on a plain line', () => {
    const state = run(setHeading(2), 'title', 3);
    expect(state.doc.toString()).toBe('## title');
  });

  it('replaces an existing heading level', () => {
    const state = run(setHeading(1), '### title', 6);
    expect(state.doc.toString()).toBe('# title');
  });

  it('removes the heading when the level matches', () => {
    const state = run(setHeading(2), '## title', 6);
    expect(state.doc.toString()).toBe('title');
  });
});

describe('toggleInlineMark', () => {
  it('wraps the selection with the marker', () => {
    const state = run(toggleInlineMark('**'), 'a bold b', 2, 6);
    expect(state.doc.toString()).toBe('a **bold** b');
    expect(state.selection.main.from).toBe(4);
    expect(state.selection.main.to).toBe(8);
  });

  it('unwraps a selection already surrounded by the marker', () => {
    const state = run(toggleInlineMark('**'), 'a **bold** b', 4, 8);
    expect(state.doc.toString()).toBe('a bold b');
  });

  it('inserts an empty pair at the cursor', () => {
    const state = run(toggleInlineMark('*'), 'ab', 1);
    expect(state.doc.toString()).toBe('a**b');
    expect(state.selection.main.head).toBe(2);
  });
});

describe('insertLink', () => {
  it('wraps the selection and selects the url placeholder', () => {
    const state = run(insertLink, 'see docs now', 4, 8);
    expect(state.doc.toString()).toBe('see [docs](url) now');
    expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('url');
  });

  it('inserts a placeholder link at the cursor', () => {
    const state = run(insertLink, '', 0);
    expect(state.doc.toString()).toBe('[text](url)');
  });
});

describe('cycleListMarker', () => {
  it('turns a plain line into a bullet', () => {
    const state = run(cycleListMarker, 'item', 2);
    expect(state.doc.toString()).toBe('- item');
  });

  it('turns a bullet into a checkbox', () => {
    const state = run(cycleListMarker, '- item', 4);
    expect(state.doc.toString()).toBe('- [ ] item');
  });

  it('turns a checkbox back into a plain line', () => {
    const state = run(cycleListMarker, '- [x] item', 8);
    expect(state.doc.toString()).toBe('item');
  });

  it('keeps indentation while cycling', () => {
    const state = run(cycleListMarker, '  - item', 5);
    expect(state.doc.toString()).toBe('  - [ ] item');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/ui/editor/markdownCommands.test.ts`
Expected: FAIL — `markdownCommands` 모듈 없음.

- [ ] **Step 4: 구현**

`src/ui/editor/markdownCommands.ts` 생성:

```ts
import { EditorSelection, type StateCommand } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';

const headingPattern = /^(#{1,6}) /;
const taskPattern = /^(\s*)- \[[ xX]\] /;
const bulletPattern = /^(\s*)- (?!\[)/;

export function setHeading(level: number): StateCommand {
  return ({ state, dispatch }) => {
    const changes = state.selection.ranges.map((range) => {
      const line = state.doc.lineAt(range.head);
      const match = line.text.match(headingPattern);
      const currentLevel = match ? match[1].length : 0;
      return {
        from: line.from,
        to: line.from + (match ? match[0].length : 0),
        insert: currentLevel === level ? '' : `${'#'.repeat(level)} `
      };
    });
    dispatch(state.update({ changes, userEvent: 'input' }));
    return true;
  };
}

export function toggleInlineMark(marker: string): StateCommand {
  return ({ state, dispatch }) => {
    dispatch(
      state.update(
        state.changeByRange((range) => {
          const before = state.sliceDoc(Math.max(0, range.from - marker.length), range.from);
          const after = state.sliceDoc(range.to, range.to + marker.length);
          if (before === marker && after === marker) {
            return {
              changes: [
                { from: range.from - marker.length, to: range.from },
                { from: range.to, to: range.to + marker.length }
              ],
              range: EditorSelection.range(range.from - marker.length, range.to - marker.length)
            };
          }
          return {
            changes: [
              { from: range.from, insert: marker },
              { from: range.to, insert: marker }
            ],
            range: EditorSelection.range(range.from + marker.length, range.to + marker.length)
          };
        })
      )
    );
    return true;
  };
}

export const insertLink: StateCommand = ({ state, dispatch }) => {
  dispatch(
    state.update(
      state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to) || 'text';
        const urlFrom = range.from + text.length + 3;
        return {
          changes: { from: range.from, to: range.to, insert: `[${text}](url)` },
          range: EditorSelection.range(urlFrom, urlFrom + 3)
        };
      })
    )
  );
  return true;
};

export const cycleListMarker: StateCommand = ({ state, dispatch }) => {
  const changes = state.selection.ranges.map((range) => {
    const line = state.doc.lineAt(range.head);
    const task = line.text.match(taskPattern);
    if (task) {
      return { from: line.from + task[1].length, to: line.from + task[0].length, insert: '' };
    }
    const bullet = line.text.match(bulletPattern);
    if (bullet) {
      return { from: line.from + bullet[0].length, to: line.from + bullet[0].length, insert: '[ ] ' };
    }
    const indent = line.text.match(/^\s*/)?.[0] ?? '';
    return { from: line.from + indent.length, to: line.from + indent.length, insert: '- ' };
  });
  dispatch(state.update({ changes, userEvent: 'input' }));
  return true;
};

export const markdownKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: toggleInlineMark('**') },
  { key: 'Mod-i', run: toggleInlineMark('*') },
  { key: 'Mod-k', run: insertLink },
  { key: 'Mod-l', run: cycleListMarker },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({ key: `Mod-Shift-${level}`, run: setHeading(level) }))
];
```

참고: `toggleInlineMark('*')`는 `**bold**` 내부 선택 시 볼드 마커 한 겹을 벗기는 알려진 한계가 있다(Obsidian도 유사). v1 허용.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/ui/editor/markdownCommands.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/ui/editor/markdownCommands.ts src/ui/editor/markdownCommands.test.ts
git commit -m "마크다운 편집 커맨드(제목/볼드/이탤릭/링크/목록 순환)를 추가한다"
```

---

### Task 2: 에디터에 keymap·히스토리 연결

**Files:**
- Modify: `src/ui/editor/MarkdownEditor.tsx` (import 블록과 `EditorState.create`의 `extensions` 배열, 현재 `keymap.of([])`이 있는 곳)
- Test: `src/ui/editor/markdownCommands.test.ts` (undo 테스트 추가)

**Interfaces:**
- Consumes: Task 1의 `markdownKeymap`; `@codemirror/commands`의 `history`, `defaultKeymap`, `historyKeymap`, `indentWithTab`, `undo`.
- Produces: 에디터에서 undo/redo(⌘Z/⌘⇧Z), 줄 이동(⌥↑/↓), 들여쓰기(Tab/Shift-Tab), 줄 삭제(⌘⇧K), Task 1 바인딩 전부 동작.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/editor/markdownCommands.test.ts` 끝에 추가:

```ts
import { history, undo } from '@codemirror/commands';

describe('editor history', () => {
  it('reverts the last change with undo', () => {
    let state = EditorState.create({ doc: 'a', extensions: [history()] });
    state = state.update({
      changes: { from: 1, insert: 'b' },
      userEvent: 'input.type'
    }).state;
    expect(state.doc.toString()).toBe('ab');

    undo({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      }
    });
    expect(state.doc.toString()).toBe('a');
  });
});
```

(import는 파일 상단 import 블록에 합친다.)

- [ ] **Step 2: 테스트 실행**

Run: `npx vitest run src/ui/editor/markdownCommands.test.ts`
Expected: PASS — 이 테스트는 라이브러리 검증이므로 바로 통과한다. 실패하면 설치 문제이니 중단하고 보고.

- [ ] **Step 3: MarkdownEditor 연결**

`src/ui/editor/MarkdownEditor.tsx` 수정. import 추가:

```ts
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';

import { markdownKeymap } from './markdownCommands';
```

`EditorState.create`의 extensions에서 `keymap.of([]),` 한 줄을 다음으로 교체:

```ts
        history(),
        keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
```

`markdownKeymap`을 앞에 두어 `defaultKeymap`과 겹치는 키는 우리 바인딩이 우선.

- [ ] **Step 4: 전체 테스트 + 타입체크**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS. 기존 Workspace 테스트는 실제 MarkdownEditor를 렌더링하므로 keymap 추가로 인한 회귀가 여기서 걸러진다.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/editor/MarkdownEditor.tsx src/ui/editor/markdownCommands.test.ts
git commit -m "에디터에 undo 히스토리와 기본 편집 단축키를 연결한다"
```

---

### Task 3: 슬래시 커맨드 확장 (11종 추가)

**Files:**
- Modify: `src/ui/editor/slashCommands.ts` (전체 교체 수준)
- Modify: `src/i18n/messages.ts` (`slashCommand.property` 항목 아래에 ko/en 각각 추가)
- Test: `src/ui/editor/slashCommandAutocomplete.test.ts` (테스트 추가)

**Interfaces:**
- Consumes: 기존 `SlashCommand` 인터페이스(`id`, `labelKey`, `insertText`), `MessageKey` 타입. 자동완성 파이프라인(`buildSlashCommandOptions`)은 수정 불필요 — 배열만 늘리면 된다.
- Produces: `SlashCommandId`에 `'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'checkbox' | 'quote' | 'codeblock' | 'hr' | 'table' | 'callout'` 추가.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/editor/slashCommandAutocomplete.test.ts`의 describe 블록 안에 추가:

```ts
  it('exposes block insertion commands', () => {
    const ids = buildSlashCommandOptions('', messages.ko).map((option) => option.detail);

    expect(ids).toEqual(
      expect.arrayContaining([
        '/heading1',
        '/heading2',
        '/heading3',
        '/bullet',
        '/numbered',
        '/checkbox',
        '/quote',
        '/codeblock',
        '/hr',
        '/table',
        '/callout'
      ])
    );
  });

  it('matches block commands by localized label', () => {
    const options = buildSlashCommandOptions('체크', messages.ko);

    expect(options).toEqual([
      expect.objectContaining({ detail: '/checkbox', apply: '- [ ] ' })
    ]);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/editor/slashCommandAutocomplete.test.ts`
Expected: FAIL — 새 커맨드 id 없음.

- [ ] **Step 3: slashCommands.ts 확장**

`src/ui/editor/slashCommands.ts` 전체를 다음으로 교체:

```ts
import type { MessageKey } from '../../i18n/messages';

export type SlashCommandId =
  | 'link'
  | 'wikilink'
  | 'tag'
  | 'property'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'checkbox'
  | 'quote'
  | 'codeblock'
  | 'hr'
  | 'table'
  | 'callout';

export interface SlashCommand {
  id: SlashCommandId;
  labelKey: MessageKey;
  insertText: string;
}

export const slashCommands: SlashCommand[] = [
  { id: 'link', labelKey: 'slashCommand.link', insertText: '[text](https://example.com)' },
  { id: 'wikilink', labelKey: 'slashCommand.wikilink', insertText: '[[Home]]' },
  { id: 'tag', labelKey: 'slashCommand.tag', insertText: '#tag' },
  { id: 'property', labelKey: 'slashCommand.property', insertText: 'property: value' },
  { id: 'heading1', labelKey: 'slashCommand.heading1', insertText: '# ' },
  { id: 'heading2', labelKey: 'slashCommand.heading2', insertText: '## ' },
  { id: 'heading3', labelKey: 'slashCommand.heading3', insertText: '### ' },
  { id: 'bullet', labelKey: 'slashCommand.bullet', insertText: '- ' },
  { id: 'numbered', labelKey: 'slashCommand.numbered', insertText: '1. ' },
  { id: 'checkbox', labelKey: 'slashCommand.checkbox', insertText: '- [ ] ' },
  { id: 'quote', labelKey: 'slashCommand.quote', insertText: '> ' },
  { id: 'codeblock', labelKey: 'slashCommand.codeblock', insertText: '```\n\n```' },
  { id: 'hr', labelKey: 'slashCommand.hr', insertText: '---\n' },
  {
    id: 'table',
    labelKey: 'slashCommand.table',
    insertText: '| 열 1 | 열 2 |\n| --- | --- |\n|  |  |\n'
  },
  { id: 'callout', labelKey: 'slashCommand.callout', insertText: '> [!note] ' }
];
```

- [ ] **Step 4: i18n 메시지 추가**

`src/i18n/messages.ts`의 ko 객체, `'slashCommand.property': '프로퍼티'` 뒤에 추가:

```ts
  'slashCommand.heading1': '제목 1',
  'slashCommand.heading2': '제목 2',
  'slashCommand.heading3': '제목 3',
  'slashCommand.bullet': '글머리 목록',
  'slashCommand.numbered': '숫자 목록',
  'slashCommand.checkbox': '체크박스',
  'slashCommand.quote': '인용구',
  'slashCommand.codeblock': '코드 블록',
  'slashCommand.hr': '수평선',
  'slashCommand.table': '표',
  'slashCommand.callout': '콜아웃'
```

en 객체, `'slashCommand.property': 'Property'` 뒤에 추가:

```ts
  'slashCommand.heading1': 'Heading 1',
  'slashCommand.heading2': 'Heading 2',
  'slashCommand.heading3': 'Heading 3',
  'slashCommand.bullet': 'Bullet list',
  'slashCommand.numbered': 'Numbered list',
  'slashCommand.checkbox': 'Checkbox',
  'slashCommand.quote': 'Quote',
  'slashCommand.codeblock': 'Code block',
  'slashCommand.hr': 'Horizontal rule',
  'slashCommand.table': 'Table',
  'slashCommand.callout': 'Callout'
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/ui/editor/slashCommandAutocomplete.test.ts && npm run typecheck`
Expected: PASS. (en 누락 시 typecheck이 잡는다.)

- [ ] **Step 6: 커밋**

```bash
git add src/ui/editor/slashCommands.ts src/i18n/messages.ts src/ui/editor/slashCommandAutocomplete.test.ts
git commit -m "슬래시 커맨드에 제목/목록/인용구/코드 블록 등 블록 삽입 11종을 추가한다"
```

---

### Task 4: 앱 단축키 (저장·모드 전환·검색 포커스·새 노트·탭 이동)

**Files:**
- Modify: `src/ui/Workspace.tsx` (editorMode 영속화 useEffect 아래에 keydown effect 추가)
- Test: `src/ui/Workspace.test.tsx` (테스트 추가)

**Interfaces:**
- Consumes: Workspace 내부의 `saveActiveDocument()`, `setEditorMode`, `setSidebarOpen`, `createMarkdownFile()`, `openFile()`, `recentFiles` (모두 기존). 사이드바 검색 input은 `.sidebar-search input` 셀렉터(FileSidebar.tsx의 `<label className="sidebar-search">` 안 input).
- Produces: ⌘/Ctrl+S 저장, ⌘/Ctrl+E 모드 전환, ⌘/Ctrl+⇧+F 검색 포커스, ⌥N 새 노트, ⌥1~9 최근 탭 이동(⌥9는 마지막 탭).

바인딩 근거: ⌘S/⌘E/⌘⇧F는 브라우저에서 preventDefault 가능. ⌘N·⌘1~9는 예약이라 ⌥ 조합 사용. macOS ⌥ 조합은 dead-key 문자를 만들므로 `event.key` 대신 `event.code`(`KeyN`, `Digit1`~`Digit9`)로 판별.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/Workspace.test.tsx`의 모드 토글 테스트 뒤에 추가:

```ts
  it('handles app-level keyboard shortcuts', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    renderWorkspace({ EditorComponent: TestEditor });
    await user.click(screen.getByRole('button', { name: 'Home' }));
    saveDocument.mockClear();

    fireEvent.keyDown(window, { key: 's', metaKey: true });
    await waitFor(() => expect(saveDocument).toHaveBeenCalled());

    fireEvent.keyDown(window, { key: 'e', metaKey: true });
    expect(screen.getByTestId('editor-mode')).toHaveTextContent('source');

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Vault 파일 검색' })).toHaveFocus()
    );

    fireEvent.keyDown(window, { code: 'KeyN', altKey: true });
    expect(window.prompt).toHaveBeenCalledWith('새 Markdown 파일 이름');
  });

  it('switches recent tabs with alt+digit', async () => {
    const user = userEvent.setup();

    renderWorkspace({ EditorComponent: TestEditor });
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Project Note' }));

    fireEvent.keyDown(window, { code: 'Digit1', altKey: true });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Home/ })).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(window, { code: 'Digit9', altKey: true });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Project Note/ })).toHaveAttribute('aria-selected', 'true');
    });
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/Workspace.test.tsx`
Expected: FAIL — 단축키 핸들러 없음 (`saveDocument` 미호출).

- [ ] **Step 3: Workspace에 keydown effect 추가**

`src/ui/Workspace.tsx`, editorMode 영속화 useEffect 바로 아래에 추가:

```tsx
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveActiveDocument();
        return;
      }
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setEditorMode((mode) => (mode === 'source' ? 'live' : 'source'));
        return;
      }
      if (mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSidebarOpen(true);
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('.sidebar-search input')?.focus();
        });
        return;
      }
      if (event.altKey && !mod && event.code === 'KeyN') {
        event.preventDefault();
        void createMarkdownFile();
        return;
      }
      if (event.altKey && !mod && /^Digit[1-9]$/.test(event.code)) {
        const digit = Number(event.code.slice(5));
        const file = digit === 9 ? recentFiles[recentFiles.length - 1] : recentFiles[digit - 1];
        if (file) {
          event.preventDefault();
          void openFile(file);
        }
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });
```

의존성 배열 없음(의도적): 매 렌더마다 재등록해 `saveActiveDocument`/`createMarkdownFile`의 stale closure를 피한다. 리스너 1개 재등록 비용은 무시 가능.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/ui/Workspace.test.tsx`
Expected: PASS. `requestAnimationFrame`이 jsdom에서 비동기라 포커스 검증은 `waitFor`로 감싼 상태다.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/Workspace.tsx src/ui/Workspace.test.tsx
git commit -m "저장, 모드 전환, 검색 포커스, 새 노트, 탭 이동 앱 단축키를 추가한다"
```

---

### Task 5: 사이드바 메뉴 — 경로 복사·Drive에서 열기

**Files:**
- Modify: `src/ui/components/FileSidebar.tsx` (`handleMenuChange` 함수와 그 아래 `<select className="sidebar-item-menu">` 옵션 목록, `SidebarMenuAction` 타입)
- Modify: `src/i18n/messages.ts` (`sidebar.menu.delete` 아래 ko/en 각각 추가)
- Test: `src/ui/components/FileSidebar.test.tsx` (테스트 추가)

**Interfaces:**
- Consumes: `entry: VaultEntry` (kind `'folder' | 'markdown'`, `id`, `path` 필드). 기존 메뉴 액션 처리 패턴(`handleMenuChange`의 action 분기).
- Produces: 메뉴 옵션 `copy-path`(vault 상대 경로 클립보드 복사), `open-drive`(Drive 웹 URL 새 탭). 새 prop 없음 — FileSidebar 내부에서 자체 처리.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/components/FileSidebar.test.tsx`의 기존 describe 안에 추가 (렌더 헬퍼는 기존 것 재사용, 파일 상단 import에 `vi` 있는지 확인):

```ts
  it('copies the vault path from the item menu', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderSidebar();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Home 더보기' }), 'copy-path');

    expect(writeText).toHaveBeenCalledWith('Home.md');
  });

  it('opens the entry in Google Drive from the item menu', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    renderSidebar();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Home 더보기' }), 'open-drive');

    expect(open).toHaveBeenCalledWith(
      'https://drive.google.com/file/d/file-home/view',
      '_blank',
      'noopener'
    );
  });
```

주의: FileSidebar.test.tsx의 기존 렌더 헬퍼 이름이 `renderSidebar`가 아니면 실제 이름에 맞춘다(파일을 먼저 읽고 기존 패턴 재사용). fixture의 Home 파일은 `id: 'file-home'`, `path: 'Home.md'`.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/components/FileSidebar.test.tsx`
Expected: FAIL — `copy-path` 옵션 없음.

- [ ] **Step 3: FileSidebar 구현**

`src/ui/components/FileSidebar.tsx`:

`SidebarMenuAction` 타입에 `'copy-path' | 'open-drive'` 추가 (기존 유니언 뒤에).

`handleMenuChange`의 `delete` 분기 앞에 추가:

```ts
    if (action === 'copy-path') {
      void navigator.clipboard?.writeText(entry.path);
      return;
    }

    if (action === 'open-drive') {
      window.open(driveEntryUrl(entry), '_blank', 'noopener');
      return;
    }
```

`<option value="delete">` 위에 옵션 추가:

```tsx
      <option value="copy-path">{t('sidebar.menu.copyPath')}</option>
      <option value="open-drive">{t('sidebar.menu.openInDrive')}</option>
```

파일 하단 헬퍼 함수 영역에 추가:

```ts
function driveEntryUrl(entry: VaultEntry) {
  return entry.kind === 'folder'
    ? `https://drive.google.com/drive/folders/${entry.id}`
    : `https://drive.google.com/file/d/${entry.id}/view`;
}
```

(`VaultEntry` import는 이 파일에 이미 있음 — 없으면 `../../domain/vault/types`에서 type import.)

- [ ] **Step 4: i18n 메시지 추가**

`src/i18n/messages.ts` ko의 `'sidebar.menu.delete': '삭제'` 뒤:

```ts
  'sidebar.menu.copyPath': '경로 복사',
  'sidebar.menu.openInDrive': 'Drive에서 열기',
```

en의 `'sidebar.menu.delete': 'Delete'` 뒤:

```ts
  'sidebar.menu.copyPath': 'Copy path',
  'sidebar.menu.openInDrive': 'Open in Drive',
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/ui/components/FileSidebar.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/ui/components/FileSidebar.tsx src/i18n/messages.ts src/ui/components/FileSidebar.test.tsx
git commit -m "사이드바 메뉴에 경로 복사와 Drive에서 열기를 추가한다"
```

---

### Task 6: 전체 검증 + 브라우저 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 + 타입체크**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS.

- [ ] **Step 2: 브라우저 검증**

`.claude/launch.json`의 `dev` 서버(포트 5173)로 실행 후 Mock vault 열어 확인:

1. `/제목` 입력 → 슬래시 자동완성에 "제목 1~3" 노출, 선택 시 `# ` 삽입
2. 텍스트 선택 후 ⌘B → `**텍스트**`, 다시 ⌘B → 해제
3. ⌘K → `[선택](url)`에 url 선택됨
4. ⌘L → 일반 줄 → `- ` → `- [ ] ` → 일반 줄 순환
5. ⌘⇧2 → `## ` 설정, 같은 키 재입력 → 제거
6. ⌘Z undo, ⌥↓ 줄 이동, Tab 들여쓰기
7. ⌘E → 원본/라이브 모드 전환, ⌘S → 저장 상태 "저장됨", ⌘⇧F → 검색 포커스, ⌥N → 새 노트 프롬프트
8. 문서 2개 연 뒤 ⌥1/⌥2/⌥9 → 탭 전환
9. 사이드바 항목 ··· 메뉴 → "경로 복사" 클립보드 확인, "Drive에서 열기" 새 탭 URL 확인

Expected: 전부 동작. 라이브 프리뷰 모드에서도 동일 동작(데코레이션은 문서 변경에 자동 반응).

- [ ] **Step 3: 이상 발견 시** 해당 Task로 돌아가 수정 후 재검증. 없으면 종료.

---

## 스코프 제외 (이번 계획에 없음 — 의도적)

전수 판정은 `docs/obsidian-command-palette-review.md` 참조. 이 계획은 적용(신규 22개) + 변형(7개)을 전부 다룬다.

- 후순위 20개: 탭 UX 묶음(이전/다음/다른 탭 닫기/고정), 접기/펼치기 묶음, 커서 추가 묶음, 파일 이동, 각주, 주석, 명령어 팔레트, 뒤로/앞으로, 별칭, 일일 노트, 줄 길이, 줄 번호, 에디터 포커스
- 적용 중 "이미 있음" 9개: 개요 패널×2, 위키링크, 테마 전환, 루트 폴더 변경, 설정, 파일 속성, 좌/우 패널 토글 — 작업 불필요
- 제외 39개: 그래프/백링크/북마크/베이스 등 범위 밖 + 브라우저 소관
