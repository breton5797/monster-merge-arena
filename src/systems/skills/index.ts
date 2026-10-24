import type { MonsterUnit } from '../../entities/Monster';
import type { SkillId } from '../../types';
import { antiAir, buffAdjacent, energyGain, execute, knockback, lifesteal, meteor, pierce, rage, regen } from './advanced';
import { burnAura, groundFlyers, laneSlow, tauntAdjacentLanes } from './aura';
import { crit, multiTarget, reflect, reviveOnce } from './combat';
import { burn, chainLanes, poisonCloud, slowShot, splash, stunChance } from './onHit';
import { healAdjacent, healAll, rowShield, summonMinion } from './support';
import type { SkillHandler } from './types';

export type { SkillHandler } from './types';

/** skill.id → 동작. types.ts의 SKILL_PARAMS와 키가 1:1 (Record라 누락 시 컴파일 에러) */
export const SKILLS: Record<SkillId, SkillHandler> = {
  slow_shot: slowShot,
  heal_adjacent: healAdjacent,
  reflect,
  multi_target: multiTarget,
  lane_slow: laneSlow,
  revive_once: reviveOnce,
  chain_lanes: chainLanes,
  taunt_adjacent_lanes: tauntAdjacentLanes,
  stun_chance: stunChance,
  heal_all: healAll,
  burn,
  ground_flyers: groundFlyers,
  summon_minion: summonMinion,
  burn_aura: burnAura,
  splash,
  row_shield: rowShield,
  crit,
  poison_cloud: poisonCloud,
  meteor,
  pierce,
  regen,
  knockback,
  lifesteal,
  energy_gain: energyGain,
  buff_adjacent: buffAdjacent,
  execute,
  rage,
  anti_air: antiAir,
};

const NONE: SkillHandler = {};

export function skillOf(m: MonsterUnit): SkillHandler {
  return m.def.skill ? SKILLS[m.def.skill.id] : NONE;
}

export function hasSkill(m: MonsterUnit, id: SkillId): boolean {
  return m.def.skill?.id === id;
}
