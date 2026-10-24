import type { EnemyUnit } from '../../entities/Enemy';
import type { MonsterUnit } from '../../entities/Monster';
import type { CombatCtx } from '../BattleState';

/** 스킬 훅. 모든 훅은 선택적이며, 파라미터는 monsters.json의 skill 객체에서 읽는다. */
export interface SkillHandler {
  /** 기본 공격 대상 목록 변경 (candidates는 기지에 가까운 순) */
  selectTargets?(m: MonsterUnit, candidates: EnemyUnit[], ctx: CombatCtx): EnemyUnit[];
  /** 공격 데미지 배율 (치명타 등) */
  modifyHit?(m: MonsterUnit, ctx: CombatCtx): { mult: number; crit: boolean };
  /** 공격 적중 후 (rawAmount = 방어력 적용 전 데미지) */
  onHit?(m: MonsterUnit, target: EnemyUnit, rawAmount: number, ctx: CombatCtx): void;
  /** 매 틱 (기절 아닐 때) — 주기 스킬 */
  onTick?(m: MonsterUnit, dt: number, ctx: CombatCtx): void;
  /** 매 틱 오라 (기절 아닐 때). pulse = auraTickSec마다 true (연출용) */
  aura?(m: MonsterUnit, ctx: CombatCtx, pulse: boolean): void;
  /** 적에게 맞았을 때 */
  onDamaged?(m: MonsterUnit, attacker: EnemyUnit, amount: number, ctx: CombatCtx): void;
  /** HP 0이 되었을 때. true면 기절을 막음 */
  onKnockout?(m: MonsterUnit, ctx: CombatCtx): boolean;
}

/** intervalSec마다 fn 실행 */
export function every(m: MonsterUnit, dt: number, intervalSec: number, fn: () => void): void {
  m.skillTimer += dt;
  if (intervalSec > 0 && m.skillTimer >= intervalSec) {
    m.skillTimer -= intervalSec;
    fn();
  }
}
