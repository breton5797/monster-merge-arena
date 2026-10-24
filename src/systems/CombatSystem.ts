import { isBoss, type EnemyUnit } from '../entities/Enemy';
import { isKnockedOut, type MonsterUnit } from '../entities/Monster';
import type { DamageEffect, CombatCtx } from './BattleState';
import { frontBlocker, unitsOnBoard } from './BoardSystem';
import { getMultiplier } from './elements';
import { cellCenter, cellCol, enemyStopY, isFrontRow, laneX } from './layout';
import { hasSkill, skillOf } from './skills';
import { targetsInLane } from './targeting';

// GAME_DESIGN.md §3 전투 규칙: 타깃팅, 공격, 이동, 막기, 기지 피해, 상태이상

export function computeHit(ctx: CombatCtx, m: MonsterUnit, e: EnemyUnit): { amount: number; effect: DamageEffect } {
  const mult = getMultiplier(m.def.element, e.element, ctx.data.elements);
  const buff = 1 + ctx.state.elementBuff[m.def.element];
  const effect: DamageEffect = mult > 1 ? 'adv' : mult < 1 ? 'dis' : 'neutral';
  return { amount: m.atk * buff * mult, effect };
}

/** 오라 효과는 매 틱 다시 계산한다 */
export function updateAuras(ctx: CombatCtx, pulse: boolean): void {
  for (const e of ctx.state.enemies) e.auraSlow = 0;
  for (const m of unitsOnBoard(ctx.state.board)) {
    if (!isKnockedOut(m)) skillOf(m).aura?.(m, ctx, pulse);
  }
}

export function updateMonsters(ctx: CombatCtx, dt: number): void {
  for (const m of unitsOnBoard(ctx.state.board)) {
    if (isKnockedOut(m)) {
      m.koTimer -= dt;
      if (m.koTimer <= 0) recover(ctx, m);
      continue;
    }
    const skill = skillOf(m);
    skill.onTick?.(m, dt, ctx);
    m.cooldown -= dt;
    if (m.cooldown > 0) continue;
    const ranged = m.def.range === 'ranged';
    const candidates = ranged || isFrontRow(m.cell, ctx.cfg) ? targetsInLane(ctx.state, cellCol(m.cell, ctx.cfg), ranged, ctx.cfg) : [];
    if (candidates.length === 0) {
      m.cooldown = 0;
      continue;
    }
    const targets = skill.selectTargets ? skill.selectTargets(m, candidates, ctx) : [candidates[0]];
    const from = cellCenter(m.cell, ctx.cfg);
    for (const t of targets) {
      const hit = computeHit(ctx, m, t);
      const mod = skill.modifyHit?.(m, ctx) ?? { mult: 1, crit: false };
      const amount = hit.amount * mod.mult;
      ctx.emit({ type: 'attack', fromX: from.x, fromY: from.y, toX: t.x, toY: t.y, ranged, element: m.def.element });
      ctx.dealDamage(t, amount, { element: m.def.element, monster: m }, mod.crit ? 'crit' : hit.effect);
      skill.onHit?.(m, t, amount, ctx);
    }
    m.cooldown += 1 / m.def.atkSpeed;
  }
}

export function recover(ctx: CombatCtx, m: MonsterUnit): void {
  m.koTimer = 0;
  m.hp = m.maxHp * ctx.cfg.knockoutReturnHpPct;
  ctx.emit({ type: 'recover', uid: m.uid });
}

export function updateMinions(ctx: CombatCtx, dt: number): void {
  const { state } = ctx;
  // 주인(꿀벌여왕)이 합성으로 사라지거나 기절하면 꿀벌도 사라진다
  const owners = new Map(unitsOnBoard(state.board).filter((m) => !isKnockedOut(m)).map((m) => [m.uid, m]));
  state.minions = state.minions.filter((n) => owners.has(n.ownerUid));
  for (const n of state.minions) {
    n.life -= dt;
    n.cooldown -= dt;
    if (n.cooldown > 0) continue;
    const t = targetsInLane(state, n.lane, true, ctx.cfg)[0];
    if (!t) {
      n.cooldown = 0;
      continue;
    }
    const mult = getMultiplier('grass', t.element, ctx.data.elements);
    ctx.emit({ type: 'attack', fromX: n.x, fromY: n.y, toX: t.x, toY: t.y, ranged: true, element: 'grass' });
    ctx.dealDamage(t, n.atk * (1 + state.elementBuff.grass) * mult, { element: 'grass' }, mult > 1 ? 'adv' : mult < 1 ? 'dis' : 'neutral');
    n.cooldown += 1 / n.atkSpeed;
  }
  state.minions = state.minions.filter((n) => n.life > 0);
}

export function updateEnemies(ctx: CombatCtx, dt: number): void {
  for (const e of [...ctx.state.enemies]) {
    if (e.dead) continue;
    tickStatuses(ctx, e, dt);
    if (e.dead) continue;
    tickHealer(ctx, e, dt);
    if (isBoss(e)) tickBoss(ctx, e, dt);
    if (e.stun > 0) {
      e.stun -= dt;
      continue;
    }
    const slow = Math.min(ctx.cfg.combat.maxSlowPct, Math.max(e.slow.t > 0 ? e.slow.pct : 0, e.auraSlow));
    const speed = e.def.speed * (1 - slow);
    moveTowardLane(ctx, e, speed * ctx.cfg.combat.pullSpeedFactor * dt);
    if (e.blocked) tickBlocked(ctx, e, dt);
    else tickWalking(ctx, e, speed * dt);
  }
}

