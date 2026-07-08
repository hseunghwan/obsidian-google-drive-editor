# 그래프 뷰 (전체 그래프) 설계

## 요약

Obsidian의 전체 그래프 뷰를 Quartz 방식(d3-force 시뮬레이션 + pixi.js WebGL 렌더링)으로 구현한다.
⌘G로 에디터 자리에 그래프 뷰를 전환해 열고, 노드 클릭으로 문서를 연다. 엣지 데이터는 그래프
첫 열림 시 vault 전체 md를 스캔해 만들고 IndexedDB에 캐시해 재열림은 즉시 뜬다.

배경 조사: Obsidian Publish 실번들 분석 + 오픈소스 비교 결과, vault 규모(수백~수천 노트)에서는
WASM/워커 분리가 불필요하고(병목은 물리 계산이 아니라 렌더링), 메인 스레드 d3-force +
WebGL(pixi) 조합이 검증된 최적점이다. Quartz `graph.inline.ts`(649줄)가 레퍼런스 구현.

로드맵 갱신: `docs/roadmap.md`의 "하지 않음" 표에서 그래프 뷰 항목을 제거하고 착수 사실을 기록한다.

## 확정 결정사항

- **범위**: 전체 그래프만. 로컬 그래프는 v1 제외 (나중에 필터로 추가 가능)
- **데이터 전략**: 그래프 첫 열림에 전체 스캔 + IndexedDB 캐시. 재열림은 modifiedTime 변경분만 재페치
- **UI 배치**: 에디터 자리에 뷰로 전환 (`viewMode: 'editor' | 'graph'`), ⌘G 토글
- **인터랙션**: 줌/팬 + 노드 드래그 + 호버 이웃 하이라이트 + 클릭 이동 + 검색 필터 + 포스 슬라이더 4종
- **.obsidian/graph.json**: 읽기 전용으로 포스 4개 초기값 채택. 슬라이더 변경은 localStorage에만 저장(로컬 값이 graph.json보다 우선). 파일 부재/실패 시 기본값
- **스택**: `pixi.js` v8 + `d3-force` / `d3-zoom` / `d3-drag` / `d3-selection`. 전부 dynamic import — 초기 번들 불변

## 비목표 (v1)

- 로컬 그래프, 태그 노드, 첨부파일 노드, 미해결 링크 노드
- 그래프 열려 있는 동안 실시간 갱신 (다시 열면 반영)
- graph.json 쓰기(양방향 동기화) — 기존 파일 보존 원칙
- WebGL 폴백 렌더러 (실패 시 안내 문구만)
- 색상 그룹, 화살표 표시 등 Obsidian 고급 표시 옵션

## 컴포넌트

신규 5개, 수정 2개.

### graphModel (`src/domain/graph/graphModel.ts`) — 신규, 순수 로직

- 입력: `VaultFile[]` + 파일별 `wikiLinks: string[]`(Map)
- 출력: `{ nodes, edges }` — 노드는 전체 md 파일(고아 포함), 엣지는 해석된 링크만
- 링크 해석: 기존 `Workspace.findWikiLinkFile`의 title/path 대소문자 무시 매칭 로직을
  domain 함수로 추출해 Workspace와 공유 (중복 구현 금지)
- 자기 링크 제거, 중복 엣지 병합. 노드에 연결 수(degree) 포함

### graphLinkStore (`src/storage/graphLinkStore.ts`) — 신규

- IndexedDB 캐시: `{ fileId, modifiedTime, wikiLinks: string[] }`
- 기존 `draftStore.ts` 패턴 복제 (put/get/getAll/delete)

### graphScanner (`src/app/graphScanner.ts`) — 신규

- VaultIndex의 md 목록 ↔ 캐시 대조 → modifiedTime 불일치/미존재 파일만
  `DriveVaultAdapter.readFile`로 페치 (동시성 6 제한)
- 파일별 `extractMarkdownMetadata`(기존)로 wikiLinks 추출 → 캐시 갱신
- 진행률 콜백 (완료 n / 전체), 중단 플래그 지원
- 개별 파일 실패: 건너뛰고 계속. 캐시에 옛 데이터 있으면 사용. 실패 목록 반환

