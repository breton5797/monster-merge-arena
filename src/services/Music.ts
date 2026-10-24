// 절차적 배경음악 (Web Audio 시퀀서, 에셋 없음). 메뉴·전투·보스 3곡, 16스텝 패턴 반복.
// Arcade Core 분리 후보.

export type TrackId = 'menu' | 'battle' | 'boss';

interface Track {
  readonly bpm: number;
  /** 화음 진행: 마디마다 근음(MIDI) */
  readonly roots: readonly number[];
  /** 16스텝 아르페지오 (근음 기준 반음, null = 쉼) */
  readonly lead: readonly (number | null)[];
  /** 16스텝 베이스 (근음 기준, null = 쉼) */
  readonly bass: readonly (number | null)[];
  /** 16스텝 드럼: k=킥, h=하이햇, s=스네어, .=쉼 */
  readonly drums: string;
  readonly leadWave: OscillatorType;
}

const _ = null;
const TRACKS: Record<TrackId, Track> = {
  menu: {
    bpm: 96, roots: [60, 57, 53, 55], leadWave: 'triangle',
    lead: [0, _, 7, _, 12, _, 7, _, 16, _, 12, _, 7, _, 4, _],
    bass: [-12, _, _, _, -12, _, _, _, -5, _, _, _, -12, _, _, _],
    drums: 'k.......k...h...',
  },
  battle: {
    bpm: 128, roots: [57, 53, 48, 55], leadWave: 'square',
    lead: [12, _, 15, 12, 19, _, 15, _, 12, _, 15, 19, 24, _, 19, _],
    bass: [-12, _, -12, _, -12, _, -5, _, -12, _, -12, _, -7, _, -5, _],
    drums: 'k.h.s.h.k.h.s.hh',
  },
  boss: {
    bpm: 144, roots: [52, 52, 55, 50], leadWave: 'sawtooth',
    lead: [12, 13, 12, _, 19, _, 18, _, 12, 13, 12, _, 24, _, 22, _],
    bass: [-12, -12, _, -12, -12, _, -12, _, -12, -12, _, -12, -11, _, -10, _],
    drums: 'k.hks.hkk.hks.hs',
  },
};

const LOOKAHEAD_SEC = 0.12;
const TICK_MS = 30;
const MUSIC_VOLUME = 0.07;

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class Music {
  private gain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private track: TrackId | null = null;
  private step = 0;
  private nextTime = 0;
  enabled = true;

  constructor(private readonly getCtx: () => AudioContext | null) {}

  play(id: TrackId): void {
    if (this.track === id && this.timer !== null) return;
    this.halt();
    this.track = id;
    this.start();
  }

  /** 오디오 잠금 해제 후 다시 시도할 때 */
  resume(): void {
    if (this.track && this.timer === null) this.start();
  }

  /** 곡 정지 (다시 켜도 이전 곡이 재생되지 않음) */
  stop(): void {
    this.halt();
    this.track = null;
  }

  private halt(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.halt();
    else this.resume();
  }

  private start(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.enabled || !this.track) return;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = MUSIC_VOLUME;
      this.gain.connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(ctx), TICK_MS);
  }

  private schedule(ctx: AudioContext): void {
    if (!this.track || ctx.state !== 'running') return;
    const t = TRACKS[this.track];
    const stepSec = 60 / t.bpm / 4;
    // 백그라운드 탭에서 타이머가 느려졌다 돌아오면 밀린 음을 한꺼번에 내지 않는다
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      const s = this.step % 16;
      const root = t.roots[Math.floor(this.step / 16) % t.roots.length];
      const lead = t.lead[s];
      const bass = t.bass[s];
      if (lead !== null) this.tone(ctx, freq(root + lead), this.nextTime, stepSec * 0.9, t.leadWave, 0.5);
      if (bass !== null) this.tone(ctx, freq(root + bass), this.nextTime, stepSec * 1.8, 'triangle', 0.9);
      this.drum(ctx, t.drums[s], this.nextTime);
      this.nextTime += stepSec;
      this.step++;
    }
  }

  private tone(ctx: AudioContext, f: number, at: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.gain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(this.gain);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private drum(ctx: AudioContext, kind: string, at: number): void {
    if (!this.gain || kind === '.') return;
    if (kind === 'k') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(120, at);
      o.frequency.exponentialRampToValueAtTime(40, at + 0.12);
      g.gain.setValueAtTime(1.4, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.14);
      o.connect(g).connect(this.gain);
      o.start(at);
      o.stop(at + 0.16);
      return;
    }
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = this.noise;
    filter.type = kind === 'h' ? 'highpass' : 'bandpass';
    filter.frequency.value = kind === 'h' ? 7000 : 1800;
    const dur = kind === 'h' ? 0.04 : 0.12;
    g.gain.setValueAtTime(kind === 'h' ? 0.35 : 0.8, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(filter).connect(g).connect(this.gain);
    src.start(at);
    src.stop(at + dur + 0.02);
  }
}
