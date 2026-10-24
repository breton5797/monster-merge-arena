import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/gameData';
import { Battle } from '../src/systems/Battle';
import { createRng } from '../src/systems/rng';
import { SKILLS } from '../src/systems/skills';
import { cellIndex, enemyStopY } from '../src/systems/layout';
import { SKILL_PARAMS } from '../src/types';

const data = loadGameData();
const cfg = data.config;
const F = (col: number) => cellIndex(col, 0, cfg);
const B = (col: number) => cellIndex(col, 1, cfg);

function mk(seed = 7): Battle {
  return new Battle(data, { stageId: 1, rng: createRng(seed), discovered: [], hints: {}, startingMonsters: 0, noWaves: true });
}
function tick(b: Battle, sec: number): void {
  for (let t = 0; t < sec - 1e-9; t += 0.05) b.update(0.05);
}
const skillParam = (monsterId: string, key: string) => Number(data.monsterById.get(monsterId)!.skill![key]);

describe('스킬 레지스트리', () => {
  it('SKILL_PARAMS의 모든 스킬에 핸들러가 있다', () => {
    expect(Object.keys(SKILLS).sort()).toEqual(Object.keys(SKILL_PARAMS).sort());
  });
  it('monsters.json의 모든 skill.id가 등록되어 있다', () => {
    for (const m of data.monsters) if (m.skill) expect(SKILLS[m.skill.id], m.id).toBeDefined();
  });
});

