# PROMPTS.md — Claude Code 단계별 작업 지시문

사용법: 프로젝트 폴더에서 `claude` 실행 → 아래 Step을 **하나씩** 복사해 붙여넣기.
각 Step이 끝나면 브라우저(`npm run dev`)로 직접 확인하고, 문제 없으면 커밋 후 다음 Step.

---

## Step 0 — 프로젝트 세팅
```
CLAUDE.md와 docs/GAME_DESIGN.md를 먼저 읽어.
Vite + TypeScript(strict) + Phaser 3.90 프로젝트를 이 폴더에 세팅해. 이미 있는 docs/와 src/data/는 건드리지 마.
- 의존성: phaser@3.90, vitest, typescript
- 스크립트: dev, build, preview, test
- src/main.ts: 720x1280 세로, Scale.FIT + CENTER_BOTH, 배경 #111
- src/types.ts: src/data/의 모든 JSON(monsters, fusions, elements, enemies, stages, config)에 대한 타입 정의 + 로드 시 필수 필드 검증 함수 (실패하면 어떤 파일 어떤 항목인지 에러)
- BootScene에서 JSON을 import해 검증하고 레지스트리에 저장 → MenuScene으로 이동
- MenuScene: 제목 "Monster Merge Arena" + [시작] 버튼만
완료 조건: npm run build 통과, 브라우저에서 메뉴가 뜬다.
```

## Step 1 — 합성 로직 (순수 함수 + 테스트)
```
GAME_DESIGN.md §4 합성 규칙을 src/systems/MergeSystem.ts에 Phaser 의존 없는 순수 함수로 구현해.
resolve(a: UnitState, b: UnitState, data): { kind: 'star'|'recipe'|'chimera'|'invalid', resultId?, star? }
- 같은 종 같은 ★(최대 config.maxStar 미만) → star
- tier1+tier1 레시피(순서 무관) → recipe, ★ = floor((a.star+b.star)/2)
- tier1+tier1 레시피 없음 → chimera
- 나머지 → invalid
또 src/systems/elements.ts에 상성 배율 함수 getMultiplier(attacker, defender)를 만들어.
tests/merge.test.ts에 Vitest로 테스트 작성: 15개 레시피 전부 양방향, 키메라 30조합 개수 확인, ★ 상한, tier2/키메라 invalid, 상성 5방향.
그리고 fusions.json의 모든 a/b/result id가 monsters.json에 존재하는지 검증하는 테스트도.
완료 조건: npm test 전부 통과.
```

## Step 2 — 보드 + 드래그 합성 (전투 없이)
```
BattleScene과 BoardSystem을 만들어. GAME_DESIGN.md §2 화면 구성대로.
- 4열×2행 보드. 몬스터는 플레이스홀더: 속성 색 원 + 이모지 + 아래 이름 + ★ 표시
- 시작 시 무작위 기본 몬스터 config.startingMonsters마리 배치
- 드래그: 빈칸에 놓으면 이동, 몬스터 위에 놓으면 MergeSystem.resolve 호출
  - star/recipe/chimera: 결과를 대상 칸에 생성, 원래 칸 비움, 파티클+펀치 스케일 연출
  - invalid: 원위치 트윈 + 좌우 흔들림
- 디버그용으로 하단에 [소환] 버튼(지금은 비용 없이 무작위 기본 몬스터 소환)
- 드래그 판정 영역 최소 config.board.minTouchPx
완료 조건: 브라우저에서 몬스터를 마음대로 합쳐볼 수 있고, 레시피 합성이 제대로 된다.
```

## Step 3 — 적 웨이브 + 자동 전투 + 타이머
```
WaveSystem, CombatSystem, Enemy 엔티티를 만들고 BattleScene에 연결해. GAME_DESIGN.md §3, §8과 stages.json, enemies.json 기준.
- 4레인, 적은 위에서 아래로 이동. stages.json 웨이브 타임라인대로 생성
- 몬스터: 자기 레인의 기지에 가장 가까운 적 공격. melee는 앞줄에서만, 사거리 config.board.meleeReachPx. ranged는 레인 전체(투사체 표시)
- 적이 보드 경계에 닿으면 앞줄 몬스터 공격, 앞줄 비면 통과해 기지 데미지
- flying 적은 앞줄 무시, ranged만 타격 가능
- 몬스터 HP 0 → 기절(회색) config.knockoutSec초 후 50% HP 복귀
- 상성 배율 적용, 데미지 숫자 팝업(유리=크고 주황, 불리=작고 회색)
- 상단 3:00 카운트다운 + 기지 HP 바. HP 0 패배, 시간 종료 승리(stage.bossRequired면 보스까지 처치)
- 적 처치 시 에너지 획득, [소환] 비용 config.energy 규칙 적용
- 이번 Step에서 스킬은 구현하지 마(다음 Step). 기본 공격만.
- ?debug=1이면 F키로 4배속
완료 조건: 스테이지 1을 처음부터 끝까지 플레이할 수 있다.
```

