import { describe, expect, it } from 'vitest';
import { Analytics, summarize } from '../src/services/Analytics';
import type { KeyValueStore } from '../src/services/SaveService';

const mem = (): KeyValueStore => {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; } };
};

describe('Analytics', () => {
  it('이벤트를 큐에 저장하고 새 인스턴스에서도 유지', () => {
    const store = mem();
    const a = new Analytics(store);
    a.track('run_start', { stageId: 1, runIndex: 1 });
    a.track('run_end', { stageId: 1, result: 'win', timeSec: 180 });
    const b = new Analytics(store);
    expect(b.queue).toHaveLength(2);
    expect(b.sessionEvents()).toHaveLength(0);
  });

  it('summarize: 판 수, 승리, 발견, 평균 생존 시간', () => {
    const a = new Analytics(mem());
    a.track('run_end', { result: 'win', timeSec: 180 });
    a.track('run_end', { result: 'lose', timeSec: 90 });
    a.track('discovery', { monsterId: 'steam_spirit' });
    a.track('codex_open', { from: 'menu' });
    expect(summarize(a.sessionEvents())).toEqual({ runs: 2, wins: 1, discoveries: 1, avgSurvivalSec: 135, codexOpens: 1 });
    const log = JSON.parse(a.exportLog());
    expect(log.summary.runs).toBe(2);
    expect(log.events).toHaveLength(4);
  });

  it('리스너 등록/해제', () => {
    const a = new Analytics(mem());
    const got: string[] = [];
    const off = a.onEvent((e) => got.push(e.name));
    a.track('summon');
    off();
    a.track('summon');
    expect(got).toEqual(['summon']);
  });

  it('깨진 큐는 무시', () => {
    const store = mem();
    store.setItem('mma_analytics', 'garbage');
    expect(new Analytics(store).queue).toEqual([]);
  });

  it('중도 포기(quit)는 평균 생존 시간 계산에서 제외', () => {
    const a = new Analytics(mem());
    a.track('run_end', { result: 'win', timeSec: 180 });
    a.track('run_end', { result: 'lose', quit: true, timeSec: 5 });
    expect(summarize(a.sessionEvents())).toMatchObject({ runs: 2, avgSurvivalSec: 180 });
  });
});

