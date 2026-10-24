import type { GameConfig, MonsterDef } from '../types';

/** 보드 위 몬스터 1마리의 런타임 상태 */
export interface MonsterUnit {
  readonly uid: number;
  readonly defId: string;
  readonly def: MonsterDef;
  readonly star: number;
  readonly maxHp: number;
  readonly atk: number;
  cell: number;
  hp: number;
  koTimer: number;
  shield: number;
  cooldown: number;
  skillTimer: number;
  revived: boolean;
}

export function starScale(star: number, cfg: GameConfig): number {
  return Math.pow(cfg.starMultiplier, star - 1);
}

export function createMonster(uid: number, def: MonsterDef, star: number, cell: number, cfg: GameConfig): MonsterUnit {
  const s = starScale(star, cfg);
  const maxHp = def.hp * s;
  return { uid, defId: def.id, def, star, maxHp, atk: def.atk * s, cell, hp: maxHp, koTimer: 0, shield: 0, cooldown: 0, skillTimer: 0, revived: false };
}

export function isKnockedOut(m: MonsterUnit): boolean {
  return m.koTimer > 0;
}

/** 스킬 숫자 파라미터 (types.ts의 SKILL_PARAMS로 로드 시 검증됨) */
export function skillParam(m: MonsterUnit, key: string): number {
  const v = m.def.skill?.[key];
  return typeof v === 'number' ? v : 0;
}
