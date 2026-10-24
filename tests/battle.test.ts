import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/gameData';
import { Battle, type BattleOptions } from '../src/systems/Battle';
import { createRng } from '../src/systems/rng';
import { cellIndex, laneX } from '../src/systems/layout';

const data = loadGameData();
const cfg = data.config;

function mk(opts: Partial<BattleOptions> = {}): Battle {
  return new Battle(data, { stageId: 1, rng: createRng(7), discovered: [], hints: {}, startingMonsters: 0, noWaves: true, ...opts });
}
function run(b: Battle, sec: number, step = 0.05): void {
  for (let t = 0; t < sec - 1e-9; t += step) {
    b.update(step);
    if (b.state.awaitingPick) chooseNonHeal(b);
  }
}
/** 테스트가 기지 HP를 검사하므로 치유 카드는 피한다 */
function chooseNonHeal(b: Battle): void {
  const i = b.state.currentPick.findIndex((o) => o.kind !== 'heal');
  b.choosePick(Math.max(0, i));
}

describe('Battle 기본', () => {
  it('시작 몬스터 config.startingMonsters마리를 앞줄 우선 배치', () => {
    const b = new Battle(data, { stageId: 1, rng: createRng(3), discovered: [], hints: {} });
    const units = b.state.board.filter(Boolean);
    expect(units).toHaveLength(cfg.startingMonsters);
    const front = b.state.board.slice(0, cfg.board.cols).filter(Boolean);
    expect(front).toHaveLength(Math.min(cfg.startingMonsters, cfg.board.cols));
    for (const m of units) expect(m!.def.tier).toBe(1);
  });

  it('소환 비용은 시작 summonBaseCost, 소환마다 +summonCostStep', () => {
    const b = mk();
    b.state.energy = 100;
    expect(b.summonCost()).toBe(cfg.energy.summonBaseCost);
    expect(b.summon()).not.toBeNull();
    expect(b.state.energy).toBe(100 - cfg.energy.summonBaseCost);
    expect(b.summonCost()).toBe(cfg.energy.summonBaseCost + cfg.energy.summonCostStep);
  });

  it('에너지가 부족하거나 빈칸이 없으면 소환 불가', () => {
    const b = mk();
    b.state.energy = 0;
    expect(b.canSummon()).toBe(false);
    expect(b.summon()).toBeNull();
    b.state.energy = 10_000;
    for (let i = 0; i < 8; i++) expect(b.summon()).not.toBeNull();
    expect(b.canSummon()).toBe(false);
  });

  it('빈칸에 드롭 → 이동, 같은 칸 → 아무 일 없음', () => {
    const b = mk();
    b.placeMonster('ember_pup', 1, 0);
    expect(b.dragDrop(0, 0).kind).toBe('none');
    expect(b.dragDrop(0, 5).kind).toBe('move');
    expect(b.state.board[0]).toBeNull();
    expect(b.state.board[5]?.defId).toBe('ember_pup');
  });

  it('레시피 합성: 결과는 대상 칸, 원래 칸 비움, 신규 발견 기록', () => {
    const b = mk();
    b.placeMonster('ember_pup', 1, 0);
    b.placeMonster('drip_slime', 1, 1);
    const out = b.dragDrop(0, 1);
    expect(out).toMatchObject({ kind: 'merge', result: { kind: 'recipe', resultId: 'steam_spirit' }, isNewDiscovery: true });
    expect(b.state.board[0]).toBeNull();
    expect(b.state.board[1]?.defId).toBe('steam_spirit');
    expect(b.state.discovered.has('steam_spirit')).toBe(true);
    expect(b.state.newDiscoveries).toEqual(['steam_spirit']);
    expect(b.state.mergesTotal).toBe(1);

    b.placeMonster('ember_pup', 1, 2);
    b.placeMonster('drip_slime', 1, 3);
    expect(b.dragDrop(2, 3)).toMatchObject({ kind: 'merge', isNewDiscovery: false });
  });

  it('invalid 합성은 보드를 바꾸지 않는다', () => {
    const b = mk();
    b.placeMonster('steam_spirit', 1, 0);
    b.placeMonster('ember_pup', 1, 1);
    expect(b.dragDrop(0, 1)).toMatchObject({ kind: 'merge', result: { kind: 'invalid' } });
    expect(b.state.board[0]?.defId).toBe('steam_spirit');
    expect(b.state.board[1]?.defId).toBe('ember_pup');
  });

  it('합성 결과는 HP 100%, 기절 해제 (기절 몬스터도 재료 가능)', () => {
    const b = mk();
    const a = b.placeMonster('ember_pup', 1, 0);
    b.placeMonster('ember_pup', 1, 1);
    a.koTimer = 5;
    a.hp = 0;
    b.dragDrop(0, 1);
    const r = b.state.board[1]!;
    expect(r.star).toBe(2);
    expect(r.koTimer).toBe(0);
    expect(r.hp).toBe(r.maxHp);
    expect(r.maxHp).toBeCloseTo(data.monsterById.get('ember_pup')!.hp * cfg.starMultiplier);
  });

  it('키메라 첫 생성은 isFirstChimera, 도감에 기록', () => {
    const b = mk();
    b.placeMonster('ember_pup', 1, 0);
    b.placeMonster('pebble_turtle', 1, 1);
    expect(b.dragDrop(0, 1)).toMatchObject({ kind: 'merge', result: { kind: 'chimera' }, isFirstChimera: true });
    expect(b.state.discovered.has('chimera')).toBe(true);
  });

  it('기본 몬스터는 보드에 나오면 도감(discovered)에 등록된다', () => {
    const b = mk();
    b.placeMonster('zap_mouse', 1, 0);
    expect(b.state.discovered.has('zap_mouse')).toBe(true);
    expect(b.state.newDiscoveries).toEqual([]);
  });
});

