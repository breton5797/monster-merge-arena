import { expect, test, type Page } from '@playwright/test';

// 게임 좌표(720×1280)를 화면 좌표로 바꿔 터치/드래그한다
async function canvasScale(page: Page): Promise<{ x: number; y: number; s: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas 없음');
  return { x: box.x, y: box.y, s: box.width / 720 };
}
async function tap(page: Page, gx: number, gy: number): Promise<void> {
  const c = await canvasScale(page);
  await page.mouse.click(c.x + gx * c.s, c.y + gy * c.s);
}
async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const c = await canvasScale(page);
  await page.mouse.move(c.x + from[0] * c.s, c.y + from[1] * c.s);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(c.x + (from[0] + ((to[0] - from[0]) * i) / 10) * c.s, c.y + (from[1] + ((to[1] - from[1]) * i) / 10) * c.s);
  }
  await page.mouse.up();
}
// 페이지 안에서 평가할 식 (window.__game은 src/main.ts가 노출)
const GAME = 'window.__game';
const BATTLE = `${GAME}.scene.getScene('BattleScene').battle`;
const SAVE = `${GAME}.registry.get('services').save.data`;
const evalIn = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
const activeScenes = (page: Page) => evalIn<string[]>(page, `${GAME}.scene.getScenes(true).map((s) => s.scene.key)`);
let errors: string[] = [];
// 메뉴 좌표 (게임 좌표 720×1280)
const STAGE1: [number, number] = [190, 540];
const CODEX_BTN: [number, number] = [525, 1090];
const DAILY_BTN: [number, number] = [195, 1090];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => activeScenes(page)).toEqual(['MenuScene']);
});

test.afterEach(async () => {
  expect(errors).toEqual([]);
});

test('메뉴 → 스테이지 1 시작 → 드래그로 레시피 합성 → 발견이 새로고침 후에도 유지', async ({ page }) => {
  await tap(page, STAGE1[0], STAGE1[1]);
  await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
  // 결정적인 재료 배치: 앞줄 0번 불꼬리, 1번 물방울슬라임
  await page.evaluate(`(() => { const b = ${BATTLE}; b.state.board.fill(null); b.placeMonster('ember_pup', 1, 0); b.placeMonster('drip_slime', 1, 1); })()`);
  await drag(page, [135, 885], [285, 885]);
  await expect.poll(() => page.evaluate(`${BATTLE}.state.board[1]?.defId`)).toBe('steam_spirit');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mma_save') ?? '{}').discovered as string[]);
  expect(saved).toContain('steam_spirit');

  await page.reload();
  await expect.poll(() => activeScenes(page)).toEqual(['MenuScene']);
  await tap(page, CODEX_BTN[0], CODEX_BTN[1]); // 도감
  await expect.poll(() => activeScenes(page)).toEqual(['CodexScene']);
  const after = await evalIn<string[]>(page, `${SAVE}.discovered`);
  expect(after).toContain('steam_spirit');
});

test('20초마다 3택: 전투 일시정지 → 카드 선택 → 재개', async ({ page }) => {
  await tap(page, STAGE1[0], STAGE1[1]);
  await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
  await page.evaluate(`${BATTLE}.state.time = 19.9`);
  await expect.poll(() => activeScenes(page)).toEqual(['PickScene']);
  expect(await evalIn<boolean>(page, `${GAME}.scene.isPaused('BattleScene')`)).toBe(true);
  await page.waitForTimeout(400);
  await tap(page, 360, 640);
  await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
  expect(await page.evaluate(`${BATTLE}.state.awaitingPick`)).toBe(false);
});