function tickStatuses(ctx: CombatCtx, e: EnemyUnit, dt: number): void {
  const dot = (e.burn.t > 0 ? e.burn.dps : 0) + (e.poison.t > 0 ? e.poison.dps : 0);
  if (dot > 0) ctx.dealDamage(e, dot * dt, { element: 'none' }, 'silent');
  for (const s of [e.slow, e.burn, e.poison]) {
    if (s.t <= 0) continue;
    s.t -= dt;
    if (s.t <= 0) {
      s.t = 0;
      s.pct = 0;
      s.dps = 0;
    }
  }
}

function tickHealer(ctx: CombatCtx, e: EnemyUnit, dt: number): void {
  const { healAmount, healRadius, healIntervalSec } = e.def;
  if (!e.def.flags.includes('healer') || !healAmount || !healRadius || !healIntervalSec) return;
  e.healTimer += dt;
  if (e.healTimer < healIntervalSec) return;
  e.healTimer -= healIntervalSec;
  ctx.emit({ type: 'enemyHeal', x: e.x, y: e.y, radius: healRadius });
  for (const o of ctx.state.enemies) {
    if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) <= healRadius) o.hp = Math.min(o.maxHp, o.hp + healAmount);
  }
}

function tickBoss(ctx: CombatCtx, e: EnemyUnit, dt: number): void {
  const boss = e.def.boss;
  if (!boss) return;
  e.bossTimer += dt;
  if (e.bossTimer >= boss.cycleSec) {
    e.bossTimer -= boss.cycleSec;
    e.bossCycleIdx = (e.bossCycleIdx + 1) % boss.elementCycle.length;
    e.element = boss.elementCycle[e.bossCycleIdx];
    ctx.emit({ type: 'bossElement', element: e.element });
  }
  if (!e.bossSummoned && e.hp <= e.maxHp * boss.summonAtHpPct) {
    e.bossSummoned = true;
    for (let i = 0; i < boss.summonCount; i++) {
      ctx.spawnEnemy(boss.summonId, i % ctx.cfg.board.cols, { y: Math.max(ctx.cfg.layout.spawnY, e.y - ctx.cfg.layout.enemyRadius * (2 + Math.floor(i / ctx.cfg.board.cols))) });
    }
    ctx.emit({ type: 'bossSummon' });
  }
}

function moveTowardLane(ctx: CombatCtx, e: EnemyUnit, maxStep: number): void {
  const target = laneX(e.lane, ctx.cfg);
  const d = target - e.x;
  e.x = Math.abs(d) <= maxStep ? target : e.x + Math.sign(d) * maxStep;
}

/** 진흙거인: 옆 레인 앞줄이 비었으면 그 레인 적을 자기 레인으로 끌어와 막는다 */
function tryTaunt(ctx: CombatCtx, e: EnemyUnit): void {
  if (e.flying || frontBlocker(ctx.state.board, e.lane, ctx.cfg)) return;
  for (const lane of [e.lane - 1, e.lane + 1]) {
    const m = frontBlocker(ctx.state.board, lane, ctx.cfg);
    if (m && hasSkill(m, 'taunt_adjacent_lanes')) {
      ctx.emit({ type: 'skill', skill: 'taunt_adjacent_lanes', x: e.x, y: e.y, toX: laneX(lane, ctx.cfg), toY: e.y });
      e.lane = lane;
      return;
    }
  }
}

function tickWalking(ctx: CombatCtx, e: EnemyUnit, step: number): void {
  const stopY = enemyStopY(ctx.cfg);
  e.y += step;
  if (e.y >= ctx.cfg.layout.boardTop - ctx.cfg.board.meleeReachPx) tryTaunt(ctx, e);
  if (e.y < stopY) return;
  e.y = stopY;
  if (!e.flying && frontBlocker(ctx.state.board, e.lane, ctx.cfg)) {
    e.blocked = true;
    e.cooldown = Math.min(e.cooldown, 0);
    return;
  }
  reachBase(ctx, e);
}

function tickBlocked(ctx: CombatCtx, e: EnemyUnit, dt: number): void {
  const blocker = frontBlocker(ctx.state.board, e.lane, ctx.cfg);
  if (!blocker) {
    e.blocked = false;
    return;
  }
  e.cooldown -= dt;
  if (e.def.atkSpeed <= 0 || e.cooldown > 0) return;
  e.cooldown += 1 / e.def.atkSpeed;
  const mult = getMultiplier(e.element, blocker.def.element, ctx.data.elements);
  const to = cellCenter(blocker.cell, ctx.cfg);
  ctx.emit({ type: 'attack', fromX: e.x, fromY: e.y, toX: to.x, toY: to.y, ranged: false, element: e.element });
  ctx.damageMonster(blocker, e.def.atk * mult, e);
}

function reachBase(ctx: CombatCtx, e: EnemyUnit): void {
  e.dead = true;
  ctx.state.baseHp = Math.max(0, ctx.state.baseHp - e.def.baseDamage);
  ctx.emit({ type: 'baseHit', amount: e.def.baseDamage, x: e.x });
}
