import { skillParam, starScale } from '../../entities/Monster';
import type { EnemyUnit } from '../../entities/Enemy';
import { enemiesWithin } from '../targeting';
import type { SkillHandler } from './types';

// 적중 시 발동하는 스킬: 둔화탄, 기절, 화상, 독구름, 범위, 연쇄번개

export const slowShot: SkillHandler = {
  onHit(m, t) {
    t.slow.pct = Math.max(t.slow.pct, skillParam(m, 'slowPct'));
    t.slow.t = Math.max(t.slow.t, skillParam(m, 'durationSec'));
  },
};

export const stunChance: SkillHandler = {
  onHit(m, t, _raw, ctx) {
    if (ctx.rng.next() >= skillParam(m, 'chance')) return;
    t.stun = Math.max(t.stun, skillParam(m, 'durationSec'));
    ctx.emit({ type: 'skill', skill: 'stun_chance', x: t.x, y: t.y });
  },
};

export const burn: SkillHandler = {
  onHit(m, t, _raw, ctx) {
    t.burn.dps = Math.max(t.burn.dps, skillParam(m, 'dps') * starScale(m.star, ctx.cfg));
    t.burn.t = Math.max(t.burn.t, skillParam(m, 'durationSec'));
  },
};

export const poisonCloud: SkillHandler = {
  onHit(m, t, _raw, ctx) {
    t.poison.dps = Math.max(t.poison.dps, skillParam(m, 'dps') * starScale(m.star, ctx.cfg));
    t.poison.pct = Math.max(t.poison.pct, skillParam(m, 'armorShred'));
    t.poison.t = Math.max(t.poison.t, skillParam(m, 'durationSec'));
    ctx.emit({ type: 'skill', skill: 'poison_cloud', x: t.x, y: t.y });
  },
};

export const splash: SkillHandler = {
  onHit(m, t, raw, ctx) {
    const radius = skillParam(m, 'radius');
    const others = enemiesWithin(ctx.state, t.x, t.y, radius).filter((e) => e !== t);
    ctx.emit({ type: 'skill', skill: 'splash', x: t.x, y: t.y, radius });
    for (const e of others) ctx.dealDamage(e, raw * skillParam(m, 'pct'), { element: m.def.element, monster: m });
  },
};

export const chainLanes: SkillHandler = {
  onHit(m, t, raw, ctx) {
    const visited = new Set([t.lane]);
    let current: EnemyUnit = t;
    let amount = raw;
    for (let j = 0; j < skillParam(m, 'jumps'); j++) {
      const from = current;
      const next = ctx.state.enemies
        .filter((e) => !e.dead && !visited.has(e.lane) && Math.abs(e.lane - from.lane) === 1 && e.y >= ctx.cfg.layout.fieldTop)
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      if (!next) return;
      amount *= skillParam(m, 'falloff');
      visited.add(next.lane);
      ctx.emit({ type: 'skill', skill: 'chain_lanes', x: from.x, y: from.y, toX: next.x, toY: next.y });
      ctx.dealDamage(next, amount, { element: m.def.element, monster: m });
      current = next;
    }
  },
};
