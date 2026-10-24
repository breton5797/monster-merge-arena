# 구현 노트 — Phase 1 시제품

`PROMPTS.md` Step 0~9 구현 결과와, 문서만으로는 정해지지 않아 구현하며 내린 결정을 기록한다.

## 실행

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크 + 프로덕션 빌드 (`dist/` → Vercel/itch.io 업로드) |
| `npm test` / `npm run coverage` | Vitest 단위·통합 테스트 / 커버리지 |
| `npm run e2e` | Playwright E2E (프로덕션 빌드를 모바일 세로 화면으로) |
| `npm run sim -- --runs 100 [--stage 3] [--seed 5000]` | 무작위 합성 봇 밸런스 시뮬레이션 |

URL 옵션: `?debug=1` (이벤트 로그 패널, 🧪 몬스터 소환 패널, F키 4배속), `?debug=1&bot=1` (봇 자동 플레이).

## 구조

- `src/systems/Battle.ts` — **Phaser 의존 없는 전투 모델**. BattleScene은 이 모델을 그리기만 하고, 테스트·`npm run sim`·디버그 봇이 같은 모델을 쓴다. 모델은 연출용 이벤트(`BattleEvent`)를 내보내고 `views/BattleFeedback.ts`가 연출·사운드로 바꾼다.
- 순수 함수: `MergeSystem`, `PickSystem`(시드 RNG 주입), `WaveSystem`, `elements`, `layout`.
- 스킬 18종: `src/systems/skills/` 레지스트리(`SKILLS: Record<SkillId, …>` — 누락 시 컴파일 에러). 파라미터는 `monsters.json`에서 읽고, 필수 파라미터는 `types.ts`의 `SKILL_PARAMS`로 로드 시 검증.
- Arcade Core 분리 후보: `services/`(Save, Analytics, Sound, Haptics, Ad/Store 인터페이스), `ui/`(Button, HpBar, Toast, theme).
- 전투 모델 내부 상태는 성능상 가변 객체로 두되, 변경은 `Battle`과 `systems/` 안으로 한정했다. 저장 데이터(`SaveService`)와 순수 함수는 불변.

## 규칙 해석 (문서가 모호했던 부분)

| 항목 | 결정 | 근거 |
|---|---|---|
| 같은 종 ★ 다름 | invalid (키메라 아님) | §4 표 4행 "★ 다름". 서로 다른 종은 ★가 달라도 레시피/키메라 판정 (★ = 평균 내림) |
| 키메라끼리 / tier2 같은 종 | ★강화 가능 | §4 1행 "같은 종, 같은 ★"에 예외 없음 |
| 기절한 앞줄 몬스터 | 적을 막지 못함 → 통과해 기지 피해 | 기절 중에도 막으면 방어가 실패하지 않음 |
| 앞줄 원거리 몬스터 | 적을 막음 | §3 "그 레인 앞줄 몬스터를 공격" — 타입 구분 없음 |
| 보스 스테이지 3:00 경과 시 보스 생존 | 보스를 잡을 때까지 연장전(타이머 "보스!") | §8 "보스 처치 + 3:00 생존" |
| 진흙거인 도발 | 옆 레인 **앞줄이 비었거나 기절**일 때 그 레인 적을 끌어와 막음 | "옆 레인 적까지 끌어와 막음" |
| 자석골렘 | 같은 레인 비행 적을 지상으로 (근접 공격·막기 가능) | "비행 적 끌어내림" |
| 도감 기본 몬스터 | 보드에 처음 나오면 자동 기록 (발견 이벤트는 레시피·키메라만) | KPI "레시피 발견률"을 흐리지 않기 위해 |
| 3택 "새 조합" 보정 카드 | 카드에 "✨ 새 조합 가능?" 리본 | 무엇이 나올지는 숨김 |
| 드래그 중 대상 칸 | 초록 = 합성 가능, 빨강 = 불가 | 결과는 스포일러하지 않고 가능 여부만 |

## 저장 데이터 확장 (§11)

