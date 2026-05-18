# Chrome Web Store Listing Draft

Product: Obsidian Vault Editor for Google Drive

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
Obsidian Vault Editor for Google Drive

Short description:
Edit Google Drive Markdown vaults with an Obsidian-like workspace.

Category:
Productivity

Language:
English

Detailed description:

Obsidian Vault Editor for Google Drive turns a Google Drive folder full of Markdown files into a focused browser workspace. Open a Drive folder like a vault, browse your existing note structure, edit Markdown, review properties and tags, and save changes back to Drive without installing a desktop note app.

It is built for people who already keep notes, meeting records, project docs, personal knowledge bases, or technical writing in Markdown. The extension keeps your files in Google Drive and gives you a calm, Obsidian-inspired interface inside Chrome.

Key features:

- Connect a Google Drive folder as a Markdown vault
- Browse nested folders and Markdown files without moving your files
- Search notes by file name and path
- Edit Markdown in a focused editor
- Create new Markdown files and folders
- Save manually or rely on autosave status feedback
- Preserve local drafts when Drive saving fails
- Detect remote changes to reduce accidental overwrites
- View YAML frontmatter properties, tags, and document outline
- Use slash-command helpers for Markdown links, wiki links, tags, and properties
- Switch between English and Korean UI
- Use a dark, compact workspace designed for writing

Why install it:

Use it when you want your Markdown vault to stay in Google Drive, but you still want a fast, familiar writing environment in Chrome. It is especially useful on shared computers, work machines, or lightweight setups where installing a full desktop editor is inconvenient.

Permissions and data:

The extension requests Google Drive access so it can open, create, and save Markdown files in the vault folder you choose. Your documents remain Google Drive files. If saving fails, a local browser draft may be kept so your writing is not lost.

This extension is not affiliated with Google LLC or Obsidian.

## Korean Product Details

이름:
Obsidian Vault Editor for Google Drive

짧은 설명:
Google Drive Markdown vault를 Obsidian처럼 편집합니다.

카테고리:
Productivity

언어:
한국어

상세 설명:

Obsidian Vault Editor for Google Drive는 Google Drive에 보관한 Markdown 폴더를 Chrome 안에서 바로 편집할 수 있는 작업 공간으로 바꿔 줍니다. Drive 폴더를 vault처럼 열고, 기존 폴더 구조를 그대로 탐색하며, Markdown 문서를 작성하고, 프로퍼티와 태그를 확인한 뒤 다시 Drive에 저장할 수 있습니다.

이미 Google Drive에 개인 노트, 업무 메모, 회의록, 프로젝트 문서, 기술 문서를 Markdown으로 관리하고 있다면 특히 잘 맞습니다. 파일을 다른 서비스로 옮기지 않고 Drive에 그대로 두면서, Chrome 안에서 Obsidian에 익숙한 밀도 있는 편집 환경을 사용할 수 있습니다.

주요 기능:

- Google Drive 폴더를 Markdown vault로 연결
- 기존 폴더와 Markdown 파일 구조를 유지한 채 탐색
- 파일 이름과 경로 기반 검색
- 집중형 Markdown 편집기
- 새 Markdown 파일과 폴더 생성
- 수동 저장과 자동 저장 상태 표시
- Drive 저장 실패 시 로컬 초안 보존
- 원격 변경 감지로 덮어쓰기 위험 완화
- YAML frontmatter 프로퍼티, 태그, 문서 목차 확인
- Markdown 링크, 위키 링크, 태그, 프로퍼티 입력을 돕는 slash command
- 한국어와 영어 UI 전환
- 글쓰기에 집중하기 좋은 어두운 작업 공간

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
