import { Analytics } from './Analytics';
import { NoopAdService, type AdService } from './AdService';
import { Haptics } from './Haptics';
import { SaveService, type KeyValueStore } from './SaveService';
import { SoundService } from './SoundService';
import { NoopStoreService, type StoreService } from './StoreService';

export interface Services {
  readonly save: SaveService;
  readonly analytics: Analytics;
  readonly sound: SoundService;
  readonly haptics: Haptics;
  readonly ads: AdService;
  readonly store: StoreService;
  readonly debug: boolean;
  /** 이번 세션에서 시작한 판 수 (run_start.runIndex) */
  runIndex: number;
}

/** localStorage 접근 불가(프라이빗 모드 등)면 메모리 저장소로 대체 */
function safeStorage(): KeyValueStore {
  try {
    const probe = '__mma_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}

export function createServices(debug: boolean): Services {
  const storage = safeStorage();
  const save = new SaveService(storage);
  const sound = new SoundService();
  const haptics = new Haptics();
  sound.enabled = save.data.settings.sound;
  haptics.enabled = save.data.settings.vibration;
  sound.music.enabled = save.data.settings.music;
  return { save, analytics: new Analytics(storage), sound, haptics, ads: new NoopAdService(), store: new NoopStoreService(), debug, runIndex: 0 };
}