### GraphView (`src/ui/graph/GraphView.tsx`) — 신규

- 에디터 자리에 마운트되는 React 컴포넌트
- 마운트 시: 무거운 모듈(d3-*, pixi.js, graphRenderer) dynamic import + 스캔 시작 + graph.json 로드
- 스캔 진행률 표시, 실패 배너("n개 파일 읽기 실패" + 재시도 버튼), 빈 vault 문구, WebGL 실패 문구
- 검색 필터 입력, 포스 슬라이더 패널 렌더
- 언마운트 시: 스캔 중단(부분 캐시 유지) + 렌더러 destroy

### graphRenderer (`src/ui/graph/graphRenderer.ts`) — 신규, 명령형 코어

- `create(container, data, options)` → `{ destroy, setForces, setSearch, on(nodeClick|nodeHover) }`
- pixi Application(WebGL, 배경 투명) + d3-force 시뮬레이션 (Quartz graph.inline.ts 대응물)
- 그리기: 노드 = Graphics 원(반지름 = degree sqrt 스케일), 라벨 = Text(줌 따라 페이드),
  엣지 = tick마다 Graphics.clear() 후 재그리기
- 포스 매핑: `forceCenter`(centerStrength) / `forceManyBody`(-repelStrength 스케일) /
  `forceLink`(linkStrength, linkDistance) / `forceCollide` 고정
- 줌/팬 = d3-zoom(canvas 부착, transform → pixi 루트 Container).
  드래그 = d3-drag(드래그 중 fx/fy 고정 + alphaTarget 재가열)
- 호버: 이웃 하이라이트 + 나머지 딤. 검색: 매칭 외 딤(제거 아님)
- 색상: CSS 변수에서 읽음(라이트/다크 자동 대응). ResizeObserver로 리사이즈
- 시뮬레이션 idle(alphaMin) 시 렌더 루프 정지, 인터랙션 시 재개

### Workspace / workspaceReducer — 수정

- `viewMode: 'editor' | 'graph'` 상태 추가, ⌘G 토글
- `findWikiLinkFile` 로직을 domain으로 추출하고 호출부 교체
- 노드 클릭 → `openFile` → viewMode 'editor' 복귀

## 데이터 흐름

1. ⌘G → viewMode 'graph' → GraphView 마운트 → dynamic import (기존 언어 파서 lazy 청크 패턴)
2. graph.json 로드: Drive에서 `.obsidian/graph.json` 조회(없으면 무시) → localStorage 저장값이
   있으면 그것이 우선 → 포스 초기값 결정
3. 스캔: 캐시 대조 → 변경분만 페치 → 메타 추출 → 캐시 갱신 (진행률 표시)
4. graphModel로 nodes/edges 구성 → graphRenderer 생성
5. 노드 클릭 → 문서 열기 + 에디터 복귀. 재진입 시 캐시 워밍이면 페치 0건, 즉시 렌더

## 에러 처리

- 개별 파일 페치 실패: 스캔 계속, 배너 + 재시도 버튼, 옛 캐시 데이터 활용
- 스캔 중 이탈: 중단, 부분 캐시 유지 (다음 열림에 이어서)
- graph.json 실패/부재: 조용히 기본값
- WebGL 초기화 실패: 안내 문구
- 빈 vault: 빈 상태 문구

## 테스트

- `graphModel.test.ts`: 해석 규칙(title/path/대소문자), 자기링크 제거, 중복 병합, 고아 포함
- `graphScanner.test.ts`: fake adapter + fake-indexeddb — 전체 스캔 / modifiedTime 불변 시
  페치 0건 / 부분 실패 허용 / 중단
- `graphLinkStore.test.ts`: 저장/조회 왕복
- `workspaceReducer.test.ts`: viewMode 전환
- `GraphView.test.tsx`: 렌더러 mock — 진행률·에러 배너·클릭 콜백
- graphRenderer: jsdom에 WebGL 없어 단위 테스트 제외 — dev 서버 실물 검증
