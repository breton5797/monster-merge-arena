import type { StageDef } from '../types';

// stages.json 웨이브 타임라인 → 시간순 스폰 목록 (순수 함수)

export interface SpawnEntry {
  readonly time: number;
  readonly enemyId: string;
  readonly count: number;
  readonly hpScale: number;
  readonly lane?: 'center' | number;
}

const EPS = 1e-6;

export function buildSchedule(stage: StageDef): SpawnEntry[] {
  const out: SpawnEntry[] = [];
  for (const w of stage.waves) {
    for (let t = w.atSec; t < w.atSec + w.durationSec - EPS; t += w.everySec) {
      out.push({ time: t, enemyId: w.enemyId, count: w.count, hpScale: w.hpScale, lane: w.lane });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}
