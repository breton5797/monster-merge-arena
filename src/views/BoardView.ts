import Phaser from 'phaser';
import type { MonsterUnit } from '../entities/Monster';
import type { Battle } from '../systems/Battle';
import { cellAt, cellCenter, rowHeight, boardLeft } from '../systems/layout';
import { resolve } from '../systems/MergeSystem';
import type { GameData } from '../types';
import { textStyle } from '../ui/theme';
import { MonsterView } from './MonsterView';

export type DropFeedback = 'none' | 'move' | 'merge' | 'invalid';

export interface BoardHandlers {
  onDrop(from: number, to: number): DropFeedback;
  onDragStart(): void;
}

/** 4×2 보드 그리기 + 몬스터 뷰 동기화 + 드래그&드롭 */
export class BoardView {
  private readonly views = new Map<number, MonsterView>();
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly cellW: number;
  private readonly rowH: number;

  constructor(private readonly scene: Phaser.Scene, private readonly battle: Battle, private readonly data: GameData, private readonly handlers: BoardHandlers) {
    const cfg = data.config;
    this.cellW = cfg.board.cellSize;
    this.rowH = rowHeight(cfg);
    this.drawGrid();
    this.highlight = scene.add.graphics().setDepth(9);
  }

  private drawGrid(): void {
    const cfg = this.data.config;
    const g = this.scene.add.graphics().setDepth(1);
    const left = boardLeft(cfg);
    const w = this.cellW * cfg.board.cols;
    g.fillStyle(0x000000, 0.35).fillRect(0, cfg.layout.boardTop, cfg.screen.width, cfg.layout.boardBottom - cfg.layout.boardTop);
    for (let r = 0; r < cfg.board.rows; r++) {
      for (let c = 0; c < cfg.board.cols; c++) {
        const x = left + c * this.cellW;
        const y = cfg.layout.boardTop + r * this.rowH;
        g.fillStyle(r === 0 ? 0x2d3a4a : 0x222a35, 1).fillRoundedRect(x + 4, y + 4, this.cellW - 8, this.rowH - 8, 14);
      }
    }
    g.lineStyle(4, 0xffb703, 0.7).lineBetween(left, cfg.layout.boardTop, left + w, cfg.layout.boardTop);
    this.scene.add.text(left / 2, cfg.layout.boardTop + this.rowH / 2, '앞\n줄', textStyle(18, '#9AA3B2', { align: 'center' })).setOrigin(0.5).setDepth(1);
    this.scene.add.text(left / 2, cfg.layout.boardTop + this.rowH * 1.5, '뒷\n줄', textStyle(18, '#6B7280', { align: 'center' })).setOrigin(0.5).setDepth(1);
  }

  viewOf(uid: number): MonsterView | undefined {
    return this.views.get(uid);
  }

  /** 모델 보드와 뷰를 맞춘다. 새로 생긴 몬스터 목록 반환 (연출용) */
  sync(): MonsterUnit[] {
    const alive = new Set<number>();
    const created: MonsterUnit[] = [];
    for (const unit of this.battle.state.board) {
      if (!unit) continue;
      alive.add(unit.uid);
      let v = this.views.get(unit.uid);
      if (!v) {
        v = this.createView(unit);
        created.push(unit);
      }
      if (v.cell !== unit.cell && !v.dragging) {
        v.cell = unit.cell;
        const p = cellCenter(unit.cell, this.data.config);
        this.scene.tweens.add({ targets: v, x: p.x, y: p.y, duration: 120 });
      }
      v.sync();
    }
    for (const [uid, v] of this.views) {
      if (!alive.has(uid)) {
        v.destroy();
        this.views.delete(uid);
      }
    }
    return created;
  }

  private createView(unit: MonsterUnit): MonsterView {
    const cfg = this.data.config;
    const hitW = Math.max(cfg.board.minTouchPx, this.cellW - 6);
    const hitH = Math.max(cfg.board.minTouchPx, this.rowH - 6);
    const v = new MonsterView(this.scene, unit, this.data, hitW, hitH);
    const p = cellCenter(unit.cell, cfg);
    v.setPosition(p.x, p.y).setDepth(10);
    v.punch();
    v.on('dragstart', () => {
      v.dragging = true;
      v.setDepth(50).setScale(1.12);
      this.handlers.onDragStart();
    });
    v.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => {
      v.setPosition(x, y);
      this.drawHover(unit, cellAt(x, y, cfg));
    });
    v.on('dragend', () => {
      const to = cellAt(v.x, v.y, cfg);
      this.endDrag(v);
      const fb = to < 0 ? 'none' : this.handlers.onDrop(unit.cell, to);
      if (fb === 'none' || fb === 'invalid') this.snapBack(v, fb === 'invalid');
    });
    this.views.set(unit.uid, v);
    return v;
  }

  private endDrag(v: MonsterView): void {
    v.dragging = false;
    v.setDepth(10).setScale(1);
    this.highlight.clear();
  }

  private snapBack(v: MonsterView, shake: boolean): void {
    const p = cellCenter(v.unit.cell, this.data.config);
    this.scene.tweens.add({ targets: v, x: p.x, y: p.y, duration: 140, ease: 'Quad.Out', onComplete: () => shake && v.shake() });
  }

  /** 드롭 대상 칸 표시: 빈칸 흰색, 합성 가능 초록, 불가 빨강 */
  private drawHover(unit: MonsterUnit, cell: number): void {
    this.highlight.clear();
    if (cell < 0 || cell === unit.cell) return;
    const other = this.battle.state.board[cell];
    const color = !other ? 0xffffff : resolve(unit, other, this.data).kind === 'invalid' ? 0xe53935 : 0x4caf50;
    const p = cellCenter(cell, this.data.config);
    this.highlight.lineStyle(6, color, 0.95).strokeRoundedRect(p.x - this.cellW / 2 + 4, p.y - this.rowH / 2 + 4, this.cellW - 8, this.rowH - 8, 14);
  }

  /** 3택 등으로 화면이 멈출 때 드래그 중인 몬스터를 제자리로 */
  cancelDrags(): void {
    for (const v of this.views.values()) {
      if (!v.dragging) continue;
      this.endDrag(v);
      this.snapBack(v, false);
    }
  }

  /** 튜토리얼용: 합성 가능한 두 칸(가능하면 같은 종) */
  suggestMergePair(): [number, number] | null {
    const b = this.battle.state.board;
    let fallback: [number, number] | null = null;
    for (let i = 0; i < b.length; i++) {
      for (let j = 0; j < b.length; j++) {
        const x = b[i];
        const y = b[j];
        if (!x || !y || i === j) continue;
        const r = resolve(x, y, this.data).kind;
        if (r === 'recipe') return [i, j];
        if (r !== 'invalid' && !fallback) fallback = [i, j];
      }
    }
    return fallback;
  }
}
