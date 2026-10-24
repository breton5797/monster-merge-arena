import { skillParam, starScale } from '../../entities/Monster';
import { getMultiplier } from '../elements';
import { cellCenter } from '../layout';
import { enemiesWithin } from '../targeting';
import { every, type SkillHandler } from './types';

// 월드 2 스킬: 메테오, 관통, 재생, 넉백, 흡혈, 에너지 생산, 처형, 분노, 대공 (주변 버프는 CombatSystem.computeHit)

export const meteor: SkillHandler = {
  onTick(m, dt, ctx) {
    every(m, dt, skillParam(m, 'intervalSec'), () => {
      // 기지에 가장 가까운 적을 노린다
      const target = ctx.state.enemies.filter((e) => !e.dead && e.y >= ctx.cfg.layout.fieldTop).sort((a, b) => b.y - a.y)[0];
      if (!target) return;
      const radius = skillParam(m, 'radius');
      const from = cellCenter(m.cell, ctx.cfg);
      ctx.emit({ type: 'skill', skill: 'meteor', x: target.x, y: target.y, toX: from.x, toY: from.y, radius, element: m.def.element });
      const dmg = skillParam(m, 'damage') * starScale(m.star, ctx.cfg) * (1 + ctx.state.elementBuff[m.def.element]);
      for (const e of enemiesWithin(ctx.state, target.x, target.y, radius)) {
        ctx.dealDamage(e, dmg * getMultiplier(m.def.element, e.element, ctx.data.elements), { element: m.def.element, monster: m });
      }
    });
  },
};

export const pierce: SkillHandler = {
  selectTargets(m, candidates, ctx) {
    const hits = candidates.slice(0, Math.max(1, skillParam(m, 'count')));
    const from = cellCenter(m.cell, ctx.cfg);
    const far = hits[hits.length - 1];
    ctx.emit({ type: 'skill', skill: 'pierce', x: from.x, y: from.y, toX: far.x, toY: far.y, element: m.def.element });
    return hits;
  },
};

export const regen: SkillHandler = {
  // 매 틱 조금씩 회복 (팝업이 쏟아지지 않게 이벤트 없이)
  onTick(m, dt) {
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * skillParam(m, 'hpPctPerSec') * dt);
  },
};

export const knockback: SkillHandler = {
  onHit(m, t, _raw, ctx) {
    if (t.dead || ctx.rng.next() >= skillParam(m, 'chance')) return;
    const px = skillParam(m, 'px') * (t.def.boss ? ctx.cfg.combat.bossKnockbackPct : 1);
    t.y = Math.max(ctx.cfg.layout.spawnY, t.y - px);
    t.blocked = false;
    ctx.emit({ type: 'skill', skill: 'knockback', x: t.x, y: t.y });
  },
};

export const lifesteal: SkillHandler = {
  onHit(m, _t, raw, ctx) {
    ctx.healMonster(m, raw * skillParam(m, 'pct'));
  },
};

export const energyGain: SkillHandler = {
  onTick(m, dt, ctx) {
    every(m, dt, skillParam(m, 'intervalSec'), () => {
      ctx.state.energy += skillParam(m, 'amount');
      const { x, y } = cellCenter(m.cell, ctx.cfg);
      ctx.emit({ type: 'skill', skill: 'energy_gain', x, y });
    });
  },
};

export const execute: SkillHandler = {
  modifyHit(m, t) {
    return t.hp / t.maxHp < skillParam(m, 'thresholdPct') ? { mult: skillParam(m, 'mult'), crit: true } : { mult: 1, crit: false };
  },
};

export const rage: SkillHandler = {
  attackSpeedMult(m) {
    return 1 + m.stacks * skillParam(m, 'perHitPct');
  },
  onHit(m) {
    m.stacks = Math.min(skillParam(m, 'maxStacks'), m.stacks + 1);
  },
  onIdle(m) {
    m.stacks = 0;
  },
};

export const antiAir: SkillHandler = {
  modifyHit(m, t) {
    return t.flying ? { mult: skillParam(m, 'mult'), crit: true } : { mult: 1, crit: false };
  },
};

/** 고목거인: CombatSystem.computeHit이 옆 칸의 이 스킬을 찾아 공격력을 올린다 */
export const buffAdjacent: SkillHandler = {};
