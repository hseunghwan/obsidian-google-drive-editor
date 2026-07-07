# Chrome Web Store Listing Draft

Product: Obsidian for Google Drive

Chrome Web Store URL:
https://chromewebstore.google.com/detail/obsidian-vault-editor-for/fegekndlnlkbnkopphbokolacfemldge

## Notes

- Chrome automation could not open the installed `chrome-extension://fegekndlnlkbnkopphbokolacfemldge/index.html` page because extension URLs are blocked by the browser automation security policy.
- I reviewed the running app through the local Chrome surface instead and used the built-in mock vault to capture the actual workspace, search, metadata, and settings flows.
- Official Chrome Web Store guidance says product details can be localized, localized screenshots can be provided per locale, and small/marquee promo tiles are not localized.
- Official image sizes used here:
  - Screenshots: 1280 x 800
  - Small promo tile: 440 x 280
  - Marquee promo tile: 1400 x 560

Sources:
- https://developer.chrome.google.cn/docs/webstore/cws-dashboard-listing?hl=en
- https://developer.chrome.google.cn/docs/webstore/images

## English Product Details

Name:
Obsidian for Google Drive

Short description:
Edit Google Drive Markdown vaults with live preview, wiki links, and slash commands — an Obsidian-style workspace in Chrome.

Category:
Productivity

Language:
English

Detailed description:

Obsidian for Google Drive turns a Google Drive folder full of Markdown files into a focused browser workspace. Open a Drive folder like a vault, write in a live-preview Markdown editor, jump between notes with wiki links, and save everything back to Drive — no desktop app required, and your files never change format.

Live preview editing:

- Live preview that hides Markdown syntax while you write — headings, bold, quotes, tables, callouts, highlights, checklists, and images render in place, and the raw text reappears where your cursor is
- One-click toggle (Cmd/Ctrl+E) between live preview and raw source mode
- Syntax highlighting for fenced code blocks in dozens of languages
- Clickable checkboxes, foldable headings, and a readable centered line length
- Your files stay plain Markdown — nothing is reformatted or converted

Navigate like a vault:

- Click wiki links to jump between notes; unresolved links create the note in place
- Quick switcher (Cmd/Ctrl+O) with recent-file ranking
- Back/forward history (Cmd/Ctrl+[ and ]), recent tabs with Alt+1–9
- Full-text search across your vault, powered by Drive search
- Outline, YAML frontmatter properties, and tags in a side panel

Write faster:

- 15 slash commands: headings, lists, checkboxes, quotes, code blocks, tables, callouts, links, and more
- Editing shortcuts: bold, italic, link, heading levels, list/checkbox cycling, undo history, find and replace (Cmd/Ctrl+F)
- Auto-continued lists and checkboxes, tag autocompletion, wiki-link autocompletion
- Templates with {{title}}, {{date}}, {{time}} variables (Alt+T) and daily notes (Alt+D)
- Built-in shortcut reference from the sidebar help button

Built on Google Drive:

- Version history: browse and restore previous Drive revisions of any note
- Remote change detection warns you before two devices overwrite each other
- Local drafts preserve your writing when saving fails
- Move files between folders, open items directly in Drive, trash-based delete
- Automatic token refresh and request retry for long sessions
- Reopens your last note when you come back

Why install it:

Use it when you want your Markdown vault to stay in Google Drive, but you still want a fast, familiar writing environment in Chrome. It is especially useful on shared computers, work machines, or lightweight setups where installing a full desktop editor is inconvenient.

Permissions and data:

The extension requests Google Drive access so it can open, create, and save Markdown files in the vault folder you choose. Your documents remain Google Drive files. If saving fails, a local browser draft may be kept so your writing is not lost.

This extension is not affiliated with Google LLC or Obsidian.

## Korean Product Details

이름:
Obsidian for Google Drive

짧은 설명:
라이브 프리뷰, 위키 링크, 슬래시 커맨드로 Google Drive Markdown vault를 편집하는 Obsidian 스타일 작업 공간.

카테고리:
Productivity

언어:
한국어

상세 설명:

Obsidian for Google Drive는 Google Drive에 보관한 Markdown 폴더를 Chrome 안의 노트 작업 공간으로 바꿔 줍니다. Drive 폴더를 vault처럼 열고, 문법 기호가 사라지는 라이브 프리뷰 편집기로 글을 쓰고, 위키 링크로 노트 사이를 오가며, 그대로 Drive에 저장합니다. 파일 포맷은 절대 바뀌지 않습니다.

라이브 프리뷰 편집:

