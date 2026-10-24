import { isKnockedOut, type MonsterUnit } from '../entities/Monster';
import type { GameConfig } from '../types';
import { cellCol, cellIndex, cellRow } from './layout';
import { pickOne, type Rng } from './rng';

// 8칸 보드 규칙 (배치 우선순위, 레인 방어자). 드래그 입력은 views/BoardView가 담당.

export type Board = readonly (MonsterUnit | null)[];

export function emptyCells(board: Board): number[] {
  return board.flatMap((m, i) => (m === null ? [i] : []));
}

/** 빈칸 선택: 앞줄 우선, 그중 몬스터가 하나도 없는 레인 우선. 없으면 -1 */
export function preferredEmptyCell(board: Board, cfg: GameConfig, rng: Rng): number {
  const empty = emptyCells(board);
  if (empty.length === 0) return -1;
  const front = empty.filter((c) => cellRow(c, cfg) === 0);
  if (front.length > 0) {
    const laneEmpty = (c: number) => Array.from({ length: cfg.board.rows }, (_, r) => board[cellIndex(cellCol(c, cfg), r, cfg)]).every((m) => m === null);
    const open = front.filter(laneEmpty);
    return pickOne(rng, open.length > 0 ? open : front);
  }
  return pickOne(rng, empty);
}

/** 레인 앞줄에서 적을 막는 몬스터 (기절 중이면 막지 못함) */
export function frontBlocker(board: Board, lane: number, cfg: GameConfig): MonsterUnit | null {
  const m = board[cellIndex(lane, 0, cfg)];
  return m && !isKnockedOut(m) ? m : null;
}

export function unitsOnBoard(board: Board): MonsterUnit[] {
  return board.filter((m): m is MonsterUnit => m !== null);
}
