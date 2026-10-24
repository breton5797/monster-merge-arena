import type { Battle } from './Battle';
import { resolve } from './MergeSystem';
import { cellCol, cellIndex, cellRow } from './layout';
import { pickOne, randInt, type Rng } from './rng';

// 무작위 합성 봇 (밸런스 시뮬레이션 + ?debug=1&bot=1 자동 플레이용)

export interface BotOptions {
  /** 판단 1회당 합성을 시도할 확률 */
  readonly mergeChance: number;
  /** 판단 간격(초) */
  readonly decisionSec: number;
}

export const DEFAULT_BOT: BotOptions = { mergeChance: 0.6, decisionSec: 0.5 };

export class RandomBot {
  private timer = 0;

  constructor(private readonly rng: Rng, private readonly opts: BotOptions = DEFAULT_BOT) {}

  /** 매 프레임 호출. 판단 시점이면 행동 */
  update(b: Battle, dt: number): void {
    if (b.state.awaitingPick) {
      b.choosePick(randInt(this.rng, b.state.currentPick.length));
      return;
    }
    this.timer += dt;
    if (this.timer < this.opts.decisionSec) return;
    this.timer -= this.opts.decisionSec;
    this.act(b);
  }

  act(b: Battle): void {
    if (b.canSummon()) b.summon();
    if (this.rng.next() < this.opts.mergeChance) this.tryRandomMerge(b);
    this.advanceMelee(b);
  }

  private tryRandomMerge(b: Battle): void {
    const { board } = b.state;
    const pairs: [number, number][] = [];
    board.forEach((x, i) =>
      board.forEach((y, j) => {
        if (x && y && i !== j && resolve(x, y, b.data).kind !== 'invalid') pairs.push([i, j]);
      }),
    );
    if (pairs.length === 0) return;
    const [from, to] = pickOne(this.rng, pairs);
    b.dragDrop(from, to);
  }

  /** 뒷줄 근접 몬스터는 앞줄이 비어 있으면 올린다 (최소한의 배치 상식) */
  private advanceMelee(b: Battle): void {
    const cfg = b.cfg;
    b.state.board.forEach((m, cell) => {
      if (!m || m.def.range !== 'melee' || cellRow(cell, cfg) === 0) return;
      const front = cellIndex(cellCol(cell, cfg), 0, cfg);
      if (!b.state.board[front]) b.dragDrop(cell, front);
    });
  }
}