describe('Battle 전투', () => {
  it('앞줄이 빈 레인의 적은 통과해 기지 데미지', () => {
    const b = mk();
    const e = b.spawnEnemy('goo', 0);
    run(b, 20);
    expect(b.state.enemies).toHaveLength(0);
    expect(b.state.baseHp).toBe(b.state.baseHpMax - e.def.baseDamage);
  });

  it('앞줄 몬스터가 적을 막고 처치하면 에너지 획득', () => {
    const b = mk();
    b.placeMonster('gravel_golem', 3, cellIndex(0, 0, cfg));
    b.spawnEnemy('goo', 0);
    const e0 = b.state.energy;
    run(b, 25);
    expect(b.state.baseHp).toBe(b.state.baseHpMax);
    expect(b.state.kills).toBe(1);
    expect(b.state.energy).toBe(e0 + data.enemyById.get('goo')!.energy);
  });

  it('근접 몬스터는 뒷줄에서 공격하지 않는다', () => {
    const b = mk();
    b.placeMonster('gravel_golem', 3, cellIndex(0, 1, cfg));
    b.spawnEnemy('goo', 0);
    run(b, 20);
    expect(b.state.kills).toBe(0);
    expect(b.state.baseHp).toBeLessThan(b.state.baseHpMax);
  });

  it('원거리 몬스터는 뒷줄에서도 레인 전체를 공격', () => {
    const b = mk();
    b.placeMonster('zap_mouse', 3, cellIndex(2, 1, cfg));
    b.spawnEnemy('goo', 2);
    run(b, 20);
    expect(b.state.kills).toBe(1);
  });

  it('몬스터는 자기 레인의 적만 공격', () => {
    const b = mk();
    b.placeMonster('zap_mouse', 3, cellIndex(2, 1, cfg));
    b.spawnEnemy('goo', 1);
    run(b, 20);
    expect(b.state.kills).toBe(0);
  });

  it('비행 적은 앞줄을 무시하고 기지로 직행, 근접은 못 때림', () => {
    const b = mk();
    b.placeMonster('gravel_golem', 3, cellIndex(0, 0, cfg));
    const crow = b.spawnEnemy('crow', 0);
    run(b, 20);
    expect(b.state.kills).toBe(0);
    expect(b.state.baseHp).toBe(b.state.baseHpMax - crow.def.baseDamage);
  });

  it('비행 적은 원거리로 맞출 수 있다', () => {
    const b = mk();
    b.placeMonster('zap_mouse', 3, cellIndex(0, 1, cfg));
    b.spawnEnemy('crow', 0);
    run(b, 20);
    expect(b.state.kills).toBe(1);
  });

  it('HP 0 → 기절 knockoutSec 후 knockoutReturnHpPct로 복귀, 기절 중엔 막지 못함', () => {
    const b = mk();
    const m = b.placeMonster('cinder_bat', 1, cellIndex(0, 0, cfg));
    b.damageMonster(m, m.hp + 1, null);
    expect(m.koTimer).toBeCloseTo(cfg.knockoutSec);
    b.spawnEnemy('imp', 0); // 기절(10초)보다 빨리 도착하는 적
    run(b, 8);
    expect(b.state.baseHp).toBeLessThan(b.state.baseHpMax);
    run(b, cfg.knockoutSec);
    expect(m.koTimer).toBe(0);
    expect(m.hp).toBeGreaterThan(0);
  });

  it('상성: 유리하면 1.5배, 불리하면 0.75배 데미지', () => {
    const b = mk();
    const fire = b.placeMonster('ember_pup', 1, 0);
    const grass = b.spawnEnemy('shaman', 0);
    const water = b.spawnEnemy('splitter', 0);
    expect(b.computeHit(fire, grass).amount).toBeCloseTo(fire.atk * 1.5);
    expect(b.computeHit(fire, water).amount).toBeCloseTo(fire.atk * 0.75);
  });

  it('철갑벌레 armor는 데미지를 줄인다', () => {
    const b = mk();
    const golem = b.placeMonster('gravel_golem', 1, 0);
    const beetle = b.spawnEnemy('beetle', 0);
    const hp0 = beetle.hp;
    b.dealDamage(beetle, 100, { element: 'none' });
    expect(hp0 - beetle.hp).toBeCloseTo(100 * (1 - (beetle.def.armor ?? 0)));
    expect(golem).toBeTruthy();
  });

  it('분열슬라임은 죽으면 splitCount마리로 분열', () => {
    const b = mk();
    const s = b.spawnEnemy('splitter', 1);
    b.dealDamage(s, 10_000, { element: 'none' });
    b.update(0.01);
    const goos = b.state.enemies.filter((e) => e.def.id === 'goo');
    expect(goos).toHaveLength(s.def.splitCount!);
  });

  it('주술사는 주변 적을 회복', () => {
    const b = mk();
    b.spawnEnemy('shaman', 1);
    const g = b.spawnEnemy('goo', 1);
    g.hp = 10;
    run(b, data.enemyById.get('shaman')!.healIntervalSec! + 0.1);
    expect(g.hp).toBeGreaterThan(10);
  });

  it('기지 HP 0 → 패배', () => {
    const b = mk();
    b.state.baseHp = 1;
    b.spawnEnemy('goo', 0);
    run(b, 20);
    expect(b.state.result).toBe('lose');
  });

  it('durationSec 생존 → 승리 (보스 불필요 스테이지)', () => {
    const b = mk();
    run(b, data.stages[0].durationSec + 0.2);
    expect(b.state.result).toBe('win');
  });

  it('bossRequired 스테이지는 보스를 잡기 전엔 시간이 지나도 끝나지 않는다', () => {
    const b = mk({ stageId: 3 });
    b.spawnEnemy('king_chimera', 1);
    b.state.time = data.stages[2].durationSec - 0.1;
    b.state.nextPickAt = data.stages[2].durationSec;
    b.state.baseHp = 10_000;
    b.update(0.5);
    expect(b.state.result).toBeNull();
    const boss = b.state.enemies.find((e) => e.def.id === 'king_chimera')!;
    b.dealDamage(boss, 1e9, { element: 'none' });
    b.update(0.05);
    expect(b.state.bossDefeated).toBe(true);
    expect(b.state.result).toBe('win');
  });

  it('3택은 intervalSec마다, 한 판에 8번', () => {
    const b = mk();
    let picks = 0;
    for (let t = 0; t < 181; t += 0.05) {
      b.update(0.05);
      if (b.state.awaitingPick) {
        picks++;
        expect(b.state.currentPick.length).toBe(cfg.pick.optionCount);
        b.choosePick(0);
      }
    }
    expect(picks).toBe(8);
  });

  it('3택 대기 중에는 시간이 흐르지 않는다', () => {
    const b = mk();
    run(b, cfg.pick.intervalSec - 0.05);
    b.update(0.1);
    expect(b.state.awaitingPick).toBe(true);
    const t = b.state.time;
    b.update(1);
    expect(b.state.time).toBe(t);
  });

  it('웨이브 타임라인대로 적이 생성된다', () => {
    const b = mk({ noWaves: false });
    b.update(0.01);
    expect(b.state.enemies.length).toBe(1);
    expect(b.state.enemies[0].x).toBe(laneX(b.state.enemies[0].lane, cfg));
  });
});

