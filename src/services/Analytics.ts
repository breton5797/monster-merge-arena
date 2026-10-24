import type { KeyValueStore } from './SaveService';

// 분석 이벤트 (GAME_DESIGN.md §9). 시제품: console + localStorage 큐, [로그 복사]로 제출.
// Arcade Core 분리 후보.

export type AnalyticsEventName =
  | 'session_start'
  | 'run_start'
  | 'merge'
  | 'discovery'
  | 'pick_shown'
  | 'pick_chosen'
  | 'summon'
  | 'codex_open'
  | 'run_end'
  | 'replay_click';

export type EventProps = Readonly<Record<string, string | number | boolean | readonly string[] | null>>;

export interface AnalyticsEvent {
  readonly name: AnalyticsEventName;
  readonly props: EventProps;
  readonly sessionId: string;
  readonly at: number;
}

export interface LogSummary {
  readonly runs: number;
  readonly wins: number;
  readonly discoveries: number;
  readonly avgSurvivalSec: number;
  readonly codexOpens: number;
}

const QUEUE_KEY = 'mma_analytics';
const MAX_QUEUE = 3000;

export function summarize(events: readonly AnalyticsEvent[]): LogSummary {
  const ends = events.filter((e) => e.name === 'run_end');
  const times = ends.filter((e) => e.props.quit !== true).map((e) => Number(e.props.timeSec) || 0);
  return {
    runs: ends.length,
    wins: ends.filter((e) => e.props.result === 'win').length,
    discoveries: events.filter((e) => e.name === 'discovery').length,
    avgSurvivalSec: times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10 : 0,
    codexOpens: events.filter((e) => e.name === 'codex_open').length,
  };
}

export class Analytics {
  readonly sessionId: string;
  private events: AnalyticsEvent[];
  private listeners: ((e: AnalyticsEvent) => void)[] = [];

  constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now) {
    this.sessionId = `${now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    this.events = this.load();
  }

  private load(): AnalyticsEvent[] {
    try {
      const parsed: unknown = JSON.parse(this.store.getItem(QUEUE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]).filter((e) => typeof e?.name === 'string') : [];
    } catch {
      return [];
    }
  }

  track(name: AnalyticsEventName, props: EventProps = {}): void {
    const ev: AnalyticsEvent = { name, props, sessionId: this.sessionId, at: this.now() };
    this.events = [...this.events, ev].slice(-MAX_QUEUE);
    try {
      this.store.setItem(QUEUE_KEY, JSON.stringify(this.events));
    } catch (err) {
      console.warn('[Analytics] 큐 저장 실패:', err);
    }
    console.info('[Analytics]', name, props);
    this.listeners.forEach((l) => l(ev));
  }

  onEvent(listener: (e: AnalyticsEvent) => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  get queue(): readonly AnalyticsEvent[] {
    return this.events;
  }

  sessionEvents(): AnalyticsEvent[] {
    return this.events.filter((e) => e.sessionId === this.sessionId);
  }

  /** 플레이테스터 제출용 JSON: 이번 세션 요약 + 전체 큐 */
  exportLog(): string {
    return JSON.stringify({ sessionId: this.sessionId, summary: summarize(this.sessionEvents()), allTime: summarize(this.events), events: this.events }, null, 1);
  }
}
