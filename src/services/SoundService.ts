// Web Audio로 즉석 합성하는 효과음 (에셋 없음). Arcade Core 분리 후보.

export type SfxId = 'merge' | 'discover' | 'chimera' | 'invalid' | 'hit' | 'kill' | 'baseHit' | 'button' | 'summon' | 'pick' | 'win' | 'lose' | 'boss';

interface Note {
  readonly f: number;
  readonly d: number;
  readonly type?: OscillatorType;
  readonly at?: number;
  readonly to?: number;
  readonly vol?: number;
}

const SFX: Record<SfxId, readonly Note[]> = {
  merge: [{ f: 440, d: 0.08, type: 'square', to: 880 }, { f: 880, d: 0.1, at: 0.07, type: 'triangle' }],
  discover: [523, 659, 784, 1047].map((f, i) => ({ f, d: 0.14, at: i * 0.09, type: 'triangle' as const, vol: 0.5 })),
  chimera: [{ f: 300, d: 0.18, type: 'sawtooth', to: 140 }, { f: 160, d: 0.2, at: 0.16, type: 'sawtooth', to: 90 }],
  invalid: [{ f: 160, d: 0.12, type: 'square', vol: 0.3 }, { f: 120, d: 0.12, at: 0.1, type: 'square', vol: 0.3 }],
  hit: [{ f: 220, d: 0.04, type: 'square', to: 110, vol: 0.12 }],
  kill: [{ f: 660, d: 0.06, type: 'triangle', to: 990, vol: 0.2 }],
  baseHit: [{ f: 90, d: 0.25, type: 'sawtooth', to: 50, vol: 0.5 }],
  button: [{ f: 700, d: 0.05, type: 'triangle', vol: 0.3 }],
  summon: [{ f: 330, d: 0.08, type: 'triangle', to: 660, vol: 0.35 }],
  pick: [{ f: 587, d: 0.1, type: 'triangle' }, { f: 880, d: 0.12, at: 0.08, type: 'triangle' }],
  win: [523, 659, 784, 1047, 1319].map((f, i) => ({ f, d: 0.2, at: i * 0.12, type: 'triangle' as const, vol: 0.5 })),
  lose: [392, 330, 262, 196].map((f, i) => ({ f, d: 0.25, at: i * 0.16, type: 'sawtooth' as const, vol: 0.3 })),
  boss: [{ f: 70, d: 0.6, type: 'sawtooth', to: 40, vol: 0.6 }, { f: 110, d: 0.5, at: 0.1, type: 'square', to: 55, vol: 0.3 }],
};

const MIN_GAP_MS: Partial<Record<SfxId, number>> = { hit: 60, kill: 50, baseHit: 120 };
const MASTER_VOLUME = 0.25;

export class SoundService {
  private ctx: AudioContext | null = null;
  private lastPlayed = new Map<SfxId, number>();
  enabled = true;

  /** 브라우저 자동재생 정책 때문에 첫 터치 이후 호출 */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) this.ctx = new Ctor();
  }

  play(id: SfxId): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const nowMs = performance.now();
    const gap = MIN_GAP_MS[id];
    if (gap && nowMs - (this.lastPlayed.get(id) ?? 0) < gap) return;
    this.lastPlayed.set(id, nowMs);
    const t0 = ctx.currentTime;
    for (const n of SFX[id]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + (n.at ?? 0);
      osc.type = n.type ?? 'sine';
      osc.frequency.setValueAtTime(n.f, start);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.d);
      gain.gain.setValueAtTime(MASTER_VOLUME * (n.vol ?? 0.4), start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.d + 0.02);
    }
  }
}