## Step 4 — 몬스터 스킬
```
monsters.json의 skill.id별 동작을 src/systems/skills/에 하나씩 구현하고 레지스트리로 연결해.
(slow_shot, heal_adjacent, reflect, multi_target, lane_slow, revive_once, chain_lanes, taunt_adjacent_lanes, stun_chance, heal_all, burn, ground_flyers, summon_minion, burn_aura, splash, row_shield, crit, poison_cloud)
- 스킬 파라미터는 전부 JSON에서 읽을 것
- 상태이상(둔화·화상·기절·독)은 적 머리 위 작은 아이콘으로 표시
- 레시피 몬스터는 기본 몬스터와 확실히 다르게 느껴져야 한다. 스킬 발동 시 짧은 이펙트 필수
완료 조건: 각 레시피 몬스터를 ?debug=1 의 몬스터 선택 소환 패널(이번에 추가)로 꺼내서 스킬이 눈에 보인다.
```

## Step 5 — 3택 시스템
```
PickSystem(순수 함수)과 PickScene(오버레이)을 만들어. GAME_DESIGN.md §6, config.pick 기준.
- config.pick.intervalSec마다 BattleScene 일시정지 → 카드 3장
- 가중치 무작위 + 보정: 가능하면 1장은 "보드의 몬스터와 합치면 미발견 레시피가 되는 기본 몬스터" 카드, 같은 종류 3장 금지, 조건 불충족 카드(빈칸 부족 등) 제외
- 카드 선택 → 효과 적용 → 전투 재개. 무료 리롤 1회
- PickSystem은 시드 RNG를 주입받게 해서 테스트 가능하게. tests/pick.test.ts 작성
완료 조건: 한 판에 8번 선택지가 뜨고, 테스트 통과.
```

## Step 6 — 도감 + 저장 + 발견 연출
```
SaveService(localStorage, 버전 필드 포함, 파싱 실패 시 초기화), CodexScene, 발견 연출을 만들어. GAME_DESIGN.md §4 발견 연출, §10, §11 기준.
- 처음 만드는 레시피: config.discoveryCutinSec 슬로모션 + "NEW!" 컷인 + 도감 알림
- 키메라 첫 생성: "실패…?" 컷인
- 도감: 발견/미발견(실루엣+속성 테두리)/힌트 공개("불꼬리 + ???") 상태. 발견 수 n/26
- 3택의 recipe_hint 카드가 hints에 저장되게 연결
- MenuScene에 [도감] 버튼, 스테이지 선택(잠금 표시), 최고 기록
완료 조건: 새로고침해도 도감과 해금 상태가 유지된다.
```

## Step 7 — 결과 화면 + 분석 이벤트
```
ResultScene과 Analytics 서비스를 만들어. GAME_DESIGN.md §1, §9 기준.
- 결과: 승/패, 생존 시간, 처치 수, 이번 판 신규 발견(카드로 나열), [다시하기] [도감] [메뉴]
- Analytics: §9 이벤트 전부 호출. localStorage 큐에 저장, console 출력
- ?debug=1이면 화면 우측에 이벤트 로그 패널
- 결과 화면에 [플레이 로그 복사] 버튼(큐 JSON + 요약 통계: 판 수, 발견 수, 평균 생존 시간)
- AdService, StoreService는 인터페이스 + NoopAdService/NoopStoreService 스텁만
완료 조건: 세 판 연속 플레이 후 로그 복사 내용에 모든 이벤트가 들어 있다.
```

## Step 8 — 스테이지 2·3 + 보스
```
stages.json의 스테이지 2, 3과 보스 킹 키메라를 완성해.
- 보스: 30초마다 속성 변경(색·아이콘 변화 + "속성 변화!" 경고), HP 50%에서 졸개 소환, 상단에 보스 HP 바
- 분열슬라임 split, 주술사 heal, 철갑벌레 armor 동작 확인
- 스테이지 클리어 시 다음 스테이지 해금
완료 조건: 스테이지 3 보스까지 클리어 가능하다(합성 몬스터 위주로 구성 시).
```

## Step 9 — 손맛 & 마감
```
재미 검증 전 마지막 다듬기. 아트는 여전히 플레이스홀더 유지.
- 효과음(Web Audio로 간단 합성음 생성): 합성, 발견, 피격, 처치, 버튼, 승리/패배
- 화면 흔들림(보스 등장, 기지 피격), 처치 시 에너지 구슬이 하단으로 날아가는 연출
- 첫 판 튜토리얼: 손가락 아이콘으로 "드래그해서 합쳐보세요" 1회
- 진동(navigator.vibrate, 설정에서 끄기)
- 모바일 크롬/사파리에서 터치 스크롤·확대 방지
- 밸런스 1차: ?debug=1 자동 플레이(무작위 합성 봇)로 각 스테이지 10판 시뮬레이션해 승률 출력하는 스크립트(npm run sim). 목표: 스테이지1 80%+, 2는 50%, 3은 25% 수준(무작위 봇 기준)
완료 조건: npm run build 후 dist를 Vercel(또는 itch.io)에 올릴 수 있는 상태.
```

---

## 검증 단계 (Phase 1.5) 체크리스트
- [ ] 웹 빌드 배포 링크 생성
- [ ] 플레이테스트 20~50명 (지인, 게임 커뮤니티, 숏폼 댓글 유입)
- [ ] 테스터에게 "플레이 로그 복사" 결과 + 질문 2개 수집: ① 가장 기억나는 조합은? ② 다른 조합을 더 해보고 싶었나?
- [ ] 숏폼 테스트 영상 3~5개: "이 둘을 합치면?" 퀴즈형 / 키메라 실패 웃음형 / 보스전 역전형
- [ ] PRD §8 KPI 판정 → Phase 2 진행 or 수정 후 재테스트 or 보류
