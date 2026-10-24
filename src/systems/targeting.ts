import type { EnemyUnit } from '../entities/Enemy';
import type { BattleState } from './BattleState';
import type { GameConfig } from '../types';

/** 레인에서 공격 가능한 적 목록 (기지에 가까운 순). 근접은 경계선 근처 + 지상 적만 */
export function targetsInLane(state: BattleState, lane: number, ranged: boolean, cfg: GameConfig): EnemyUnit[] {
  const minY = ranged ? cfg.layout.fieldTop : cfg.layout.boardTop - cfg.board.meleeReachPx;
  return state.enemies
    .filter((e) => !e.dead && e.lane === lane && e.y >= minY && (ranged || !e.flying))
    .sort((a, b) => b.y - a.y);
}

export function enemiesWithin(state: BattleState, x: number, y: number, radius: number): EnemyUnit[] {
  const r2 = radius * radius;
  return state.enemies.filter((e) => !e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 <= r2);
}
