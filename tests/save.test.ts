import { describe, expect, it } from 'vitest';
import { SaveService, SAVE_VERSION, type KeyValueStore } from '../src/services/SaveService';

function memStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

describe('SaveService', () => {
  it('저장이 없으면 기본값 (스테이지 1만 해금)', () => {
    const s = new SaveService(memStore());
    expect(s.data).toMatchObject({ version: SAVE_VERSION, discovered: [], hints: {}, unlockedStages: 1, bestTime: {} });
    expect(s.data.settings).toEqual({ sound: true, vibration: true, music: true });
  });

  it('파싱 실패 시 초기화', () => {
    const s = new SaveService(memStore({ mma_save: '{not json' }));
    expect(s.data.unlockedStages).toBe(1);
  });

  it('다른 버전/잘못된 필드는 초기화·보정', () => {
    expect(new SaveService(memStore({ mma_save: JSON.stringify({ version: 999, unlockedStages: 3 }) })).data.unlockedStages).toBe(1);
    const s = new SaveService(memStore({ mma_save: JSON.stringify({ version: SAVE_VERSION, discovered: 'x', unlockedStages: 2, hints: { a: 1, b: 'ember_pup' } }) }));
    expect(s.data.discovered).toEqual([]);
    expect(s.data.unlockedStages).toBe(2);
    expect(s.data.hints).toEqual({ b: 'ember_pup' });
  });

  it('새로고침(새 인스턴스) 후에도 도감·해금·힌트·기록 유지', () => {
    const store = memStore();
    const a = new SaveService(store);
    a.addDiscoveries(['ember_pup', 'steam_spirit', 'ember_pup']);
    a.setHint('steam_spirit', 'ember_pup');
    a.recordRun(1, 'win', 180);
    a.recordRun(1, 'lose', 200);
    const b = new SaveService(store);
    expect(b.data.discovered).toEqual(['ember_pup', 'steam_spirit']);
    expect(b.data.hints).toEqual({ steam_spirit: 'ember_pup' });
    expect(b.data.unlockedStages).toBe(2);
    expect(b.data.bestTime[1]).toBe(200);
  });

  it('패배는 해금하지 않고, 해금은 maxStage를 넘지 않음', () => {
    const s = new SaveService(memStore());
    s.recordRun(1, 'lose', 50);
    expect(s.data.unlockedStages).toBe(1);
    s.recordRun(1, 'win', 180, 3);
    s.recordRun(2, 'win', 180, 3);
    s.recordRun(3, 'win', 190, 3);
    expect(s.data.unlockedStages).toBe(3);
  });

  it('스토리지 쓰기 실패해도 게임은 계속 (예외 삼키지 않고 메모리 상태 유지)', () => {
    const store = memStore();
    store.setItem = () => { throw new Error('quota'); };
    const s = new SaveService(store);
    expect(() => s.addDiscoveries(['ember_pup'])).not.toThrow();
    expect(s.data.discovered).toEqual(['ember_pup']);
    expect(s.lastError).toContain('quota');
  });

  it('설정·튜토리얼·세션 수 저장', () => {
    const store = memStore();
    const s = new SaveService(store);
    s.updateSettings({ sound: false });
    s.markTutorialDone();
    expect(s.startSession()).toBe(true);
    const t = new SaveService(store);
    expect(t.data.settings).toEqual({ sound: false, vibration: true, music: true });
    expect(t.data.tutorialDone).toBe(true);
    expect(t.startSession()).toBe(false);
  });
});

describe('SaveService v2 (★·오늘의 도전·음악)', () => {
  it('스테이지 ★는 최고 기록만 유지', () => {
    const store = memStore();
    const s = new SaveService(store);
    s.recordRun(1, 'win', 180, 6, 2);
    s.recordRun(1, 'win', 180, 6, 1);
    s.recordRun(1, 'lose', 90, 6, 0);
    expect(new SaveService(store).data.stars[1]).toBe(2);
    s.recordRun(1, 'win', 180, 6, 3);
    expect(new SaveService(store).data.stars[1]).toBe(3);
  });

  it('오늘의 도전: 같은 날은 최고 기록 유지, 날짜가 바뀌면 새 기록', () => {
    const store = memStore();
    const s = new SaveService(store);
    s.recordDaily(20261024, 3, 'lose', 120, 0);
    s.recordDaily(20261024, 3, 'win', 180, 2);
    s.recordDaily(20261024, 3, 'lose', 60, 0);
    expect(new SaveService(store).data.daily).toEqual({ seed: 20261024, stageId: 3, plays: 3, bestStars: 2, bestTime: 180 });
    s.recordDaily(20261025, 1, 'lose', 30, 0);
    expect(s.data.daily).toEqual({ seed: 20261025, stageId: 1, plays: 1, bestStars: 0, bestTime: 30 });
  });

  it('음악 설정 기본값 ON, 이전 버전 저장(음악 필드 없음)도 그대로 읽는다', () => {
    const old = memStore({ mma_save: JSON.stringify({ version: SAVE_VERSION, discovered: ['ember_pup'], unlockedStages: 2, settings: { sound: false, vibration: true } }) });
    const s = new SaveService(old);
    expect(s.data.settings).toEqual({ sound: false, vibration: true, music: true });
    expect(s.data.discovered).toEqual(['ember_pup']);
    expect(s.data.stars).toEqual({});
    expect(s.data.daily).toBeNull();
  });

  it('잘못된 ★/도전 데이터는 버린다', () => {
    const s = new SaveService(memStore({ mma_save: JSON.stringify({ version: SAVE_VERSION, stars: { 1: 9, 2: 'x', 3: 2 }, daily: { seed: 'a', stageId: 1 } }) }));
    expect(s.data.stars).toEqual({ 3: 2 });
    expect(s.data.daily).toBeNull();
  });
});

describe('SaveService 오늘의 도전 정제', () => {
  it('범위 밖 bestStars·plays는 보정, stageId 유지', () => {
    const s = new SaveService(memStore({ mma_save: JSON.stringify({ version: SAVE_VERSION, daily: { seed: 20261024, stageId: 2, plays: -3, bestStars: -1, bestTime: 50 } }) }));
    expect(s.data.daily).toEqual({ seed: 20261024, stageId: 2, plays: 0, bestStars: 0, bestTime: 50 });
    const t = new SaveService(memStore({ mma_save: JSON.stringify({ version: SAVE_VERSION, daily: { seed: 20261024, stageId: 2, plays: 1, bestStars: 9, bestTime: 50 } }) }));
    expect(t.data.daily?.bestStars).toBe(3);
  });
});
