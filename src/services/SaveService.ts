// localStorage 저장 (GAME_DESIGN.md §11). 게임 코드는 이 서비스로만 저장소에 접근한다.
// Arcade Core 분리 후보: 저장 형식만 게임별로 바꾸면 재사용 가능.

export const SAVE_VERSION = 1;
const SAVE_KEY = 'mma_save';

export interface SaveSettings {
  readonly sound: boolean;
  readonly vibration: boolean;
  readonly music: boolean;
}

/** 오늘의 도전 기록 (seed = YYYYMMDD) */
export interface DailyRecord {
  readonly seed: number;
  readonly stageId: number;
  readonly plays: number;
  readonly bestStars: number;
  readonly bestTime: number;
}

export interface SaveData {
  readonly version: number;
  readonly discovered: readonly string[];
  readonly hints: Readonly<Record<string, string>>;
  readonly unlockedStages: number;
  readonly bestTime: Readonly<Record<number, number>>;
  readonly settings: SaveSettings;
  /** §11 확장: 첫 판 튜토리얼 표시 여부, 세션 수(분석 isFirstSession용) */
  readonly tutorialDone: boolean;
  readonly sessions: number;
  /** 스테이지별 최고 ★ (0~3) */
  readonly stars: Readonly<Record<number, number>>;
  readonly daily: DailyRecord | null;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaults(): SaveData {
  return { version: SAVE_VERSION, discovered: [], hints: {}, unlockedStages: 1, bestTime: {}, settings: { sound: true, vibration: true, music: true }, tutorialDone: false, sessions: 0, stars: {}, daily: null };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 외부 입력(저장소 문자열)을 검증해 SaveData로 복원. 잘못된 필드는 기본값으로 */
function sanitize(raw: unknown): SaveData {
  const d = defaults();
  if (!isRecord(raw) || raw.version !== SAVE_VERSION) return d;
  const discovered = Array.isArray(raw.discovered) ? raw.discovered.filter((x): x is string => typeof x === 'string') : d.discovered;
  const hints = isRecord(raw.hints) ? Object.fromEntries(Object.entries(raw.hints).filter((e): e is [string, string] => typeof e[1] === 'string')) : d.hints;
  const bestTime = isRecord(raw.bestTime) ? Object.fromEntries(Object.entries(raw.bestTime).filter(([, v]) => typeof v === 'number').map(([k, v]) => [Number(k), v as number])) : d.bestTime;
  const settings = isRecord(raw.settings) ? { sound: raw.settings.sound !== false, vibration: raw.settings.vibration !== false, music: raw.settings.music !== false } : d.settings;
  const stars = isRecord(raw.stars)
    ? Object.fromEntries(Object.entries(raw.stars).filter(([, v]) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3).map(([k, v]) => [Number(k), v as number]))
    : d.stars;
  const dl = raw.daily;
  const int = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.floor(v as number)));
  const daily =
    isRecord(dl) && [dl.seed, dl.stageId, dl.plays, dl.bestStars, dl.bestTime].every((v) => typeof v === 'number' && Number.isFinite(v))
      ? { seed: dl.seed as number, stageId: int(dl.stageId, 1, 99), plays: int(dl.plays, 0, 1e6), bestStars: int(dl.bestStars, 0, 3), bestTime: int(dl.bestTime, 0, 1e6) }
      : null;
  return {
    version: SAVE_VERSION,
    discovered: [...new Set(discovered)],
    hints,
    unlockedStages: typeof raw.unlockedStages === 'number' && raw.unlockedStages >= 1 ? Math.floor(raw.unlockedStages) : d.unlockedStages,
    bestTime,
    settings,
    tutorialDone: raw.tutorialDone === true,
    sessions: typeof raw.sessions === 'number' ? raw.sessions : 0,
    stars,
    daily,
  };
}

export class SaveService {
  private current: SaveData;
  lastError: string | null = null;

  constructor(private readonly store: KeyValueStore) {
    this.current = this.load();
  }

  get data(): SaveData {
    return this.current;
  }

  private load(): SaveData {
    try {
      const text = this.store.getItem(SAVE_KEY);
      return text ? sanitize(JSON.parse(text)) : defaults();
    } catch (err) {
      this.lastError = String(err);
      return defaults();
    }
  }

  private commit(next: SaveData): void {
    this.current = next;
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(next));
    } catch (err) {
      // 저장 실패(사파리 프라이빗 모드, 용량 초과)는 판을 막지 않는다. 메모리 상태는 유지.
      this.lastError = String(err);
      console.warn('[SaveService] 저장 실패:', err);
    }
  }

  addDiscoveries(ids: readonly string[]): void {
    const set = new Set(this.current.discovered);
    const before = set.size;
    ids.forEach((id) => set.add(id));
    if (set.size !== before) this.commit({ ...this.current, discovered: [...set] });
  }

  setHint(resultId: string, ingredientId: string): void {
    this.commit({ ...this.current, hints: { ...this.current.hints, [resultId]: ingredientId } });
  }

  /** 판 종료 기록: 최고 생존 시간, 승리 시 다음 스테이지 해금 */
  recordRun(stageId: number, result: 'win' | 'lose', timeSec: number, maxStage = Number.MAX_SAFE_INTEGER, stars = 0): void {
    const best = Math.max(this.current.bestTime[stageId] ?? 0, Math.floor(timeSec));
    const unlocked = result === 'win' ? Math.min(maxStage, Math.max(this.current.unlockedStages, stageId + 1)) : this.current.unlockedStages;
    const bestStars = Math.max(this.current.stars[stageId] ?? 0, stars);
    this.commit({ ...this.current, bestTime: { ...this.current.bestTime, [stageId]: best }, unlockedStages: unlocked, stars: { ...this.current.stars, [stageId]: bestStars } });
  }

  /** 오늘의 도전 기록. 날짜(seed)가 바뀌면 새로 시작 */
  recordDaily(seed: number, stageId: number, _result: 'win' | 'lose', timeSec: number, stars: number): void {
    const prev = this.current.daily?.seed === seed ? this.current.daily : { seed, stageId, plays: 0, bestStars: 0, bestTime: 0 };
    const daily = { seed, stageId: prev.stageId, plays: prev.plays + 1, bestStars: Math.max(prev.bestStars, stars), bestTime: Math.max(prev.bestTime, Math.floor(timeSec)) };
    this.commit({ ...this.current, daily });
  }

  updateSettings(patch: Partial<SaveSettings>): void {
    this.commit({ ...this.current, settings: { ...this.current.settings, ...patch } });
  }

  markTutorialDone(): void {
    if (!this.current.tutorialDone) this.commit({ ...this.current, tutorialDone: true });
  }

  /** 세션 시작 기록. 첫 세션이면 true */
  startSession(): boolean {
    const first = this.current.sessions === 0;
    this.commit({ ...this.current, sessions: this.current.sessions + 1 });
    return first;
  }
}
