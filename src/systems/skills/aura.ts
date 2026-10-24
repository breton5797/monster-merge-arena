import { skillParam, starScale } from '../../entities/Monster';
import { cellCenter, cellCol } from '../layout';
import { enemiesWithin } from '../targeting';
import type { SkillHandler } from './types';

// 오라·지형 스킬: 레인 둔화, 화상 오라, 비행 적 끌어내림, 도발(이동은 CombatSystem에서 처리)

export const laneSlow: SkillHandler = {
  aura(m, ctx, pulse) {
    const lane = cellCol(m.cell, ctx.cfg);
    const pct = skillParam(m, 'slowPct');
    for (const e of ctx.state.enemies) if (!e.dead && e.lane === lane) e.auraSlow = Math.max(e.auraSlow, pct);
    if (pulse) {
      const { x } = cellCenter(m.cell, ctx.cfg);
      ctx.emit({ type: 'skill', skill: 'lane_slow', x, y: ctx.cfg.layout.fieldTop });
    }
  },
};

export const burnAura: SkillHandler = {
  aura(m, ctx, pulse) {
    const { x, y } = cellCenter(m.cell, ctx.cfg);
    const radius = skillParam(m, 'radius');
    const dps = skillParam(m, 'dps') * starScale(m.star, ctx.cfg);
    for (const e of enemiesWithin(ctx.state, x, y, radius)) {
      e.burn.dps = Math.max(e.burn.dps, dps);
      e.burn.t = Math.max(e.burn.t, ctx.cfg.combat.auraTickSec);
    }
    if (pulse) ctx.emit({ type: 'skill', skill: 'burn_aura', x, y, radius });
  },
};

export const groundFlyers: SkillHandler = {
  aura(m, ctx) {
    const lane = cellCol(m.cell, ctx.cfg);
    for (const e of ctx.state.enemies) {
      if (e.dead || !e.flying || e.lane !== lane || e.y < ctx.cfg.layout.fieldTop) continue;
      e.flying = false;
      ctx.emit({ type: 'skill', skill: 'ground_flyers', x: e.x, y: e.y });
    }
  },
};

/** 진흙거인: CombatSystem이 hasSkill(m,'taunt_adjacent_lanes')로 옆 레인 적을 끌어온다 */
export const tauntAdjacentLanes: SkillHandler = {};
