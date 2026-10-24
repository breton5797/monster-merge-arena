import type { EnemyUnit } from '../entities/Enemy';
import type { MonsterUnit } from '../entities/Monster';
import type { ElementId, GameConfig, GameData, SkillId, StageDef } from '../types';
import type { PickOption } from './PickSystem';
import type { Rng } from './rng';
import type { SpawnEntry } from './WaveSystem';

/** 꿀벌여왕이 소환하는 임시 원거리 하수인 */
export interface Minion {
  readonly uid: number;
  readonly ownerUid: number;
  readonly lane: number;
  readonly atk: number;
  readonly atkSpeed: number;
  readonly x: number;
  readonly y: number;
  cooldown: number;
  life: number;
}

export type DamageEffect = 'adv' | 'dis' | 'neutral' | 'crit';

/** 모델 → 화면으로 전달되는 일회성 이벤트 (연출용) */
export type BattleEvent =
  | { readonly type: 'attack'; readonly fromX: number; readonly fromY: number; readonly toX: number; readonly toY: number; readonly ranged: boolean; readonly element: ElementId }
  | { readonly type: 'damage'; readonly x: number; readonly y: number; readonly amount: number; readonly effect: DamageEffect }
  | { readonly type: 'monsterDamage'; readonly uid: number; readonly amount: number }
  | { readonly type: 'kill'; readonly x: number; readonly y: number; readonly energy: number; readonly boss: boolean }
  | { readonly type: 'baseHit'; readonly amount: number; readonly x: number }
  | { readonly type: 'skill'; readonly skill: SkillId; readonly x: number; readonly y: number; readonly toX?: number; readonly toY?: number; readonly radius?: number }
  | { readonly type: 'ko'; readonly uid: number }
  | { readonly type: 'recover'; readonly uid: number }
  | { readonly type: 'revive'; readonly uid: number }
  | { readonly type: 'heal'; readonly uid: number; readonly amount: number }
  | { readonly type: 'enemyHeal'; readonly x: number; readonly y: number; readonly radius: number }
  | { readonly type: 'bossSpawn' }
  | { readonly type: 'bossElement'; readonly element: ElementId }
  | { readonly type: 'bossSummon' }
  | { readonly type: 'pick' }
  | { readonly type: 'end'; readonly result: 'win' | 'lose' };

export interface BattleState {
  readonly stage: StageDef;
  readonly board: (MonsterUnit | null)[];
  enemies: EnemyUnit[];
  minions: Minion[];
  time: number;
  baseHp: number;
  readonly baseHpMax: number;
  energy: number;
  summonCount: number;
  readonly elementBuff: Record<ElementId, number>;
  kills: number;
  mergesTotal: number;
  nextPickAt: number;
  picksShown: number;
  rerollsLeft: number;
  awaitingPick: boolean;
  currentPick: PickOption[];
  readonly discovered: Set<string>;
  readonly hints: Record<string, string>;
  readonly newDiscoveries: string[];
  bossSpawned: boolean;
  bossDefeated: boolean;
  result: 'win' | 'lose' | null;
  readonly schedule: readonly SpawnEntry[];
  scheduleIdx: number;
  auraTimer: number;
}

export interface HitSource {
  readonly element: ElementId;
  readonly monster?: MonsterUnit;
}

/** 전투 시스템·스킬이 모델에 접근하는 인터페이스 (Battle이 구현) */
export interface CombatCtx {
  readonly data: GameData;
  readonly cfg: GameConfig;
  readonly state: BattleState;
  readonly rng: Rng;
  emit(ev: BattleEvent): void;
  nextUid(): number;
  dealDamage(enemy: EnemyUnit, amount: number, src: HitSource, effect?: DamageEffect | 'silent'): number;
  damageMonster(m: MonsterUnit, amount: number, attacker: EnemyUnit | null): void;
  healMonster(m: MonsterUnit, amount: number): void;
  spawnEnemy(enemyId: string, lane: number, opts?: { hpScale?: number; y?: number }): EnemyUnit;
}