describe('Battle 보스', () => {
  it('cycleSec마다 속성 변경, HP 50%에서 졸개 소환', () => {
    const b = mk({ stageId: 3 });
    const boss = b.spawnEnemy('king_chimera', 1);
    const bd = boss.def.boss!;
    expect(boss.element).toBe(bd.elementCycle[0]);
    run(b, bd.cycleSec + 0.1);
    expect(boss.element).toBe(bd.elementCycle[1]);
    b.dealDamage(boss, boss.maxHp * (1 - bd.summonAtHpPct) + 1, { element: 'none' });
    b.update(0.05);
    expect(b.state.enemies.filter((e) => e.def.id === bd.summonId)).toHaveLength(bd.summonCount);
    b.update(0.05);
    expect(b.state.enemies.filter((e) => e.def.id === bd.summonId)).toHaveLength(bd.summonCount);
  });
});

describe('통합: 스테이지 클리어 가능성 (Step 8 완료 조건)', () => {
  it('합성 몬스터 위주 구성이면 스테이지 3 보스까지 클리어', () => {
    let wins = 0;
    const seeds = [1, 2, 3, 4, 5];
    for (const seed of seeds) {
      const b = new Battle(data, { stageId: 3, rng: createRng(seed), discovered: [], hints: {}, startingMonsters: 0 });
      const team = ['mud_giant', 'thunder_fox', 'magnet_golem', 'blaze_vine', 'plasma_bat', 'lotus_fairy', 'jelly_zapper', 'sea_urchin'];
      team.forEach((id, i) => b.placeMonster(id, 2, i));
      run(b, 400);
      if (b.state.result === 'win') wins++;
      expect(b.state.result).not.toBeNull();
    }
    expect(wins).toBe(seeds.length);
  });

});
