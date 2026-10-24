import { isKnockedOut, skillParam, starScale } from '../../entities/Monster';
import { unitsOnBoard } from '../BoardSystem';
import { adjacentCells, cellCenter, cellRow, laneX } from '../layout';
import { randInt } from '../rng';
import { every, type SkillHandler } from './types';

// 주기 지원 스킬: 옆 칸 회복, 전체 회복, 행 보호막, 꿀벌 소환

export const healAdjacent: SkillHandler = {
  onTick(m, dt, ctx) {
    every(m, dt, skillParam(m, 'intervalSec'), () => {
      const amount = skillParam(m, 'amount') * starScale(m.star, ctx.cfg);
      for (const c of adjacentCells(m.cell, ctx.cfg)) {
        const t = ctx.state.board[c];
        if (t && !isKnockedOut(t)) ctx.healMonster(t, amount);
      }
    });
  },
};

export const healAll: SkillHandler = {
  onTick(m, dt, ctx) {
    every(m, dt, skillParam(m, 'intervalSec'), () => {
      const amount = skillParam(m, 'amount') * starScale(m.star, ctx.cfg);
      const { x, y } = cellCenter(m.cell, ctx.cfg);
      ctx.emit({ type: 'skill', skill: 'heal_all', x, y });
      for (const t of unitsOnBoard(ctx.state.board)) if (!isKnockedOut(t)) ctx.healMonster(t, amount);
    });
  },
};

export const rowShield: SkillHandler = {
  onTick(m, dt, ctx) {
    every(m, dt, skillParam(m, 'intervalSec'), () => {
      const amount = skillParam(m, 'amount') * starScale(m.star, ctx.cfg);
      const row = cellRow(m.cell, ctx.cfg);
      const { x, y } = cellCenter(m.cell, ctx.cfg);
      ctx.emit({ type: 'skill', skill: 'row_shield', x, y });
      for (const t of unitsOnBoard(ctx.state.board)) {
        if (cellRow(t.cell, ctx.cfg) === row && !isKnockedOut(t)) t.shield = Math.max(t.shield, amount);
      }
    });
  },
};

export const summonMinion: SkillHandler = {
  onTick(m, dt, ctx) {
    every(m, dt, skillParam(m, 'intervalSec'), () => {
      const owned = ctx.state.minions.filter((n) => n.ownerUid === m.uid).length;
      if (owned >= skillParam(m, 'max')) return;
      const lane = randInt(ctx.rng, ctx.cfg.board.cols);
      const from = cellCenter(m.cell, ctx.cfg);
      const { minionOffsetX, minionBaseY, minionStepY, boardTop } = ctx.cfg.layout;
      const x = laneX(lane, ctx.cfg) + (owned % 2 === 0 ? -minionOffsetX : minionOffsetX);
      const y = boardTop - minionBaseY - owned * minionStepY;
      const atk = skillParam(m, 'minionAtk') * starScale(m.star, ctx.cfg);
      ctx.state.minions.push({ uid: ctx.nextUid(), ownerUid: m.uid, lane, atk, atkSpeed: skillParam(m, 'minionAtkSpeed'), x, y, cooldown: 0, life: skillParam(m, 'lifeSec') });
      ctx.emit({ type: 'skill', skill: 'summon_minion', x: from.x, y: from.y, toX: x, toY: y });
    });
  },
};
