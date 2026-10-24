import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/gameData';
import { Battle } from '../src/systems/Battle';
import { RandomBot } from '../src/systems/Bot';
import { createRng } from '../src/systems/rng';

const data = loadGameData();

describe('RandomBot', () => {
  it('한 판을 끝까지 진행한다 (소환·합성·3택 선택)', () => {
    const b = new Battle(data, { stageId: 1, rng: createRng(5), discovered: [], hints: {} });
    const bot = new RandomBot(createRng(6));
    while (!b.state.result && b.state.time < 300) {
      bot.update(b, 0.05);
      b.update(0.05);
    }
    expect(b.state.result).not.toBeNull();
    expect(b.state.summonCount).toBeGreaterThan(0);
    expect(b.state.mergesTotal).toBeGreaterThan(0);
    expect(b.state.picksShown).toBeGreaterThan(0);
  });

  it('뒷줄 근접 몬스터를 빈 앞줄로 올린다', () => {
    const b = new Battle(data, { stageId: 1, rng: createRng(1), discovered: [], hints: {}, startingMonsters: 0, noWaves: true });
    b.placeMonster('gravel_golem', 1, 4);
    new RandomBot(createRng(1), { mergeChance: 0, decisionSec: 0.5 }).act(b);
    expect(b.state.board[0]?.defId).toBe('gravel_golem');
  });

  it('같은 시드 → 같은 결과 (시뮬레이션 재현성)', () => {
    const play = () => {
      const b = new Battle(data, { stageId: 2, rng: createRng(9), discovered: [], hints: {} });
      const bot = new RandomBot(createRng(10));
      while (!b.state.result && b.state.time < 300) {
        bot.update(b, 0.05);
        b.update(0.05);
      }
      return [b.state.result, b.state.kills, Math.round(b.state.time)];
    };
    expect(play()).toEqual(play());
  });
});