describe('스킬 동작', () => {
  it('slow_shot: 맞은 적이 둔화된다', () => {
    const b = mk();
    b.placeMonster('bubble_fish', 1, B(0));
    const e = b.spawnEnemy('beetle', 0);
    tick(b, 0.1);
    expect(e.slow.pct).toBe(skillParam('bubble_fish', 'slowPct'));
  });

  it('heal_adjacent: 옆 칸 몬스터를 회복', () => {
    const b = mk();
    b.placeMonster('sprout_bunny', 1, F(0));
    const t = b.placeMonster('pebble_turtle', 1, F(1));
    t.hp = 10;
    tick(b, skillParam('sprout_bunny', 'intervalSec') + 0.1);
    expect(t.hp).toBeCloseTo(10 + skillParam('sprout_bunny', 'amount'));
  });

  it('reflect: 맞으면 공격자에게 반사', () => {
    const b = mk();
    const m = b.placeMonster('spike_shell', 1, F(0));
    const e = b.spawnEnemy('beetle', 0);
    const hp0 = e.hp;
    b.damageMonster(m, 100, e);
    expect(hp0 - e.hp).toBeCloseTo(100 * skillParam('spike_shell', 'pct') * (1 - e.def.armor!));
  });

  it('multi_target: 2마리를 동시에 공격', () => {
    const b = mk();
    b.placeMonster('volt_bee', 1, B(0));
    const e1 = b.spawnEnemy('beetle', 0, { y: 400 });
    const e2 = b.spawnEnemy('beetle', 0, { y: 300 });
    tick(b, 0.05);
    expect(e1.hp).toBeLessThan(e1.maxHp);
    expect(e2.hp).toBeLessThan(e2.maxHp);
  });

  it('lane_slow: 같은 레인 적 전체 둔화, 다른 레인은 그대로', () => {
    const b = mk();
    b.placeMonster('steam_spirit', 1, B(1));
    const near = b.spawnEnemy('beetle', 1, { y: 200 });
    const other = b.spawnEnemy('beetle', 2, { y: 200 });
    tick(b, 1);
    const moved = near.y - 200;
    const movedOther = other.y - 200;
    expect(moved).toBeCloseTo(movedOther * (1 - skillParam('steam_spirit', 'slowPct')), 0);
  });

  it('revive_once: 첫 기절은 즉시 부활, 두 번째는 기절', () => {
    const b = mk();
    const m = b.placeMonster('phoenix_chick', 1, F(0));
    b.damageMonster(m, m.maxHp * 2, null);
    expect(m.koTimer).toBe(0);
    expect(m.hp).toBeCloseTo(m.maxHp * skillParam('phoenix_chick', 'hpPct'));
    b.damageMonster(m, m.maxHp * 2, null);
    expect(m.koTimer).toBeGreaterThan(0);
  });

  it('chain_lanes: 옆 레인 적에게 튄다', () => {
    const b = mk();
    b.placeMonster('plasma_bat', 1, B(1));
    b.spawnEnemy('beetle', 1, { y: 400 });
    const left = b.spawnEnemy('beetle', 0, { y: 400 });
    const right = b.spawnEnemy('beetle', 2, { y: 400 });
    tick(b, 0.05);
    expect(left.hp < left.maxHp || right.hp < right.maxHp).toBe(true);
  });

  it('taunt_adjacent_lanes: 옆 레인(앞줄 빈) 적을 끌어와 막는다', () => {
    const b = mk();
    b.placeMonster('mud_giant', 3, F(1));
    const e = b.spawnEnemy('goo', 0, { y: enemyStopY(cfg) - 5 });
    tick(b, 1);
    expect(e.lane).toBe(1);
    expect(b.state.baseHp).toBe(b.state.baseHpMax);
  });

  it('stun_chance: 확률로 기절', () => {
    const b = mk(1);
    b.placeMonster('jelly_zapper', 3, B(0));
    const e = b.spawnEnemy('beetle', 0, { hpScale: 100 });
    let stunned = false;
    for (let i = 0; i < 200 && !stunned; i++) {
      b.update(0.05);
      stunned = e.stun > 0;
    }
    expect(stunned).toBe(true);
  });

  it('heal_all: 보드 전체 회복', () => {
    const b = mk();
    b.placeMonster('lotus_fairy', 1, B(0));
    const far = b.placeMonster('pebble_turtle', 1, F(3));
    far.hp = 10;
    tick(b, skillParam('lotus_fairy', 'intervalSec') + 0.1);
    expect(far.hp).toBeGreaterThan(10);
  });

  it('burn: 맞은 적에게 화상 지속 피해', () => {
    const b = mk();
    b.placeMonster('blaze_vine', 1, F(0));
    const e = b.spawnEnemy('beetle', 0, { y: enemyStopY(cfg) });
    tick(b, 0.05);
    expect(e.burn.dps).toBe(skillParam('blaze_vine', 'dps'));
  });

  it('ground_flyers: 같은 레인 비행 적을 끌어내려 근접으로 막는다', () => {
    const b = mk();
    b.placeMonster('magnet_golem', 1, F(0));
    const crow = b.spawnEnemy('crow', 0);
    tick(b, 0.1);
    expect(crow.flying).toBe(false);
    tick(b, 15);
    expect(b.state.baseHp).toBe(b.state.baseHpMax);
  });

  it('summon_minion: 주기적으로 꿀벌 소환, max까지, lifeSec 후 소멸', () => {
    const b = mk();
    b.placeMonster('queen_bee', 1, B(0));
    const interval = skillParam('queen_bee', 'intervalSec');
    tick(b, interval + 0.1);
    expect(b.state.minions).toHaveLength(1);
    tick(b, skillParam('queen_bee', 'lifeSec'));
    expect(b.state.minions.length).toBeLessThanOrEqual(skillParam('queen_bee', 'max'));
    expect(b.state.minions.every((m) => m.life > 0)).toBe(true);
  });

  it('burn_aura: 주변 적에게 화상', () => {
    const b = mk();
    b.placeMonster('lava_turtle', 1, F(0));
    const e = b.spawnEnemy('beetle', 0, { y: enemyStopY(cfg) });
    tick(b, 0.05);
    expect(e.burn.dps).toBeCloseTo(skillParam('lava_turtle', 'dps'));
  });

  it('splash: 주변 적에게 범위 피해', () => {
    const b = mk();
    b.placeMonster('sea_urchin', 1, B(0));
    b.spawnEnemy('beetle', 0, { y: 400 });
    const near = b.spawnEnemy('beetle', 0, { y: 360 });
    tick(b, 0.05);
    expect(near.hp).toBeLessThan(near.maxHp);
  });

  it('row_shield: 같은 행 아군에게 보호막, 다른 행은 없음', () => {
    const b = mk();
    b.placeMonster('coral_golem', 1, F(0));
    const same = b.placeMonster('ember_pup', 1, F(3));
    const other = b.placeMonster('cinder_bat', 1, B(3));
    tick(b, skillParam('coral_golem', 'intervalSec') + 0.1);
    expect(same.shield).toBe(skillParam('coral_golem', 'amount'));
    expect(other.shield).toBe(0);
    b.damageMonster(same, 10, null);
    expect(same.hp).toBe(same.maxHp);
  });

  it('crit: 치명타가 발생한다', () => {
    const b = mk(3);
    b.placeMonster('thunder_fox', 1, F(0));
    b.spawnEnemy('beetle', 0, { y: enemyStopY(cfg), hpScale: 100 });
    let crits = 0;
    for (let i = 0; i < 200; i++) {
      b.update(0.05);
      crits += b.drainEvents().filter((e) => e.type === 'damage' && e.effect === 'crit').length;
    }
    expect(crits).toBeGreaterThan(0);
  });

  it('poison_cloud: 독 + 방어 감소로 받는 피해 증가', () => {
    const b = mk();
    b.placeMonster('spore_bat', 1, B(0));
    const e = b.spawnEnemy('beetle', 0, { y: 400 });
    tick(b, 0.05);
    expect(e.poison.t).toBeGreaterThan(0);
    const hp0 = e.hp;
    b.dealDamage(e, 100, { element: 'none' });
    expect(hp0 - e.hp).toBeCloseTo(100 * (1 - (e.def.armor! - skillParam('spore_bat', 'armorShred'))));
  });

  it('reflect: 보호막이 흡수한 피해는 반사하지 않는다', () => {
    const b = mk();
    const m = b.placeMonster('spike_shell', 1, F(0));
    m.shield = 1000;
    const e = b.spawnEnemy('beetle', 0);
    const hp0 = e.hp;
    b.damageMonster(m, 100, e);
    expect(e.hp).toBe(hp0);
  });

  it('summon_minion: 주인이 보드를 떠나거나 기절하면 꿀벌도 사라진다', () => {
    const b = mk();
    const q = b.placeMonster('queen_bee', 1, B(0));
    tick(b, skillParam('queen_bee', 'intervalSec') + 0.1);
    expect(b.state.minions).toHaveLength(1);
    b.damageMonster(q, q.maxHp * 10, null);
    tick(b, 0.1);
    expect(b.state.minions).toHaveLength(0);
  });

  it('summon_minion: 꿀벌 공격 속도는 JSON minionAtkSpeed', () => {
    expect(skillParam('queen_bee', 'minionAtkSpeed')).toBeGreaterThan(0);
  });
});