`tutorialDone: boolean`, `sessions: number`를 추가했다 (첫 판 튜토리얼, `session_start.isFirstSession`). 버전은 1 유지 — 누락 필드는 기본값으로 채운다.

## config.json 추가 항목

`layout`(화면 영역·반지름), `combat`(투사체 속도, 최소 피해, 보스 레인, 오라 주기, 도발 이동 배율), `fx`(슬로모션 배율, 디버그 배속, 흔들림, 토스트, 튜토리얼 손가락) — 코드 매직넘버를 옮긴 것.

## 밸런스 1차 (2026-10-24, `npm run sim`)

원본 수치로는 무작위 봇 승률이 1스테이지 5~10%, 2·3스테이지 0%였다. 원인: 1스테이지에서 180초 동안 약 11.5k HP(약 64 DPS 필요)가 레인 단위로 몰려오고, 2스테이지 마지막 웨이브는 60초간 젤리몹 ~100마리(HP 2배), 보스는 HP 6000·공격 40(앞줄을 6초 만에 기절시키고 999 피해로 즉사).

| 변경 | 이전 → 이후 |
|---|---|
| `config.startingMonsters` | 3 → 4 (레인 4개를 처음부터 커버) |
| `config.energy.summonCostStep` | 5 → 3 |
| `enemies.*.energy` | ×2 (goo 4, imp 4, beetle 10, crow 6, splitter 6, shaman 8) |
| 스테이지 1 웨이브 | hpScale ×0.8, everySec ÷0.7 |
| 스테이지 2 웨이브 | hpScale ×0.55, everySec ÷0.55 |
| 스테이지 3 웨이브(보스 제외) | hpScale ×0.45, everySec ÷0.45 |
| 킹 키메라 | HP 6000 → 2800, 공격 40 → 15 |
| `config.layout.monsterRadius` | (신규) 40 — 뒷줄 이름이 하단 바에 가리지 않게 |
| `queen_bee.skill.minionAtkSpeed` | (신규) 1.0 — 기존 하드코딩 값과 동일 |

결과 (스테이지당 100판 × 시드 3세트): **1스테이지 77~85%, 2스테이지 52~63%, 3스테이지 24~26%** (목표 80 / 50 / 25). 판당 평균 발견 4.3~4.9개 (KPI 기준 4개 이상).

플레이테스트 전에 확인할 것: 무작위 봇은 배치를 거의 안 하므로 사람은 더 잘한다 → 실제 체감 난이도는 낮을 수 있다.

## 코드 리뷰 반영 (2026-10-24)

- 드래그 중 3택이 뜨면 손가락을 떼는 순간 카드가 선택되던 문제 → 같은 카드에서 누른 경우만 선택 + 오버레이 직후 300ms 입력 무시 (`Button`도 동일). E2E 회귀 테스트 포함.
- 리롤 후에도 `pick_shown` 기록 (`rerolled: true`).
- 반사는 보호막을 뚫고 실제로 받은 피해만 반사.
- 꿀벌여왕이 합성·기절로 사라지면 꿀벌도 사라짐. 꿀벌 공격 속도는 `monsters.json` `minionAtkSpeed`.
- 이미 힌트를 받은 레시피는 힌트 카드로 다시 나오지 않음 (도감 힌트 덮어쓰기 방지).
- 중도 포기는 `run_end`에 `quit: true`, 로그 요약의 평균 생존 시간에서 제외.
- 둔화 상한 `config.combat.maxSlowPct`, 꿀벌 위치 `config.layout.minion*`로 이동.

## 알려진 한계

- 디버그 봇(`bot=1`)은 모델을 직접 조작하므로 merge/summon/discovery 분석 이벤트를 남기지 않는다 (사람 입력 경로만 기록).
- 헤드리스 Chromium은 WebGL을 소프트웨어로 그려 FPS가 떨어지고 Phaser 시간도 느려진다 → `playwright.config.ts`에서 GPU 플래그 사용. 실제 브라우저에서는 스테이지 3 전체(4배속)에서 59~61 FPS, 표시 객체 33~58개로 누수 없음.
