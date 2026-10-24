import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/gameData';
import { buildSchedule } from '../src/systems/WaveSystem';

const data = loadGameData();

describe('WaveSystem.buildSchedule', () => {
  it('atSec부터 durationSec 동안 everySec 간격, 시간순 정렬', () => {
    const s = buildSchedule({ ...data.stages[0], waves: [{ atSec: 10, durationSec: 10, enemyId: 'goo', everySec: 2.5, count: 2, hpScale: 1 }] });
    expect(s.map((e) => e.time)).toEqual([10, 12.5, 15, 17.5]);
    expect(s.every((e) => e.count === 2)).toBe(true);
  });
  it('스테이지 3 보스는 150초에 정확히 1번, center 레인', () => {
    const s = buildSchedule(data.stages[2]).filter((e) => e.enemyId === 'king_chimera');
    expect(s).toEqual([{ time: 150, enemyId: 'king_chimera', count: 1, hpScale: 1, lane: 'center' }]);
  });
  it('모든 스테이지 스폰은 시간순', () => {
    for (const st of data.stages) {
      const s = buildSchedule(st);
      for (let i = 1; i < s.length; i++) expect(s[i].time).toBeGreaterThanOrEqual(s[i - 1].time);
    }
  });
});
