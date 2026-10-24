import { createEnemy, isBoss, type EnemyUnit } from '../entities/Enemy';
import { createMonster, isKnockedOut, type MonsterUnit } from '../entities/Monster';
import { ELEMENT_IDS, type ElementId, type GameConfig, type GameData } from '../types';
import type { BattleEvent, BattleState, CombatCtx, DamageEffect, HitSource } from './BattleState';
import { emptyCells, preferredEmptyCell, unitsOnBoard } from './BoardSystem';
import { computeHit, recover, updateAuras, updateEnemies, updateMinions, updateMonsters } from './CombatSystem';
import { laneX } from './layout';
import { resolve, type MergeResult } from './MergeSystem';
import { generatePicks, type PickOption } from './PickSystem';
import { pickOne, type Rng } from './rng';
import { skillOf } from './skills';
import { buildSchedule } from './WaveSystem';

export interface BattleOptions {
  readonly stageId: number;
  readonly rng: Rng;
  readonly discovered: Iterable<string>;
  readonly hints: Readonly<Record<string, string>>;
  /** 테스트용: 시작 몬스터 수 덮어쓰기 */
  readonly startingMonsters?: number;
  /** 테스트용: 웨이브 끄기 */
  readonly noWaves?: boolean;
}

export type DropOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'move' }
  | { readonly kind: 'merge'; readonly result: MergeResult; readonly aId: string; readonly bId: string; readonly isNewDiscovery: boolean; readonly isFirstChimera: boolean; readonly unit: MonsterUnit | null };

const MAX_STEP = 0.05;
const PLAY_ELEMENTS = ELEMENT_IDS.filter((e) => e !== 'none');

/**
 * 한 판의 전투 모델 (Phaser 의존 없음). BattleScene은 이 모델을 그리기만 하고,
 * 시뮬레이션 봇과 테스트도 같은 모델을 사용한다. 내부 상태 변경은 이 클래스와 systems/에 한정된다.
 */
export class Battle implements CombatCtx {
  readonly state: BattleState;
  readonly cfg: GameConfig;
  private uid = 1;
  private revived = false;
  private events: BattleEvent[] = [];

  constructor(readonly data: GameData, opts: BattleOptions, readonly rng: Rng = opts.rng) {
    this.cfg = data.config;
    const stage = data.stages.find((s) => s.id === opts.stageId);
    if (!stage) throw new Error(`stages.json에 stage ${opts.stageId}가 없습니다`);
    const cells = this.cfg.board.cols * this.cfg.board.rows;
    this.state = {
      stage,
      board: Array.from({ length: cells }, () => null),
      enemies: [],
      minions: [],
      time: 0,
      baseHp: stage.baseHp,
      baseHpMax: stage.baseHp,
      energy: this.cfg.energy.start,
      summonCount: 0,
      elementBuff: Object.fromEntries(ELEMENT_IDS.map((e) => [e, 0])) as Record<ElementId, number>,
      kills: 0,
      mergesTotal: 0,
      nextPickAt: this.cfg.pick.intervalSec,
      picksShown: 0,
      rerollsLeft: this.cfg.pick.freeRerollsPerRun,
      awaitingPick: false,
      currentPick: [],
      discovered: new Set(opts.discovered),
      hints: { ...opts.hints },
      newDiscoveries: [],
      bossSpawned: false,
      bossDefeated: false,
      bossEscaped: false,
      result: null,
      schedule: opts.noWaves ? [] : buildSchedule(stage),
      scheduleIdx: 0,
      auraTimer: 0,
    };
    const start = opts.startingMonsters ?? this.cfg.startingMonsters;
    for (let i = 0; i < start; i++) this.placeRandomBase();
  }

  // ---------------------------------------------------------------- 진행

  update(dt: number): void {
    let remaining = dt;
    while (remaining > 1e-9 && !this.state.result && !this.state.awaitingPick) {
      const step = Math.min(MAX_STEP, remaining);
      this.step(step);
      remaining -= step;
    }
  }