- 쓰는 동안 Markdown 문법이 숨고 서식이 바로 보이는 라이브 프리뷰 — 제목, 볼드, 인용, 표, 콜아웃, 하이라이트, 체크리스트, 이미지가 제자리에서 렌더링되고 커서를 올리면 원문이 나타납니다
- Cmd/Ctrl+E로 라이브 프리뷰 ↔ 원본 텍스트 모드 전환
- 코드블록 언어별 구문 하이라이팅
- 클릭으로 완료하는 체크박스, 헤딩 접기, 읽기 좋은 중앙 정렬 본문
- 파일은 항상 순수 Markdown 그대로 — 재포맷이나 변환 없음

vault처럼 탐색:

- 위키 링크 클릭으로 노트 이동, 없는 노트는 클릭 즉시 생성
- 빠른 전환기(Cmd/Ctrl+O) — 최근 파일 우선 파일명 점프
- 문서 이동 히스토리(Cmd/Ctrl+[ / ]), 최근 탭 이동(Alt+1~9)
- Drive 검색 기반 vault 전체 본문 검색
- 문서 목차, YAML frontmatter 프로퍼티, 태그 패널

더 빠른 작성:

- 슬래시 커맨드 15종: 제목, 목록, 체크박스, 인용구, 코드 블록, 표, 콜아웃, 링크 등
- 편집 단축키: 볼드, 이탤릭, 링크, 제목 설정, 목록↔체크박스 순환, 실행 취소, 찾기/바꾸기(Cmd/Ctrl+F)
- Enter 시 목록·체크박스 자동 이어가기, 태그·위키링크 자동완성
- {{title}} {{date}} {{time}} 변수를 지원하는 템플릿(Alt+T)과 일일 노트(Alt+D)
- 사이드바 도움말 버튼에서 전체 단축키 확인

Google Drive 위에서:

- 버전 기록 — 노트의 이전 Drive 버전을 열람하고 복원
- 원격 변경 감지 — 다른 기기에서 수정되면 덮어쓰기 전에 경고
- 저장 실패 시 로컬 초안 보존
- 폴더 간 파일 이동, Drive 웹에서 바로 열기, 휴지통 기반 삭제
- 토큰 자동 갱신과 요청 재시도로 긴 세션에도 안정적
- 다음 실행 때 마지막 문서 자동 복원

설치하면 좋은 경우:

Markdown vault는 Google Drive에 그대로 두고 싶지만, 어디서든 Chrome만 있으면 빠르게 열고 편집하고 싶을 때 유용합니다. 회사 PC, 공용 PC, 가벼운 노트북처럼 데스크톱 편집기를 설치하기 어려운 환경에서도 기존 Drive 노트를 이어서 다룰 수 있습니다.

권한과 데이터:

이 확장 프로그램은 사용자가 선택한 vault 폴더의 Markdown 파일을 열고, 만들고, 저장하기 위해 Google Drive 접근 권한을 요청합니다. 문서 내용은 Google Drive 파일로 유지됩니다. 저장 실패가 발생하면 작성 중인 내용을 잃지 않도록 브라우저 로컬 초안이 보존될 수 있습니다.

이 확장 프로그램은 Google LLC 또는 Obsidian과 공식 제휴 관계가 없습니다.

## Localized Screenshots

English localized screenshots:

1. `docs/store-assets/localized/en/screenshot-01-edit-drive-vault.png`
2. `docs/store-assets/localized/en/screenshot-02-search-drive-vault.png`
3. `docs/store-assets/localized/en/screenshot-03-settings-workspace.png`

Korean localized screenshots:

1. `docs/store-assets/localized/ko/screenshot-01-drive-vault-editing.png`
2. `docs/store-assets/localized/ko/screenshot-02-vault-search.png`
3. `docs/store-assets/localized/ko/screenshot-03-settings.png`

## Global Screenshots

Upload these in the non-localized/global screenshot section:

1. `docs/store-assets/global/screenshot-01-workspace.png`
2. `docs/store-assets/global/screenshot-02-search.png`
3. `docs/store-assets/global/screenshot-03-settings.png`

## Promotional Tiles

Small promo tile:

- `docs/store-assets/promotional/small-promo-tile-440x280.png`

Marquee promo tile:

- `docs/store-assets/promotional/marquee-promo-tile-1400x560.png`

## Suggested Upload Order

For each locale, upload the localized screenshots in this order:

1. Edit Drive Markdown vaults anywhere
2. Find notes across folders fast
3. Use the same vault in your language

Then upload the global screenshots:

1. Workspace
2. Search
3. Settings

Chrome Web Store displays localized screenshots before global screenshots when both are present.
