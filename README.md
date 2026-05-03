# Obsidian Google Drive Editor

Google Drive 폴더를 Obsidian-lite vault처럼 열어 Markdown 파일을 편집하는 Chrome 확장 MVP입니다. Obsidian이 설치되어 있지 않은 PC에서도 브라우저 기반 확장 화면에서 Drive의 Markdown vault를 탐색하고 편집하는 흐름을 목표로 합니다.

## 주요 기능

- Google Drive 폴더를 vault root로 연결
- Markdown 파일 탐색, 열기, 저장
- 사이드바 파일 검색과 breadcrumb 이동
- 파일/폴더 생성
- YAML frontmatter 프로퍼티와 태그 표시
- 내부 링크 후보 검색과 slash command 자동완성
- 저장 실패 시 IndexedDB 기반 local draft 보존
- 원격 변경 충돌 감지
- 한국어/영어 UI 전환
- 라이트/다크 테마 전환

## 기술 스택

- React 19
- TypeScript
- Vite
- Chrome Extension Manifest V3
- CodeMirror 6
- Google Drive API
- Vitest

## 시작하기

```bash
npm ci
npm run dev
```

로컬 웹 테스트 URL:

```text
http://127.0.0.1:5173/
```

로컬 웹 화면에서는 Chrome extension API가 없기 때문에 실제 Google Drive 연결은 동작하지 않습니다. UI를 빠르게 확인하려면 `Mock vault 열기`를 사용하세요.

## Chrome 확장으로 로드하기

먼저 production bundle을 생성합니다.

```bash
npm run build
```

그 다음 Chrome에서:

1. `chrome://extensions` 열기
2. 우측 상단 `Developer mode` 켜기
3. `Load unpacked` 클릭
4. 이 저장소의 `dist/` 폴더 선택
5. 확장 아이콘을 눌러 workspace 열기

## Chrome Web Store 배포 패키지 만들기

Workspace Marketplace 등록 없이 Chrome 확장으로 먼저 배포할 때는 Chrome Web Store에 `release/*.zip` 파일을 업로드합니다.

```bash
VITE_GOOGLE_OAUTH_CLIENT_ID=<Chrome Extension OAuth client id> npm run package:chrome
```

이 명령은 `npm run build`를 먼저 실행한 뒤 `dist/manifest.json`에 실제 OAuth client id가 들어갔는지 확인하고, 업로드용 zip을 `release/` 아래에 생성합니다. OAuth client id placeholder가 남아 있으면 패키징을 중단합니다.

Chrome Web Store 제출 전에는 다음 항목을 준비하세요.

- 확장 이름/설명/아이콘
- 개인정보 처리방침 URL
- Google Drive 권한 사용 사유
- 수동 테스트 결과
- 스토어 스크린샷과 소개 문구

Google Workspace Marketplace와 Drive UI `Open with` 등록은 이 릴리스 범위에서 제외합니다.

## Google Drive OAuth 설정

실제 Drive vault 연결을 테스트하려면 Google Cloud 설정이 필요합니다.

1. Google Cloud project 생성
2. Google Drive API 활성화
3. Chrome Extension OAuth client 생성
4. `dist/`를 unpacked extension으로 한 번 로드한 뒤 extension id 확인
5. OAuth client 설정에 extension id 등록
6. 발급받은 client id를 `.env.local`의 `VITE_GOOGLE_OAUTH_CLIENT_ID`에 입력
7. 다시 `npm run build` 또는 `npm run package:chrome`
8. Chrome 확장 화면에서 Reload

현재 확장은 기존 Drive 폴더 vault를 재귀적으로 읽고 저장하기 위해 다음 scope를 사용합니다.

```text
https://www.googleapis.com/auth/drive
```

`drive.file`은 앱이 열었거나 생성한 파일 중심으로 접근을 제한하기 때문에, 이미 존재하는 임의의 Obsidian vault 폴더 안 Markdown 파일을 읽을 때 `appNotAuthorizedToFile` 오류가 발생할 수 있습니다. 이 MVP는 사용자가 선택한 기존 vault 전체를 편집하는 흐름을 우선하므로 full Drive scope를 사용합니다.

Manifest V3 확장 페이지에서는 원격 Google Picker JavaScript를 직접 로드하지 않습니다. Drive vault root는 확장 내부의 Drive 폴더 탐색기에서 선택합니다.

## 검증 명령

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

## 프로젝트 문서

- 설계 문서: `docs/superpowers/specs/2026-05-03-drive-backed-obsidian-lite-design.md`
- 한국어 설계 문서: `docs/superpowers/specs/2026-05-03-drive-backed-obsidian-lite-design.ko.md`
- 구현 계획: `docs/superpowers/plans/2026-05-03-drive-backed-obsidian-lite-mvp.md`
- 한국어 구현 계획: `docs/superpowers/plans/2026-05-03-drive-backed-obsidian-lite-mvp.ko.md`
- 수동 검증 체크리스트: `docs/manual-checks/drive-extension-mvp.md`
- MV3/Drive 통합 이슈 기록: `docs/solutions/integration-issues/mv3-drive-vault-integration-2026-05-03.md`

## 현재 제약

- OAuth client id가 placeholder면 실제 Drive 연결은 실패합니다.
- Google Drive live save는 Google Cloud credential과 테스트 Drive 폴더가 준비된 뒤 수동 검증해야 합니다.
- Google Picker 정식 UI는 MVP 범위에서 제외되어 있으며, 확장 내부 Drive 폴더 탐색기로 대체되어 있습니다.
- Graph view, backlinks, Dataview, canvas, advanced block reference는 MVP 범위에 포함되지 않습니다.
