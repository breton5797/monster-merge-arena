# CLAUDE.md — Monster Merge Arena

## 프로젝트 개요
3분 동안 몬스터를 합성해 팀을 만들고, 몰려오는 적을 막아내는 모바일 우선 캐주얼 게임.
핵심 재미는 "이 둘을 합치면 뭐가 나올까?"라는 **합성 발견**이며, 발견한 조합은 도감에 기록된다.
현재 목표는 **시제품(Prototype)으로 핵심 질문을 검증**하는 것:
> 합성 결과를 알아가는 재미가 반복 플레이를 만드는가?

상세 기획: `docs/PRD.md`, `docs/GAME_DESIGN.md` / 밸런스 데이터: `src/data/*.json`

## 기술 스택
- Phaser 3.90 + TypeScript(strict) + Vite
- 데이터 주도 설계: 몬스터·합성·스테이지·적은 전부 JSON (코드에 수치 하드코딩 금지)
- 저장: localStorage (도감, 최고 기록, 설정) — `SaveService`로만 접근
- 배포: 시제품은 웹 빌드(Vercel 또는 itch.io) → 검증 후 Capacitor(Android/iOS) → Steam(Electron 또는 Tauri)은 별도 검토
- 화면: 세로 720×1280 기준, `Phaser.Scale.FIT` + 가운데 정렬

## 디렉토리 구조
```
monster-merge-arena/
├── CLAUDE.md
├── docs/
│   ├── PRD.md
│   ├── GAME_DESIGN.md
│   └── PROMPTS.md          # 단계별 작업 지시문
├── src/
│   ├── main.ts             # Phaser 게임 설정
│   ├── scenes/
│   │   ├── BootScene.ts    # 에셋/데이터 로드
│   │   ├── MenuScene.ts    # 시작, 스테이지 선택, 도감 진입
│   │   ├── BattleScene.ts  # 3분 전투 본체
│   │   ├── PickScene.ts    # 라운드 3택 오버레이 (BattleScene 일시정지)
│   │   ├── ResultScene.ts  # 승패, 신규 발견, 다시하기
│   │   └── CodexScene.ts   # 도감
│   ├── systems/
│   │   ├── MergeSystem.ts  # 합성 판정 (순수 함수, Phaser 의존 없음)
│   │   ├── CombatSystem.ts # 타깃팅, 공격, 데미지, 상성
│   │   ├── WaveSystem.ts   # 스테이지 타임라인대로 적 생성
│   │   ├── PickSystem.ts   # 3택 생성 (가중치·보정)
│   │   └── BoardSystem.ts  # 8칸 배치, 드래그&드롭
│   ├── entities/
│   │   ├── Monster.ts
│   │   └── Enemy.ts
│   ├── services/
│   │   ├── SaveService.ts
│   │   ├── Analytics.ts    # 이벤트 로깅 (시제품: console + localStorage 큐)
│   │   └── AdService.ts    # 스텁만. 시제품에서는 광고 미노출
│   ├── data/
│   │   ├── monsters.json   # 기본 10 + 합성 15 + 키메라
│   │   ├── fusions.json    # 합성 레시피
│   │   ├── elements.json   # 상성표
│   │   ├── enemies.json
│   │   ├── stages.json     # 3스테이지 + 보스
│   │   └── config.json     # 보드·에너지·3택 등 전역 수치
│   ├── ui/                 # 버튼, HP바, 타이머, 토스트
│   └── types.ts            # JSON 스키마 타입
├── tests/
│   └── merge.test.ts       # Vitest: 합성 규칙 단위 테스트
├── public/assets/          # 스프라이트(초기엔 도형+이모지 플레이스홀더)
└── package.json
```

## 개발 규칙
- TypeScript strict, `any` 금지. JSON은 `types.ts` 타입으로 로드 시 검증
- 게임 로직(합성·상성·픽 생성)은 **Phaser와 분리된 순수 함수**로 작성하고 Vitest로 테스트
- 수치 변경은 JSON만 수정. 코드에 매직넘버가 생기면 `src/data/config.json`으로 이동
- 아트는 플레이스홀더 우선(속성 색 원 + 이모지 + 이름). 재미 검증 전 아트 작업 금지
- 모든 핵심 행동에 Analytics 이벤트 호출 (목록은 GAME_DESIGN.md §9)
- 커밋: conventional commits (`feat:`, `fix:`, `balance:`, `chore:`)
- 모바일 터치 우선: 드래그 판정 영역은 실제 스프라이트보다 넉넉하게(최소 88px)
- 매 Phase 종료 시 `npm run build` 통과 + 브라우저에서 직접 1판 플레이 가능해야 완료

## 현재 Phase
Phase 1 — 시제품 개발 (`docs/PROMPTS.md`의 Step 0부터 순서대로)

## 우선 구현할 기능
1. 8칸 보드 + 레인형 자동 전투 + 3분 타이머
2. 드래그 합성 (같은 몬스터=★강화, 레시피 조합=신규 몬스터, 그 외=키메라)
3. 20초마다 3택 선택지
4. 도감 (발견 기록, 미발견은 실루엣 + 힌트)
5. 스테이지 3개 + 보스 1종

## 알아야 할 특이사항
- 같은 회사의 운영 중인 게임 "타이니 가디언즈"(Phaser 3.90 + TS + Vite, 머지+디펜스)와 기술 스택이 같다. 공통으로 쓸 수 있는 코드(스케일 설정, 드래그, 사운드, 저장)는 재사용하되, **이 게임의 차별점은 '다른 몬스터끼리의 합성 발견 + 도감'** 이므로 같은 몬스터 강화가 주가 되지 않도록 밸런스를 유지할 것
- 반복되는 모듈(SaveService, Analytics, AdService, UI 컴포넌트)은 향후 공통 모듈 "Arcade Core"로 분리할 예정 → 게임 특화 코드와 섞지 말 것
- 수익화 코드는 시제품에서 스텁만. 모바일(무료+광고제거/꾸미기)과 Steam(유료 완전판)은 과금 구조를 다르게 가져갈 것이므로 `AdService`/`StoreService`를 플랫폼별로 교체 가능한 인터페이스로 둘 것
