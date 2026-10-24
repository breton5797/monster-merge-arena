import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/gameData';
import { Battle } from '../src/systems/Battle';
import { createRng } from '../src/systems/rng';
import { cellIndex, enemyStopY } from '../src/systems/layout';
import { resolve } from '../src/systems/MergeSystem';
import { starRating } from '../src/systems/Progress';

const data = loadGameData();
const cfg = data.config;
const F = (col: number) => cellIndex(col, 0, cfg);
const B = (col: number) => cellIndex(col, 1, cfg);
const sp = (id: string, key: string) => Number(data.monsterById.get(id)!.skill![key]);

function mk(stageId = 1, seed = 7): Battle {
  return new Battle(data, { stageId, rng: createRng(seed), discovered: [], hints: {}, startingMonsters: 0, noWaves: true });
}
function tick(b: Battle, sec: number): void {
  for (let t = 0; t < sec - 1e-9; t += 0.05) {
    b.update(0.05);
    if (b.state.awaitingPick) b.choosePick(b.state.currentPick.findIndex((o) => o.kind !== 'heal'));
  }
}

describe('콘텐츠 규모 (PRD Phase 2)', () => {
  it('기본 14 / 합성 30 / 키메라 1', () => {
    expect(data.monsters.filter((m) => m.tier === 1)).toHaveLength(14);
    expect(data.monsters.filter((m) => m.tier === 2)).toHaveLength(30);
    expect(data.monsters.filter((m) => m.tier === 0)).toHaveLength(1);
  });

  it('레시피 30개, 재료 조합 중복 없음, 모든 합성 몬스터가 정확히 하나의 레시피 결과', () => {
    expect(data.fusions.recipes).toHaveLength(30);
    expect(new Set(data.fusions.recipes.map((r) => [r.a, r.b].sort().join('+'))).size).toBe(30);
    const results = data.fusions.recipes.map((r) => r.result).sort();
    expect(results).toEqual(data.monsters.filter((m) => m.tier === 2).map((m) => m.id).sort());
  });

  it('91개 기본 조합 중 레시피 30 / 키메라 61 (발견 확률 약 33%)', () => {
    const base = data.monsters.filter((m) => m.tier === 1);
    let recipe = 0;
    let chimera = 0;
    for (let i = 0; i < base.length; i++)
      for (let j = i + 1; j < base.length; j++) {
        const k = resolve({ defId: base[i].id, star: 1 }, { defId: base[j].id, star: 1 }, data).kind;
        if (k === 'recipe') recipe++;
        if (k === 'chimera') chimera++;
      }
    expect([recipe, chimera]).toEqual([30, 61]);
  });

  it('신규 기본 몬스터는 각각 레시피 3개 이상에 쓰인다 (발견 가능성)', () => {
    for (const id of ['flare_lizard', 'tide_crab', 'moss_snail', 'storm_owl']) {
      expect(data.fusions.recipes.filter((r) => r.a === id || r.b === id).length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('밸런스 원칙: 레시피 몬스터 ★1 체력·공격 합이 재료 기본 몬스터 ★2 평균보다 높다', () => {
    for (const r of data.fusions.recipes) {
      const res = data.monsterById.get(r.result)!;
      const a = data.monsterById.get(r.a)!;
      const b = data.monsterById.get(r.b)!;
      const power = (m: { hp: number; atk: number; atkSpeed: number }, k = 1) => m.hp * k / 10 + m.atk * m.atkSpeed * k;
      expect(power(res), r.result).toBeGreaterThan(((power(a, cfg.starMultiplier) + power(b, cfg.starMultiplier)) / 2) * 0.9);
    }
  });

  it('스테이지 6개, 4~6은 월드 2, 6스테이지는 신규 보스 필수', () => {
    expect(data.stages).toHaveLength(6);
    const s6 = data.stages[5];
    expect(s6.bossRequired).toBe(true);
    expect(s6.waves.some((w) => w.enemyId === 'storm_dragon')).toBe(true);
  });
});

describe('신규 스킬', () => {
  it('meteor: 주기적으로 전장 적에게 범위 피해', () => {
    const b = mk();
    b.placeMonster('magma_golem', 1, B(0));
    const e = b.spawnEnemy('beetle', 2, { y: 300, hpScale: 10 });
    tick(b, sp('magma_golem', 'intervalSec') + 0.1);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('pierce: 레인의 적 여러 마리를 한 번에 관통', () => {
    const b = mk();
    b.placeMonster('thunderbird', 1, B(0));
    const es = [300, 400, 500].map((y) => b.spawnEnemy('beetle', 0, { y, hpScale: 10 }));
    tick(b, 0.05);
    expect(es.filter((e) => e.hp < e.maxHp)).toHaveLength(sp('thunderbird', 'count'));
  });

  it('regen: 스스로 체력 회복', () => {
    const b = mk();
    const m = b.placeMonster('moss_snail', 1, B(0));
    m.hp = 10;
    tick(b, 2);
    expect(m.hp).toBeCloseTo(10 + m.maxHp * sp('moss_snail', 'hpPctPerSec') * 2, 0);
  });

  it('knockback: 확률로 적을 뒤로 밀어낸다 (보스는 덜 밀림)', () => {
    const b = mk(1, 3);
    b.placeMonster('shock_crab', 3, F(0));
    const e = b.spawnEnemy('beetle', 0, { y: enemyStopY(cfg), hpScale: 100 });
    let pushed = false;
    for (let i = 0; i < 200 && !pushed; i++) {
      b.update(0.05);
      pushed = e.y < enemyStopY(cfg) - 20;
    }
    expect(pushed).toBe(true);
  });

  it('lifesteal: 준 피해 일부만큼 회복', () => {
    const b = mk();
    const m = b.placeMonster('swamp_beast', 1, F(0));
    m.hp = 10;
    b.spawnEnemy('beetle', 0, { y: enemyStopY(cfg), hpScale: 100 });
    tick(b, 2);
    expect(m.hp).toBeGreaterThan(10);
  });

  it('energy_gain: 주기적으로 에너지 생산', () => {
    const b = mk();
    b.placeMonster('glow_snail', 1, B(0));
    const e0 = b.state.energy;
    tick(b, sp('glow_snail', 'intervalSec') + 0.1);
    expect(b.state.energy).toBe(e0 + sp('glow_snail', 'amount'));
  });

  it('buff_adjacent: 옆 칸 아군 공격력 증가 (기절 중엔 없음)', () => {
    const b = mk();
    const m = b.placeMonster('ember_pup', 1, F(1));
    const e = b.spawnEnemy('beetle', 1);
    const base = b.computeHit(m, e).amount;
    const t = b.placeMonster('elder_treant', 1, F(0));
    expect(b.computeHit(m, e).amount).toBeCloseTo(base * (1 + sp('elder_treant', 'atkPct')));
    t.koTimer = 5;
    expect(b.computeHit(m, e).amount).toBeCloseTo(base);
  });

  it('execute: 체력이 낮은 적에게 추가 피해', () => {
    const b = mk();
    b.placeMonster('moon_owl', 1, B(0));
    const e = b.spawnEnemy('beetle', 0, { y: 400, hpScale: 100 });
    e.hp = e.maxHp * (sp('moon_owl', 'thresholdPct') - 0.05);
    const before = e.hp;
    b.update(0.05);
    const ev = b.drainEvents().find((x) => x.type === 'damage');
    expect(ev && ev.type === 'damage' && ev.effect).toBe('crit');
    expect(e.hp).toBeLessThan(before);
  });

  it('rage: 연속 공격할수록 공격 속도 증가, 대상이 없으면 초기화', () => {
    const b = mk();
    const m = b.placeMonster('inferno_wolf', 1, F(0));
    b.spawnEnemy('beetle', 0, { y: enemyStopY(cfg), hpScale: 100 });
    tick(b, 4);
    expect(m.stacks).toBe(sp('inferno_wolf', 'maxStacks'));
    b.state.enemies.forEach((e) => (e.dead = true));
    tick(b, 0.2);
    expect(m.stacks).toBe(0);
  });

  it('anti_air: 비행 적에게 배율 피해', () => {
    const b = mk();
    const m = b.placeMonster('storm_owl', 1, B(0));
    const crow = b.spawnEnemy('crow', 0, { y: 300 });
    const hp0 = crow.hp;
    b.update(0.05);
    const dealt = hp0 - crow.hp;
    const plain = b.computeHit(m, crow).amount;
    expect(dealt).toBeCloseTo(plain * sp('storm_owl', 'mult'));
  });
});

describe('신규 적·보스', () => {
  it('유령(ethereal): 근접 피해를 덜 받는다', () => {
    const b = mk();
    const melee = b.placeMonster('gravel_golem', 1, F(0));
    const ghost = b.spawnEnemy('ghost', 0, { y: enemyStopY(cfg) });
    const hp0 = ghost.hp;
    b.update(0.05);
    const ratio = data.enemyById.get('ghost')!.meleeTakenPct!;
    expect(hp0 - ghost.hp).toBeCloseTo(b.computeHit(melee, ghost).amount * ratio);
  });

  it('폭탄벌레(bomber): 막히면 자폭해 막은 몬스터에게 큰 피해, 기지 피해 없음', () => {
    const b = mk();
    const m = b.placeMonster('pebble_turtle', 3, F(0));
    const bomb = b.spawnEnemy('bomber', 0, { y: enemyStopY(cfg) - 5 });
    tick(b, 0.5);
    expect(bomb.dead).toBe(true);
    expect(m.hp).toBeLessThanOrEqual(m.maxHp - bomb.def.explodeDamage!);
    expect(b.state.baseHp).toBe(b.state.baseHpMax);
    expect(b.state.kills).toBe(0);
  });

  it('폭풍드래곤: laneHopSec마다 레인 이동, 50%에서 졸개 소환', () => {
    const b = mk(6);
    const boss = b.spawnEnemy('storm_dragon', 1);
    const bd = boss.def.boss!;
    const lanes = new Set<number>([boss.lane]);
    for (let t = 0; t < bd.laneHopSec! * 3 + 0.5; t += 0.05) {
      tick(b, 0.05);
      lanes.add(boss.lane);
    }
    expect(lanes.size).toBeGreaterThan(1);
    b.dealDamage(boss, boss.maxHp * 0.55, { element: 'none' });
    b.update(0.05);
    expect(b.state.enemies.filter((e) => e.def.id === bd.summonId).length).toBeGreaterThanOrEqual(bd.summonCount);
  });
});

describe('진행: ★ 평가', () => {
  it('승리 시 기지 HP 비율로 ★1~3, 패배는 0', () => {
    expect(starRating('lose', 100, 100)).toBe(0);
    expect(starRating('win', 100, 100)).toBe(3);
    expect(starRating('win', 80, 100)).toBe(3);
    expect(starRating('win', 79, 100)).toBe(2);
    expect(starRating('win', 50, 100)).toBe(2);
    expect(starRating('win', 49, 100)).toBe(1);
  });
});

describe('부활 (보상형 광고)', () => {
  it('패배 후 1회 부활: 기지 HP 회복, 일반 적 제거, 보스 유지, 두 번은 불가', () => {
    const b = mk(3);
    b.spawnEnemy('goo', 0, { y: 700 });
    const boss = b.spawnEnemy('king_chimera', 1);
    b.state.baseHp = 1;
    b.spawnEnemy('imp', 2, { y: enemyStopY(cfg) - 1 });
    tick(b, 1);
    expect(b.state.result).toBe('lose');
    expect(b.canRevive()).toBe(true);
    expect(b.revive()).toBe(true);
    expect(b.state.result).toBeNull();
    expect(b.state.baseHp).toBe(b.state.baseHpMax * cfg.revive.baseHpPct);
    expect(b.state.enemies).toEqual([boss]);
    expect(b.canRevive()).toBe(false);
    expect(b.revive()).toBe(false);
  });

  it('승리했거나 진행 중이면 부활 불가', () => {
    const b = mk();
    expect(b.canRevive()).toBe(false);
  });
});

describe('리뷰 회귀 테스트', () => {
  it('보스 레인 이동은 즉시 패배가 아니다: 이동 중엔 기지에 닿지 않고 뒤로 밀려난다', () => {
    const b = mk(6);
    b.state.baseHp = 10_000;
    b.placeMonster('mountain_titan', 3, F(1));
    const boss = b.spawnEnemy('storm_dragon', 1, { y: enemyStopY(cfg) - 1 });
    tick(b, 1);
    expect(boss.blocked).toBe(true);
    const hops: number[] = [];
    for (let t = 0; t < boss.def.boss!.laneHopSec! + 0.2; t += 0.05) {
      b.update(0.05);
      for (const ev of b.drainEvents()) if (ev.type === 'bossHop') hops.push(b.state.time);
      if (b.state.awaitingPick) b.choosePick(0);
    }
    expect(hops.length).toBe(1);
    expect(boss.dead).toBe(false);
    expect(boss.y).toBeLessThan(enemyStopY(cfg) - cfg.combat.bossHopPushbackPx + 5);
    expect(b.state.baseHp).toBe(10_000);
  });

  it('보스가 기지에 닿아 진 판은 부활할 수 없다 (보스 필수 스테이지 무한 연장 방지)', () => {
    const b = mk(3);
    b.spawnEnemy('king_chimera', 1, { y: enemyStopY(cfg) - 1 });
    tick(b, 1);
    expect(b.state.result).toBe('lose');
    expect(b.canRevive()).toBe(false);
  });

  it('오늘의 도전 스테이지는 하루 동안 진행도가 바뀌어도 같다 (기록에 고정)', async () => {
    const { dailyStage } = await import('../src/systems/Progress');
    expect(dailyStage(20261024, 1, null)).toBe(1);
    const record = { seed: 20261024, stageId: 1, plays: 1, bestStars: 0, bestTime: 10 };
    expect(dailyStage(20261024, 6, record)).toBe(1);
    expect(dailyStage(20261025, 6, record)).toBe(dailyStage(20261025, 6, null));
  });

  it('★ 기준은 config에서 읽는다', () => {
    expect(starRating('win', cfg.stars.threeStarPct * 100, 100)).toBe(3);
    expect(starRating('win', cfg.stars.twoStarPct * 100 - 1, 100)).toBe(1);
  });
});