test('스테이지 1 클리어 → 결과 화면 → 스테이지 2 해금이 새로고침 후에도 유지', async ({ page }) => {
  await tap(page, STAGE1[0], STAGE1[1]);
  await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
  await page.evaluate(`(() => { const b = ${BATTLE}; b.state.time = 179.9; b.state.nextPickAt = 999; })()`);
  await expect.poll(() => activeScenes(page), { timeout: 10_000 }).toEqual(['ResultScene']);
  await page.reload();
  await expect.poll(() => activeScenes(page)).toEqual(['MenuScene']);
  expect(await evalIn<number>(page, `${SAVE}.unlockedStages`)).toBe(2);
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem('mma_analytics') ?? '[]').map((e: { name: string }) => e.name));
  expect(events).toEqual(expect.arrayContaining(['session_start', 'run_start', 'run_end']));
  expect(await evalIn<number>(page, `${SAVE}.stars[1]`)).toBeGreaterThanOrEqual(1);
});

test('오늘의 도전: 같은 날 두 번 시작하면 같은 시드 (첫 적 레인·원소 동일)', async ({ page }) => {
  const firstSpawn = async () => {
    await tap(page, DAILY_BTN[0], DAILY_BTN[1]);
    await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
    await expect.poll(() => evalIn<number>(page, `${BATTLE}.state.enemies.length`)).toBeGreaterThan(0);
    const spawn = await evalIn<string>(page, `(() => { const e = ${BATTLE}.state.enemies[0]; return e.def.id + ':' + e.lane + ':' + e.element; })()`);
    const starters = await evalIn<string>(page, `${BATTLE}.state.board.map((m) => m?.defId ?? '-').join(',')`);
    await page.evaluate(`window.__game.scene.getScene('BattleScene').scene.start('MenuScene')`);
    await expect.poll(() => activeScenes(page)).toEqual(['MenuScene']);
    return spawn + '|' + starters;
  };
  expect(await firstSpawn()).toBe(await firstSpawn());
});

test('도감 탭: 기본 14 / 합성 30 / 특수 1, 미발견은 실루엣', async ({ page }) => {
  await tap(page, CODEX_BTN[0], CODEX_BTN[1]);
  await expect.poll(() => activeScenes(page)).toEqual(['CodexScene']);
  const count = () => evalIn<number>(page, `window.__game.scene.getScene('CodexScene').grid.list.length`);
  expect(await count()).toBe(14);
  await tap(page, 360, 252);
  await expect.poll(count).toBe(30);
  await tap(page, 576, 252);
  await expect.poll(count).toBe(1);
});

test('잘못된 합성(tier2 + 기본)은 튕겨나가고 보드가 그대로', async ({ page }) => {
  await tap(page, STAGE1[0], STAGE1[1]);
  await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
  await page.evaluate(`(() => { const b = ${BATTLE}; b.state.board.fill(null); b.placeMonster('steam_spirit', 1, 0); b.placeMonster('ember_pup', 1, 1); })()`);
  await drag(page, [135, 885], [285, 885]);
  await page.waitForTimeout(300);
  expect(await page.evaluate(`${BATTLE}.state.board.slice(0, 2).map((m) => m?.defId)`)).toEqual(['steam_spirit', 'ember_pup']);
});

test('드래그 중 3택이 뜨면 손가락을 떼도 카드가 선택되지 않는다', async ({ page }) => {
  await tap(page, STAGE1[0], STAGE1[1]);
  await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
  const c = await canvasScale(page);
  // 앞줄 몬스터를 잡고 가운데 카드 위치(360, 640)까지 끌어올린 상태에서 3택 발생
  await page.mouse.move(c.x + 135 * c.s, c.y + 885 * c.s);
  await page.mouse.down();
  await page.mouse.move(c.x + 360 * c.s, c.y + 640 * c.s, { steps: 8 });
  await page.evaluate(`${BATTLE}.state.time = 19.95`);
  await expect.poll(() => activeScenes(page)).toEqual(['PickScene']);
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect(await activeScenes(page)).toEqual(['PickScene']);
  expect(await evalIn<boolean>(page, `${BATTLE}.state.awaitingPick`)).toBe(true);
  await tap(page, 360, 640); // 제대로 누르면 선택된다
  await expect.poll(() => activeScenes(page)).toEqual(['BattleScene']);
});
