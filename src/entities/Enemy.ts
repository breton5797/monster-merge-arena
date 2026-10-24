import type { ElementId, EnemyDef } from '../types';

export interface Status {
  pct: number;
  dps: number;
  t: number;
}

/** 전장 위 적 1마리의 런타임 상태 */
export interface EnemyUnit {
  readonly uid: number;
  readonly def: EnemyDef;
  readonly maxHp: number;
  readonly hpScale: number;
  element: ElementId;
  hp: number;
  x: number;
  y: number;
  lane: number;
  blocked: boolean;
  flying: boolean;
  cooldown: number;
  dead: boolean;
  slow: Status;
  auraSlow: number;
  burn: Status;
  poison: Status;
  stun: number;
  healTimer: number;
  bossTimer: number;
  bossCycleIdx: number;
  bossSummoned: boolean;
}

const emptyStatus = (): Status => ({ pct: 0, dps: 0, t: 0 });

export function createEnemy(uid: number, def: EnemyDef, element: ElementId, hpScale: number, lane: number, x: number, y: number): EnemyUnit {
  const maxHp = def.hp * hpScale;
  return {
    uid, def, maxHp, hpScale, element, hp: maxHp, x, y, lane,
    blocked: false, flying: def.flags.includes('flying'), cooldown: 0, dead: false,
    slow: emptyStatus(), auraSlow: 0, burn: emptyStatus(), poison: emptyStatus(), stun: 0,
    healTimer: 0, bossTimer: 0, bossCycleIdx: 0, bossSummoned: false,
  };
}

export function isBoss(e: EnemyUnit): boolean {
  return e.def.flags.includes('boss');
}
