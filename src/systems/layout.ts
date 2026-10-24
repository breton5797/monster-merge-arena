import type { GameConfig } from '../types';

// 보드·레인 좌표 계산. 보드 각 열 = 레인 1개, 행 0 = 앞줄, 행 1 = 뒷줄.

export function boardLeft(cfg: GameConfig): number {
  return (cfg.screen.width - cfg.board.cols * cfg.board.cellSize) / 2;
}

export function rowHeight(cfg: GameConfig): number {
  return (cfg.layout.boardBottom - cfg.layout.boardTop) / cfg.board.rows;
}

export function laneX(lane: number, cfg: GameConfig): number {
  return boardLeft(cfg) + cfg.board.cellSize * (lane + 0.5);
}

export function cellIndex(col: number, row: number, cfg: GameConfig): number {
  return row * cfg.board.cols + col;
}

export function cellCol(cell: number, cfg: GameConfig): number {
  return cell % cfg.board.cols;
}

export function cellRow(cell: number, cfg: GameConfig): number {
  return Math.floor(cell / cfg.board.cols);
}

export function isFrontRow(cell: number, cfg: GameConfig): boolean {
  return cellRow(cell, cfg) === 0;
}

export function cellCenter(cell: number, cfg: GameConfig): { x: number; y: number } {
  return { x: laneX(cellCol(cell, cfg), cfg), y: cfg.layout.boardTop + rowHeight(cfg) * (cellRow(cell, cfg) + 0.5) };
}

/** 화면 좌표 → 칸 번호. 보드 밖이면 -1 */
export function cellAt(x: number, y: number, cfg: GameConfig): number {
  const col = Math.floor((x - boardLeft(cfg)) / cfg.board.cellSize);
  const row = Math.floor((y - cfg.layout.boardTop) / rowHeight(cfg));
  if (col < 0 || col >= cfg.board.cols || row < 0 || row >= cfg.board.rows) return -1;
  return cellIndex(col, row, cfg);
}

/** 상하좌우 인접 칸 */
export function adjacentCells(cell: number, cfg: GameConfig): number[] {
  const col = cellCol(cell, cfg);
  const row = cellRow(cell, cfg);
  const out: number[] = [];
  if (col > 0) out.push(cellIndex(col - 1, row, cfg));
  if (col < cfg.board.cols - 1) out.push(cellIndex(col + 1, row, cfg));
  if (row > 0) out.push(cellIndex(col, row - 1, cfg));
  if (row < cfg.board.rows - 1) out.push(cellIndex(col, row + 1, cfg));
  return out;
}

/** 적이 멈추는 경계선 y (적 중심 기준) */
export function enemyStopY(cfg: GameConfig): number {
  return cfg.layout.boardTop - cfg.layout.enemyRadius;
}
