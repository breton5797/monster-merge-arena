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
    expect(s.data.settings).toEqual({ sound: true, vibration: true });
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
    expect(t.data.settings).toEqual({ sound: false, vibration: true });
    expect(t.data.tutorialDone).toBe(true);
    expect(t.startSession()).toBe(false);
  });
});
