import { cellCenter } from '../layout';
import { skillParam } from '../../entities/Monster';
import type { SkillHandler } from './types';

// 공격·방어 변형 스킬: 다중 타깃, 치명타, 반사, 1회 부활

export const multiTarget: SkillHandler = {
  selectTargets(m, candidates) {
    return candidates.slice(0, Math.max(1, skillParam(m, 'targets')));
  },
};

export const crit: SkillHandler = {
  modifyHit(m, ctx) {
    return ctx.rng.next() < skillParam(m, 'chance') ? { mult: skillParam(m, 'mult'), crit: true } : { mult: 1, crit: false };
  },
};

export const reflect: SkillHandler = {
  onDamaged(m, attacker, amount, ctx) {
    if (attacker.dead) return;
    const { x, y } = cellCenter(m.cell, ctx.cfg);
    ctx.emit({ type: 'skill', skill: 'reflect', x, y, toX: attacker.x, toY: attacker.y });
    ctx.dealDamage(attacker, amount * skillParam(m, 'pct'), { element: m.def.element, monster: m });
  },
};

export const reviveOnce: SkillHandler = {
  onKnockout(m, ctx) {
    if (m.revived) return false;
    m.revived = true;
    m.hp = m.maxHp * skillParam(m, 'hpPct');
    ctx.emit({ type: 'revive', uid: m.uid });
    return true;
  },
};