  drainEvents(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  get remainingSec(): number {
    return Math.max(0, this.state.stage.durationSec - this.state.time);
  }

  get boss(): EnemyUnit | undefined {
    return this.state.enemies.find((e) => isBoss(e) && !e.dead);
  }

  private step(dt: number): void {
    const s = this.state;
    s.time += dt;
    this.spawnScheduled();
    s.auraTimer += dt;
    const pulse = s.auraTimer >= this.cfg.combat.auraTickSec;
    if (pulse) s.auraTimer -= this.cfg.combat.auraTickSec;
    updateAuras(this, pulse);
    updateMonsters(this, dt);
    updateMinions(this, dt);
    updateEnemies(this, dt);
    s.enemies = s.enemies.filter((e) => !e.dead);
    this.checkEnd();
    if (!s.result && s.time >= s.nextPickAt && s.nextPickAt < s.stage.durationSec) {
      s.nextPickAt += this.cfg.pick.intervalSec;
      s.picksShown++;
      s.awaitingPick = true;
      s.currentPick = this.rollPicks();
      this.emit({ type: 'pick' });
    }
  }

  private checkEnd(): void {
    const s = this.state;
    if (s.result) return;
    if (s.baseHp <= 0) s.result = 'lose';
    else if (s.time >= s.stage.durationSec && (!s.stage.bossRequired || s.bossDefeated)) s.result = 'win';
    if (s.result) this.emit({ type: 'end', result: s.result });
  }

  private spawnScheduled(): void {
    const s = this.state;
    while (s.scheduleIdx < s.schedule.length && s.schedule[s.scheduleIdx].time <= s.time) {
      const entry = s.schedule[s.scheduleIdx++];
      for (let i = 0; i < entry.count; i++) {
        const lane = entry.lane === 'center' ? pickOne(this.rng, this.cfg.combat.bossLanes) : typeof entry.lane === 'number' ? entry.lane : Math.floor(this.rng.next() * this.cfg.board.cols);
        this.spawnEnemy(entry.enemyId, lane, { hpScale: entry.hpScale });
      }
    }
  }

  // ---------------------------------------------------------------- CombatCtx

  emit(ev: BattleEvent): void {
    this.events.push(ev);
  }

  nextUid(): number {
    return this.uid++;
  }

  computeHit(m: MonsterUnit, e: EnemyUnit): { amount: number; effect: DamageEffect } {
    return computeHit(this, m, e);
  }

  /** 방어력(armor - 독 방깎) 적용 후 실제 피해를 준다. 반환값 = 실제 피해 */
  dealDamage(enemy: EnemyUnit, amount: number, src: HitSource, effect: DamageEffect | 'silent' = 'neutral'): number {
    if (enemy.dead) return 0;
    // 유령(ethereal): 근접 몬스터의 공격은 일부만 들어간다
    if (src.monster?.def.range === 'melee' && enemy.def.meleeTakenPct !== undefined) amount *= enemy.def.meleeTakenPct;
    const armor = Math.max(this.cfg.combat.minArmor, (enemy.def.armor ?? 0) - (enemy.poison.t > 0 ? enemy.poison.pct : 0));
    const dealt = effect === 'silent' ? amount * (1 - armor) : Math.max(this.cfg.combat.minDamage, amount * (1 - armor));
    enemy.hp -= dealt;
    if (effect !== 'silent') this.emit({ type: 'damage', uid: enemy.uid, x: enemy.x, y: enemy.y, amount: dealt, effect });
    if (enemy.hp <= 0) this.kill(enemy);
    return dealt;
  }

  damageMonster(m: MonsterUnit, amount: number, attacker: EnemyUnit | null): void {
    if (isKnockedOut(m)) return;
    const absorbed = Math.min(m.shield, amount);
    m.shield -= absorbed;
    const dmg = amount - absorbed;
    m.hp -= dmg;
    this.emit({ type: 'monsterDamage', uid: m.uid, amount: dmg });
    if (attacker && dmg > 0) skillOf(m).onDamaged?.(m, attacker, dmg, this);
    if (m.hp > 0) return;
    if (skillOf(m).onKnockout?.(m, this)) return;
    m.hp = 0;
    m.shield = 0;
    m.koTimer = this.cfg.knockoutSec;
    this.emit({ type: 'ko', uid: m.uid });
  }

  healMonster(m: MonsterUnit, amount: number): void {
    const healed = Math.min(amount, m.maxHp - m.hp);
    if (healed <= 0) return;
    m.hp += healed;
    this.emit({ type: 'heal', uid: m.uid, amount: healed });
  }

  spawnEnemy(enemyId: string, lane: number, opts: { hpScale?: number; y?: number } = {}): EnemyUnit {
    const def = this.data.enemyById.get(enemyId);
    if (!def) throw new Error(`enemies.json에 '${enemyId}'가 없습니다`);
    const element = def.boss ? def.boss.elementCycle[0] : def.element === 'random' ? pickOne(this.rng, PLAY_ELEMENTS) : def.element;
    const e = createEnemy(this.nextUid(), def, element, opts.hpScale ?? 1, lane, laneX(lane, this.cfg), opts.y ?? this.cfg.layout.spawnY);
    this.state.enemies.push(e);
    if (isBoss(e)) {
      this.state.bossSpawned = true;
      this.emit({ type: 'bossSpawn' });
    }
    return e;
  }

  private kill(e: EnemyUnit): void {
    const s = this.state;
    e.dead = true;
    s.kills++;
    s.energy += e.def.energy;
    this.emit({ type: 'kill', x: e.x, y: e.y, energy: e.def.energy, boss: isBoss(e), name: e.def.name });
    if (isBoss(e)) s.bossDefeated = true;
    if (e.def.splitInto && e.def.splitCount) {
      for (let i = 0; i < e.def.splitCount; i++) {
        this.spawnEnemy(e.def.splitInto, e.lane, { hpScale: e.hpScale, y: e.y - i * this.cfg.combat.enemyStackOffsetPx });
      }
    }
  }

  // ---------------------------------------------------------------- 보드 조작

  summonCost(): number {
    return this.cfg.energy.summonBaseCost + this.cfg.energy.summonCostStep * this.state.summonCount;
  }

  canSummon(): boolean {
    return !this.state.result && this.state.energy >= this.summonCost() && emptyCells(this.state.board).length > 0;
  }

  /** 에너지를 내고 무작위 기본 몬스터를 앞줄 우선으로 소환 */
  summon(): MonsterUnit | null {
    if (!this.canSummon()) return null;
    this.state.energy -= this.summonCost();
    this.state.summonCount++;
    return this.placeRandomBase();
  }

  /** 디버그·3택용: 지정 칸(생략 시 앞줄 우선 빈칸)에 몬스터 배치 */
  placeMonster(defId: string, star: number, cell?: number): MonsterUnit {
    const def = this.data.monsterById.get(defId);
    if (!def) throw new Error(`monsters.json에 '${defId}'가 없습니다`);
    const at = cell ?? preferredEmptyCell(this.state.board, this.cfg, this.rng);
    if (at < 0) throw new Error('빈칸이 없습니다');
    const unit = createMonster(this.nextUid(), def, star, at, this.cfg);
    this.state.board[at] = unit;
    if (def.tier === 1) this.state.discovered.add(def.id);
    return unit;
  }

  private placeRandomBase(): MonsterUnit | null {
    if (emptyCells(this.state.board).length === 0) return null;
    const base = this.data.monsters.filter((m) => m.tier === 1);
    return this.placeMonster(pickOne(this.rng, base).id, 1);
  }

  /** 드래그 A(from)를 B(to)에 놓음: 빈칸이면 이동, 몬스터가 있으면 합성 판정 */
  dragDrop(from: number, to: number): DropOutcome {
    const { board } = this.state;
    const a = board[from];
    if (!a || from === to || to < 0 || to >= board.length || this.state.result) return { kind: 'none' };
    const b = board[to];
    if (!b) {
      board[from] = null;
      board[to] = a;
      a.cell = to;
      return { kind: 'move' };
    }
    const result = resolve(a, b, this.data);
    if (result.kind === 'invalid') return { kind: 'merge', result, aId: a.defId, bId: b.defId, isNewDiscovery: false, isFirstChimera: false, unit: null };

    const isNewDiscovery = result.kind === 'recipe' && !this.state.discovered.has(result.resultId);
    const isFirstChimera = result.kind === 'chimera' && !this.state.discovered.has(result.resultId);
    if (isNewDiscovery || isFirstChimera) {
      this.state.discovered.add(result.resultId);
      this.state.newDiscoveries.push(result.resultId);
    }
    board[from] = null;
    const unit = this.placeMonster(result.resultId, result.star, to);
    this.state.mergesTotal++;
    return { kind: 'merge', result, aId: a.defId, bId: b.defId, isNewDiscovery, isFirstChimera, unit };
  }

  // ---------------------------------------------------------------- 부활 (보상형 광고)

  canRevive(): boolean {
    return this.state.result === 'lose' && !this.revived && !this.state.bossEscaped;
  }

  /** 패배 직후 1회: 기지 HP 일부 회복, 보스를 제외한 적 제거, 전투 재개 */
  revive(): boolean {
    if (!this.canRevive()) return false;
    const s = this.state;
    this.revived = true;
    s.result = null;
    s.baseHp = s.baseHpMax * this.cfg.revive.baseHpPct;
    s.enemies = s.enemies.filter((e) => isBoss(e) && !e.dead);
    return true;
  }

  // ---------------------------------------------------------------- 3택

  private rollPicks(): PickOption[] {
    const { board, discovered, hints } = this.state;
    return generatePicks({ data: this.data, boardIds: unitsOnBoard(board).map((m) => m.defId), emptyCount: emptyCells(board).length, discovered, hints, rng: this.rng });
  }

  reroll(): boolean {
    const s = this.state;
    if (!s.awaitingPick || s.rerollsLeft <= 0) return false;
    s.rerollsLeft--;
    s.currentPick = this.rollPicks();
    return true;
  }

  /** 카드 선택 → 효과 적용 → 전투 재개. 새로 배치된 몬스터 반환 */
  choosePick(index: number): { option: PickOption; placed: MonsterUnit[] } | null {
    const s = this.state;
    const option = s.currentPick[index];
    if (!s.awaitingPick || !option) return null;
    const placed: MonsterUnit[] = [];
    const place = (id: string) => {
      if (emptyCells(s.board).length > 0) placed.push(this.placeMonster(id, 1));
    };
    switch (option.kind) {
      case 'monster':
        place(option.monsterId);
        break;
      case 'monster_pair':
        place(option.monsterId);
        place(option.monsterId);
        break;
      case 'recipe_hint':
        s.hints[option.resultId] = option.revealId;
        place(option.revealId);
        break;
      case 'buff_element':
        s.elementBuff[option.element] += this.cfg.pick.buffElementPct;
        break;
      case 'heal':
        s.baseHp = Math.min(s.baseHpMax, s.baseHp + s.baseHpMax * this.cfg.pick.healBasePct);
        for (const m of unitsOnBoard(s.board)) if (isKnockedOut(m)) recover(this, m);
        break;
      case 'energy':
        s.energy += this.cfg.pick.energyAmount;
        break;
    }
    s.awaitingPick = false;
    s.currentPick = [];
    return { option, placed };
  }
}
